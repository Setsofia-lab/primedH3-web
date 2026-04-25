/**
 * UserBootstrapService — turns a Cognito JWT into a `users` row.
 *
 * Why an explicit step:
 *   - Cognito is the identity store; our app domain still needs a uuid
 *     it controls so foreign keys (cases.surgeon_id, etc.) work.
 *   - Provider invitations create the row up-front (`POST /admin/users/
 *     invite`); but admin self-bootstrap (the very first signed-in
 *     human) and any flows we forget should also produce a row safely.
 *
 * Idempotent: lookup by cognito_sub; insert if missing; otherwise
 * update last_seen_at + cognito_groups (so role refreshes propagate).
 *
 * Cognito access tokens don't carry profile attributes (email, given_
 * name, family_name) — those are only on the id_token. To get a clean
 * display name on first bootstrap we call AdminGetUser by sub on miss,
 * once per principal. After insert, the row is the source of truth and
 * we never re-fetch from Cognito.
 *
 * Called from JwtAuthGuard after token verification, before the request
 * handler runs. Fast: SELECT + (rare) AdminGetUser + INSERT.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { eq, sql } from 'drizzle-orm';
import type { AppConfig } from '../config/config.module';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { users, type User } from '../db/schema';
import type { AuthContext, PoolKind } from './auth-context';

@Injectable()
export class UserBootstrapService {
  private readonly logger = new Logger(UserBootstrapService.name);
  private readonly idp: CognitoIdentityProviderClient;

  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.idp = new CognitoIdentityProviderClient({
      region: this.config.get('COGNITO_REGION', { infer: true }) ?? 'us-east-1',
    });
  }

  /**
   * Ensure a users row exists for the authenticated principal. Returns
   * the row. Mutates last_seen_at + cognito_groups on every call.
   */
  async ensure(ctx: AuthContext): Promise<User> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.cognitoSub, ctx.sub))
      .limit(1);
    if (existing[0]) {
      // Heal the row if it was inserted before the AdminGetUser fix
      // (firstName="User", lastName="", or fake email). This is a one-
      // shot upgrade; rows created post-fix already have real values.
      const stale =
        existing[0].firstName === 'User' ||
        existing[0].lastName === '' ||
        existing[0].email.endsWith('@unknown.invalid');
      const patch: Record<string, unknown> = {
        cognitoGroups: ctx.groups as string[],
        cognitoPool: ctx.pool,
        lastSeenAt: new Date(),
        role: ctx.role,
      };
      if (stale) {
        const profile = await this.fetchCognitoProfile(ctx);
        patch.firstName = profile.firstName;
        patch.lastName = profile.lastName;
        patch.email = profile.email || existing[0].email;
        this.logger.log(
          `healed users row sub=${ctx.sub} → name="${profile.firstName} ${profile.lastName}"`,
        );
      }
      const [touched] = await this.db
        .update(users)
        .set(patch)
        .where(eq(users.id, existing[0].id))
        .returning();
      return touched ?? existing[0];
    }

    // Self-bootstrap: pull profile attrs from Cognito because access
    // tokens don't carry given_name/family_name/email.
    const profile = await this.fetchCognitoProfile(ctx);
    try {
      const [created] = await this.db
        .insert(users)
        .values({
          email: profile.email || ctx.email || `${ctx.sub}@unknown.invalid`,
          cognitoSub: ctx.sub,
          cognitoPool: ctx.pool,
          cognitoGroups: ctx.groups as string[],
          role: ctx.role,
          firstName: profile.firstName,
          lastName: profile.lastName,
          lastSeenAt: new Date(),
        })
        .returning();
      this.logger.log(
        `bootstrapped users row for sub=${ctx.sub} role=${ctx.role} name="${profile.firstName} ${profile.lastName}"`,
      );
      return created!;
    } catch (err) {
      // Concurrent first-request race: two requests bootstrap at once,
      // the unique index on cognito_sub catches the loser. Re-read.
      this.logger.warn(`bootstrap insert raced for sub=${ctx.sub}, refetching`);
      const after = await this.db
        .select()
        .from(users)
        .where(eq(users.cognitoSub, ctx.sub))
        .limit(1);
      if (after[0]) return after[0];
      throw err;
    }
  }

  /**
   * Light-touch presence ping that doesn't insert; used by the auth
   * guard so unbootstrapped tokens (rare paths) don't block requests
   * with a write. Falls through to ensure() on miss so callers always
   * get a row.
   */
  async touch(ctx: AuthContext): Promise<User> {
    // Use a single UPDATE…RETURNING; if zero rows, fall through.
    const updated = await this.db
      .update(users)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(users.cognitoSub, ctx.sub))
      .returning();
    if (updated[0]) return updated[0];
    return this.ensure(ctx);
  }

  private poolIdFor(pool: PoolKind): string | undefined {
    if (pool === 'admins') {
      return this.config.get('COGNITO_ADMINS_POOL_ID', { infer: true }) ?? undefined;
    }
    if (pool === 'patients') {
      return this.config.get('COGNITO_PATIENTS_POOL_ID', { infer: true }) ?? undefined;
    }
    return this.config.get('COGNITO_PROVIDERS_POOL_ID', { infer: true }) ?? undefined;
  }

  /**
   * One-time profile fetch on bootstrap miss. Uses AdminGetUser to read
   * email + given_name + family_name from the Cognito user record.
   * Falls back to email-local-part heuristics if anything is missing.
   */
  private async fetchCognitoProfile(
    ctx: AuthContext,
  ): Promise<{ email: string; firstName: string; lastName: string }> {
    const poolId = this.poolIdFor(ctx.pool);
    if (!poolId) {
      const [g, f] = nameFromEmail(ctx.email);
      return { email: ctx.email, firstName: g, lastName: f };
    }
    try {
      const out = await this.idp.send(
        new AdminGetUserCommand({ UserPoolId: poolId, Username: ctx.sub }),
      );
      const attrs = new Map(
        (out.UserAttributes ?? []).map((a) => [a.Name ?? '', a.Value ?? '']),
      );
      const email = attrs.get('email') ?? ctx.email;
      const given = attrs.get('given_name') ?? '';
      const family = attrs.get('family_name') ?? '';
      if (given || family) {
        return {
          email,
          firstName: given || cap(email.split('@')[0] ?? 'User'),
          lastName: family,
        };
      }
      const [g, f] = nameFromEmail(email);
      return { email, firstName: g, lastName: f };
    } catch (err) {
      this.logger.warn(`AdminGetUser failed for sub=${ctx.sub}: ${(err as Error).message}`);
      const [g, f] = nameFromEmail(ctx.email);
      return { email: ctx.email, firstName: g, lastName: f };
    }
  }
}

function nameFromEmail(email: string): [string, string] {
  const local = (email || '').split('@')[0] ?? '';
  if (!local) return ['User', ''];
  // setsofiaeli → "Setsofiaeli"; firstname.lastname → "Firstname Lastname".
  const parts = local.split(/[._+-]/).filter(Boolean);
  if (parts.length >= 2) {
    return [cap(parts[0]!), cap(parts[1]!)];
  }
  return [cap(local), ''];
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
