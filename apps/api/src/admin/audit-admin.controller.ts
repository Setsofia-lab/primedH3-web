/**
 * GET /admin/audit — paginated list of audit events.
 *
 * Query filters: action, actorUserId, resourceType, resourceId,
 * facilityId, since (ISO datetime). Ordered by occurredAt desc.
 *
 * Reads only — there's no write/delete path on audit events. The
 * AuditService handles writes from inside the originating handlers.
 */
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, gte, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { auditEvents, type AuditEvent } from '../db/schema';
import {
  listAuditQuerySchema,
  type ListAuditQuery,
} from './dto/admin.schemas';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/audit')
@Roles('admin')
export class AuditAdminController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Get()
  @ApiOperation({ summary: 'List audit events (filterable)' })
  async list(
    @Query(new ZodQueryPipe(listAuditQuerySchema)) query: ListAuditQuery,
  ): Promise<{ items: readonly AuditEvent[]; limit: number; offset: number }> {
    const clauses: SQL[] = [];
    if (query.action) clauses.push(eq(auditEvents.action, query.action));
    if (query.actorUserId) clauses.push(eq(auditEvents.actorUserId, query.actorUserId));
    if (query.resourceType) clauses.push(eq(auditEvents.resourceType, query.resourceType));
    if (query.resourceId) clauses.push(eq(auditEvents.resourceId, query.resourceId));
    if (query.facilityId) clauses.push(eq(auditEvents.targetFacilityId, query.facilityId));
    if (query.since) clauses.push(gte(auditEvents.occurredAt, new Date(query.since)));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }
}
