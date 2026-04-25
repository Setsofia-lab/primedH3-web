/**
 * Cases — non-admin, role-scoped read surface.
 *
 * Where /admin/cases is the unscoped CRUD console for admins, this is
 * the perspective every other role sees:
 *
 *   admin       → identical to /admin/cases (no extra filter)
 *   surgeon     → cases where surgeon_id = current user
 *   coordinator → cases for the current user's facility
 *   anesthesia  → cases for the current user's facility, in workup or
 *                 clearance status (the queue they actually own)
 *   allied      → cases for the current user's facility (read-only)
 *
 * Filters compose: caller scoping AND any explicit query params. So an
 * anesthesiologist can still pass ?status=ready to override the default
 * queue filter and see "ready" cases.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, type Case, type User } from '../db/schema';
import {
  listCasesQuerySchema,
  type ListCasesQuery,
} from '../admin/dto/admin.schemas';
import { ZodQueryPipe } from '../admin/zod-query.pipe';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied')
export class CasesController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Get()
  @ApiOperation({ summary: 'List cases visible to the current user (role-scoped)' })
  async list(
    @CurrentUserRow() me: User,
    @Query(new ZodQueryPipe(listCasesQuerySchema)) query: ListCasesQuery,
  ): Promise<{ items: readonly Case[]; limit: number; offset: number; scope: string }> {
    const clauses = this.scopeFor(me);
    if (query.facilityId) clauses.push(eq(cases.facilityId, query.facilityId));
    if (query.patientId) clauses.push(eq(cases.patientId, query.patientId));
    if (query.status) {
      // Explicit ?status= overrides the default anesthesia-queue filter.
      // Drop any prior status clause.
      const noStatus = clauses.filter((c) => !sqlIncludesStatus(c));
      noStatus.push(eq(cases.status, query.status));
      clauses.length = 0;
      clauses.push(...noStatus);
    }

    const where = clauses.length > 0 ? and(...clauses) : undefined;
    const items = await this.db
      .select()
      .from(cases)
      .where(where)
      .orderBy(desc(cases.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset, scope: me.role };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single case (only if visible to current user)' })
  async get(
    @CurrentUserRow() me: User,
    @Param('id') id: string,
  ): Promise<Case> {
    const [row] = await this.db
      .select()
      .from(cases)
      .where(eq(cases.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(`case ${id} not found`);
    if (!this.canSee(me, row)) {
      // 404 (not 403) so we don't leak existence to unauthorised roles.
      throw new NotFoundException(`case ${id} not found`);
    }
    return row;
  }

  // ----- scope helpers -----

  private scopeFor(me: User): SQL[] {
    switch (me.role) {
      case 'admin':
        return [];
      case 'surgeon':
        return [eq(cases.surgeonId, me.id)];
      case 'anesthesia': {
        const out: SQL[] = [];
        if (me.facilityId) out.push(eq(cases.facilityId, me.facilityId));
        // Default queue: cases that need anesthesia attention.
        out.push(inArray(cases.status, ['workup', 'clearance'] as const));
        return out;
      }
      case 'coordinator':
      case 'allied':
        return me.facilityId ? [eq(cases.facilityId, me.facilityId)] : [];
      case 'patient':
        // Patient pool isn't allowed by the @Roles decorator above, but
        // belt-and-braces: explicit deny.
        throw new ForbiddenException('patient role cannot list cases');
    }
  }

  /**
   * Visibility check used by GET /cases/:id. A duplicate of scopeFor
   * but evaluated in JS so we can reuse the row we already fetched.
   */
  private canSee(me: User, row: Case): boolean {
    switch (me.role) {
      case 'admin':
        return true;
      case 'surgeon':
        return row.surgeonId === me.id;
      case 'anesthesia':
        return Boolean(me.facilityId && row.facilityId === me.facilityId);
      case 'coordinator':
      case 'allied':
        return Boolean(me.facilityId && row.facilityId === me.facilityId);
      case 'patient':
        return false;
    }
  }
}

/**
 * Best-effort detection of an `eq(cases.status, …)` clause inside a
 * Drizzle SQL expression. Used to evict the default anesthesia status
 * filter when the caller passes ?status=… explicitly.
 */
function sqlIncludesStatus(clause: SQL): boolean {
  const str = String((clause as unknown as { queryChunks?: unknown[] }).queryChunks ?? '');
  return str.includes('"cases"."status"');
}
