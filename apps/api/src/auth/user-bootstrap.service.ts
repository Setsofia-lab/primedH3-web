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
 * Called from JwtAuthGuard after token verification, before the request
 * handler runs. Fast: a single SELECT + (rare) INSERT or UPDATE.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { users, type User } from '../db/schema';
import type { AuthContext } from './auth-context';

@Injectable()
export class UserBootstrapService {
  private readonly logger = new Logger(UserBootstrapService.name);

  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

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
      // Light update — keep groups + last_seen fresh, leave names alone
      // (admins manage display names through the invite flow).
      const [touched] = await this.db
        .update(users)
        .set({
          cognitoGroups: ctx.groups as string[],
          cognitoPool: ctx.pool,
          lastSeenAt: new Date(),
          // Role can change if an admin moves a user between groups in
          // Cognito; we trust the latest token here.
          role: ctx.role,
        })
        .where(eq(users.id, existing[0].id))
        .returning();
      return touched ?? existing[0];
    }

    // Self-bootstrap: derive display name from the email's local part
    // since access tokens don't carry given_name/family_name. Admins
    // can edit later via the users admin page.
    const [given, family] = nameFromEmail(ctx.email);
    try {
      const [created] = await this.db
        .insert(users)
        .values({
          email: ctx.email,
          cognitoSub: ctx.sub,
          cognitoPool: ctx.pool,
          cognitoGroups: ctx.groups as string[],
          role: ctx.role,
          firstName: given,
          lastName: family,
          lastSeenAt: new Date(),
        })
        .returning();
      this.logger.log(`bootstrapped users row for sub=${ctx.sub} role=${ctx.role}`);
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
}

function nameFromEmail(email: string): [string, string] {
  const local = email.split('@')[0] ?? '';
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
