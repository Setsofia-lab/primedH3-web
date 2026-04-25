/**
 * AuditService — single insertion point for `audit_events`.
 *
 * Every PHI-touching mutation across the api calls `record(...)` with
 * the action verb + resource ref + before/after state. Failures here
 * are logged but never throw to the caller — we never want an audit
 * write to take down a clinical mutation. (HIPAA cares more about a
 * gap than about a failed transaction; we'll alarm on dropped events
 * in M9.)
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { auditEvents, type NewAuditEvent } from '../db/schema';
import type { AuthContext } from '../auth/auth-context';
import type { User } from '../db/schema';

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'read'
  | 'login' | 'invite' | 'hydrate' | 'sign';

export interface AuditRecord {
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly targetFacilityId?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly note?: string;
}

export interface AuditActor {
  readonly userId?: string | null;
  readonly email?: string | null;
  readonly role?: string | null;
  readonly pool?: string | null;
}

export interface AuditRequestMeta {
  readonly requestId?: string | null;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  /**
   * Record an audit event. Never throws; logs an error and continues.
   */
  async record(
    actor: AuditActor,
    record: AuditRecord,
    meta: AuditRequestMeta = {},
  ): Promise<void> {
    const row: NewAuditEvent = {
      actorUserId: actor.userId ?? null,
      actorEmail: actor.email ?? null,
      actorRole: actor.role ?? null,
      actorPool: actor.pool ?? null,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId ?? null,
      targetFacilityId: record.targetFacilityId ?? null,
      requestId: meta.requestId ?? null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      beforeJson: record.before == null ? null : (record.before as object),
      afterJson: record.after == null ? null : (record.after as object),
      note: record.note ?? null,
    };
    try {
      await this.db.insert(auditEvents).values(row);
    } catch (err) {
      // Never bring down a clinical write because audit failed; log
      // loudly so we notice a gap.
      this.logger.error(
        `audit insert failed action=${record.action} resource=${record.resourceType}/${record.resourceId} err=${(err as Error).message}`,
      );
    }
  }

  /** Convenience for a typical authenticated mutation. */
  fromContext(ctx: AuthContext, user: User | undefined): AuditActor {
    return {
      userId: user?.id ?? null,
      email: ctx.email || user?.email || null,
      role: ctx.role,
      pool: ctx.pool,
    };
  }
}
