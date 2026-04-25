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
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthContext } from '../auth/auth-context';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, patients, type Case, type User } from '../db/schema';
import {
  createCaseSchema,
  listCasesQuerySchema,
  type CreateCaseInput,
  type ListCasesQuery,
} from '../admin/dto/admin.schemas';
import { ZodBodyPipe } from '../admin/zod-body.pipe';
import { ZodQueryPipe } from '../admin/zod-query.pipe';
import { meta } from '../admin/audit-meta';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied')
export class CasesController {
  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a case (role-aware: surgeon auto-assigns to themselves; ' +
      'coordinator/admin pick from their facility)',
  })
  async create(
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Body(new ZodBodyPipe(createCaseSchema)) input: CreateCaseInput,
    @Req() req: FastifyRequest,
  ): Promise<Case> {
    if (me.role === 'patient' || me.role === 'allied') {
      throw new ForbiddenException(`role ${me.role} cannot create cases`);
    }
    // Validate the patient is at the caller's facility (or any, for admins).
    const [pt] = await this.db
      .select()
      .from(patients)
      .where(eq(patients.id, input.patientId))
      .limit(1);
    if (!pt) throw new NotFoundException(`patient ${input.patientId} not found`);
    if (me.role !== 'admin' && (!me.facilityId || pt.facilityId !== me.facilityId)) {
      throw new ForbiddenException('patient not at your facility');
    }

    // Surgeon-driven creation: auto-assign to me, ignore any input.surgeonId
    // override unless the caller is admin.
    const surgeonId =
      me.role === 'surgeon'
        ? me.id
        : me.role === 'admin'
        ? input.surgeonId ?? null
        : input.surgeonId ?? null;
    const facilityId = me.role === 'admin' ? input.facilityId : pt.facilityId;
    if (me.role !== 'admin' && input.facilityId !== facilityId) {
      throw new ForbiddenException('facility mismatch — patient is at a different facility');
    }

    const [row] = await this.db
      .insert(cases)
      .values({
        facilityId,
        patientId: input.patientId,
        surgeonId,
        coordinatorId: input.coordinatorId ?? null,
        procedureCode: input.procedureCode ?? null,
        procedureDescription: input.procedureDescription ?? null,
        status: input.status ?? 'referral',
        surgeryDate: input.surgeryDate ? new Date(input.surgeryDate) : null,
        createdBy: me.id,
      })
      .returning();

    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'create',
        resourceType: 'case',
        resourceId: row!.id,
        targetFacilityId: row!.facilityId,
        after: row,
        note: `created by ${me.role}`,
      },
      meta(req),
    );
    return row!;
  }

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
