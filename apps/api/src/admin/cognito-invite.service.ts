/**
 * CognitoInviteService — turns admin-supplied (email, role, name) into:
 *   1. a Cognito user in the providers pool (or admins, for role=admin),
 *   2. group memberships matching the role (surgeon / anesthesia / etc.),
 *   3. an emailed temporary password (Cognito sends this on our behalf),
 *   4. a corresponding `users` row in our DB.
 *
 * The DB row is created with `cognito_sub` set to whatever Cognito
 * returned, so when the invitee logs in for the first time, the
 * UserBootstrapService finds their existing row instead of creating a
 * duplicate.
 */
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  GroupExistsException,
  type AdminCreateUserCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import { eq } from 'drizzle-orm';
import type { AppConfig } from '../config/config.module';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { patients, users, type User } from '../db/schema';
import type { Role } from '../auth/auth-context';

interface InviteInput {
  readonly email: string;
  readonly role: Role;
  readonly firstName: string;
  readonly lastName: string;
  readonly facilityId?: string;
  readonly patientId?: string;
}

interface InviteOutcome {
  readonly user: User;
  readonly cognitoSub: string;
  readonly userStatus: string;
}

/** Maps app role → Cognito group on the providers pool. */
const ROLE_TO_GROUP: Partial<Record<Role, string>> = {
  surgeon: 'surgeon',
  anesthesia: 'anesthesia',
  coordinator: 'coordinator',
  allied: 'allied',
};

@Injectable()
export class CognitoInviteService {
  private readonly logger = new Logger(CognitoInviteService.name);
  private readonly client: CognitoIdentityProviderClient;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
  ) {
    this.client = new CognitoIdentityProviderClient({
      region: this.config.get('COGNITO_REGION', { infer: true }) ?? 'us-east-1',
    });
  }

  async invite(input: InviteInput): Promise<InviteOutcome> {
    const poolId = this.poolFor(input.role);
    if (!poolId) {
      throw new InternalServerErrorException(
        `cognito ${input.role === 'admin' ? 'admins' : 'providers'} pool not configured`,
      );
    }
    const groupName = ROLE_TO_GROUP[input.role];

    // 1. Create the Cognito user. SUPPRESS the welcome email and we'll
    // send a custom one once the audit/email plumbing exists; for now,
    // RESEND_INVITATION (default) sends a Cognito-templated email with
    // the temporary password.
    const created = await this.createCognitoUser(poolId, input);
    const cognitoSub = subFrom(created);

    // 2. Group assignment for providers (admin pool has no groups).
    if (groupName) {
      await this.ensureGroup(poolId, groupName);
      await this.client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: poolId,
          Username: input.email,
          GroupName: groupName,
        }),
      );
    }

    // 3. DB row. If one already exists for this email (admin re-inviting
    // someone who self-bootstrapped), update the cognito linkage rather
    // than insert.
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing[0]) {
      const [updated] = await this.db
        .update(users)
        .set({
          cognitoSub,
          cognitoPool: input.role === 'admin' ? 'admins' : 'providers',
          cognitoGroups: groupName ? [groupName] : [],
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          facilityId: input.facilityId ?? existing[0].facilityId,
          invitedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id))
        .returning();
      return {
        user: updated!,
        cognitoSub,
        userStatus: created.User?.UserStatus ?? 'UNKNOWN',
      };
    }

    const cognitoPool: 'admins' | 'providers' | 'patients' =
      input.role === 'admin' ? 'admins' : input.role === 'patient' ? 'patients' : 'providers';
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        cognitoSub,
        cognitoPool,
        cognitoGroups: groupName ? [groupName] : [],
        facilityId: input.facilityId ?? null,
        invitedAt: new Date(),
      })
      .returning();

    // Patient linkage: if a patient row was specified, point it at the new
    // user. The patient's logins now resolve to this row, and the api can
    // serve their case via /me/* without further admin work.
    if (input.role === 'patient' && input.patientId && row) {
      await this.db
        .update(patients)
        .set({ userId: row.id })
        .where(eq(patients.id, input.patientId));
      this.logger.log(`linked patient row=${input.patientId} → user=${row.id}`);
    }

    this.logger.log(
      `invited user email=${input.email} role=${input.role} cognitoSub=${cognitoSub}`,
    );
    return {
      user: row!,
      cognitoSub,
      userStatus: created.User?.UserStatus ?? 'UNKNOWN',
    };
  }

  private poolFor(role: Role): string | undefined {
    if (role === 'admin') {
      return this.config.get('COGNITO_ADMINS_POOL_ID', { infer: true }) ?? undefined;
    }
    if (role === 'patient') {
      return this.config.get('COGNITO_PATIENTS_POOL_ID', { infer: true }) ?? undefined;
    }
    // surgeon / anesthesia / coordinator / allied → providers pool
    return this.config.get('COGNITO_PROVIDERS_POOL_ID', { infer: true }) ?? undefined;
  }

  private async createCognitoUser(
    poolId: string,
    input: InviteInput,
  ): Promise<AdminCreateUserCommandOutput> {
    try {
      return await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: input.email,
          UserAttributes: [
            { Name: 'email', Value: input.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'given_name', Value: input.firstName },
            { Name: 'family_name', Value: input.lastName },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
          // No TemporaryPassword → Cognito generates one and emails it.
        }),
      );
    } catch (err) {
      // If the user already exists, fetch them so the caller can still
      // proceed (idempotent invites are safer than half-states).
      const e = err as { name?: string; message?: string };
      if (e.name === 'UsernameExistsException') {
        const got = await this.client.send(
          new AdminGetUserCommand({ UserPoolId: poolId, Username: input.email }),
        );
        return {
          User: {
            Username: got.Username,
            Attributes: got.UserAttributes,
            UserCreateDate: got.UserCreateDate,
            UserLastModifiedDate: got.UserLastModifiedDate,
            Enabled: got.Enabled,
            UserStatus: got.UserStatus,
          },
          $metadata: got.$metadata,
        };
      }
      throw err;
    }
  }

  private async ensureGroup(poolId: string, groupName: string): Promise<void> {
    try {
      await this.client.send(
        new CreateGroupCommand({ UserPoolId: poolId, GroupName: groupName }),
      );
    } catch (err) {
      if (err instanceof GroupExistsException) return;
      throw err;
    }
  }
}

function subFrom(out: AdminCreateUserCommandOutput): string {
  const sub = out.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new InternalServerErrorException('cognito create user returned no sub');
  return sub;
}
