/**
 * POST /admin/cases — create a case linked to a mirrored patient.
 * GET  /admin/cases — list (filter by facility / patient / status).
 *
 * Admin-only. Cases are the primary domain object (Constitution §3.4
 * coordinator board) — every other workflow resource hangs off one.
 * Keep writes narrow for now; assignment + status transitions move
 * to dedicated endpoints in M7.3+ when we introduce audit events.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AgentDispatcherService } from '../agents/agent-dispatcher.service';
import { IntakeOrchestratorService } from '../cases/intake-orchestrator.service';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, type Case, type User } from '../db/schema';
import { meta } from './audit-meta';
import {
  createCaseSchema,
  dispatchAgentSchema,
  listCasesQuerySchema,
  updateCaseSchema,
  type CreateCaseInput,
  type DispatchAgentInput,
  type ListCasesQuery,
  type UpdateCaseInput,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/cases')
@Roles('admin')
export class CasesAdminController {
  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly audit: AuditService,
    private readonly intake: IntakeOrchestratorService,
    private readonly dispatcher: AgentDispatcherService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a case for a mirrored patient' })
  async create(
    @Body(new ZodBodyPipe(createCaseSchema)) input: CreateCaseInput,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<Case> {
    const [row] = await this.db
      .insert(cases)
      .values({
        facilityId: input.facilityId,
        patientId: input.patientId,
        surgeonId: input.surgeonId ?? null,
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
      },
      meta(req),
    );
    // M9 stand-in: seed the default workup checklist.
    await this.intake.onCaseCreated(row!, me.id);
    return row!;
  }

  @Get()
  @ApiOperation({ summary: 'List cases (filter by facility / patient / status)' })
  async list(
    @Query(new ZodQueryPipe(listCasesQuerySchema)) query: ListCasesQuery,
  ): Promise<{
    items: readonly Case[];
    limit: number;
    offset: number;
  }> {
    const clauses: SQL[] = [];
    if (query.facilityId) clauses.push(eq(cases.facilityId, query.facilityId));
    if (query.patientId) clauses.push(eq(cases.patientId, query.patientId));
    if (query.status) clauses.push(eq(cases.status, query.status));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(cases)
      .where(where)
      .orderBy(desc(cases.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a single case by id' })
  async get(@Param('id') id: string): Promise<Case> {
    const [row] = await this.db
      .select()
      .from(cases)
      .where(eq(cases.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(`case ${id} not found`);
    return row;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a case (assignment, procedure, status, schedule, readiness)',
  })
  async update(
    @Param('id') id: string,
    @Body(new ZodBodyPipe(updateCaseSchema)) input: UpdateCaseInput,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<Case> {
    const [before] = await this.db.select().from(cases).where(eq(cases.id, id)).limit(1);
    if (!before) throw new NotFoundException(`case ${id} not found`);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if ('surgeonId' in input) patch.surgeonId = input.surgeonId ?? null;
    if ('coordinatorId' in input) patch.coordinatorId = input.coordinatorId ?? null;
    if ('procedureCode' in input) patch.procedureCode = input.procedureCode ?? null;
    if ('procedureDescription' in input) {
      patch.procedureDescription = input.procedureDescription ?? null;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
      // Stamp clearedAt when a case crosses into 'ready' or 'completed'.
      if (input.status === 'ready' || input.status === 'completed') {
        patch.clearedAt = new Date();
      }
    }
    if ('surgeryDate' in input) {
      patch.surgeryDate = input.surgeryDate ? new Date(input.surgeryDate) : null;
    }
    if ('readinessScore' in input) patch.readinessScore = input.readinessScore ?? null;

    const [row] = await this.db
      .update(cases)
      .set(patch)
      .where(eq(cases.id, id))
      .returning();
    if (!row) throw new NotFoundException(`case ${id} not found`);
    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'update',
        resourceType: 'case',
        resourceId: row.id,
        targetFacilityId: row.facilityId,
        before,
        after: row,
      },
      meta(req),
    );
    return row;
  }

  @Post(':id/dispatch-agent')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Manually dispatch an agent run against a case (admin trigger)',
  })
  async dispatchAgent(
    @Param('id') id: string,
    @Body(new ZodBodyPipe(dispatchAgentSchema)) input: DispatchAgentInput,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<{ runId: string }> {
    const [row] = await this.db
      .select()
      .from(cases)
      .where(eq(cases.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(`case ${id} not found`);

    const result = await this.dispatcher.dispatch({
      agentKey: input.agentKey,
      triggerEvent: 'admin.manual',
      caseRow: row,
      procedureCode: row.procedureCode,
      procedureDescription: row.procedureDescription,
      payload: input.payload ?? {},
    });

    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'create',
        resourceType: 'agent_run',
        resourceId: result.runId,
        targetFacilityId: row.facilityId,
        after: { agentKey: input.agentKey, caseId: id, runId: result.runId },
      },
      meta(req),
    );

    return result;
  }
}
