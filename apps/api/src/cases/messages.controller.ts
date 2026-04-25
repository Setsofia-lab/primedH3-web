/**
 * Messages — per-case threaded messaging.
 *
 * Visibility:
 *   - admin / surgeon / coordinator / anesthesia / allied see every
 *     message on a case they can see (per CasesController.scopeFor).
 *   - patient sees only `patient_visible=true` messages on their case.
 *
 * Patients post messages too — those are always patient_visible (they
 * authored them). Care-team posts default to patient-hidden so the
 * coordinator can chat internally without the patient seeing every
 * status update; a "share with patient" toggle on the UI flips the bit.
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
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthContext } from '../auth/auth-context';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, messages, patients, type Message, type User } from '../db/schema';
import {
  createMessageSchema,
  listMessagesQuerySchema,
  type CreateMessageInput,
  type ListMessagesQuery,
} from '../admin/dto/admin.schemas';
import { ZodBodyPipe } from '../admin/zod-body.pipe';
import { ZodQueryPipe } from '../admin/zod-query.pipe';
import { meta } from '../admin/audit-meta';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied', 'patient')
export class MessagesController {
  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List messages, scoped by case visibility' })
  async list(
    @CurrentUserRow() me: User,
    @Query(new ZodQueryPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ): Promise<{ items: readonly Message[]; limit: number; offset: number }> {
    const visibleCaseIds = await this.visibleCaseIds(me);
    if (visibleCaseIds === null) {
      // admin: no case-id restriction
    } else if (visibleCaseIds.length === 0) {
      return { items: [], limit: query.limit, offset: query.offset };
    }

    const clauses: SQL[] = [];
    if (visibleCaseIds !== null) {
      clauses.push(inArray(messages.caseId, [...visibleCaseIds]));
    }
    if (query.caseId) clauses.push(eq(messages.caseId, query.caseId));
    if (me.role === 'patient') {
      // Patients only see patient-visible messages.
      clauses.push(eq(messages.patientVisible, true));
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(messages)
      .where(where)
      .orderBy(asc(messages.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a message on a case' })
  async create(
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Body(new ZodBodyPipe(createMessageSchema)) input: CreateMessageInput,
    @Req() req: FastifyRequest,
  ): Promise<Message> {
    const caseRow = await this.fetchCaseIfVisible(me, input.caseId);
    // Patients always post patient-visible messages (they wrote it).
    // Care team posts default to patient-hidden unless flagged.
    const patientVisible =
      me.role === 'patient' ? true : Boolean(input.patientVisible);
    const [row] = await this.db
      .insert(messages)
      .values({
        facilityId: caseRow.facilityId,
        caseId: caseRow.id,
        authorUserId: me.id,
        authorRole: me.role,
        body: input.body,
        patientVisible,
        createdBy: me.id,
      })
      .returning();
    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'create',
        resourceType: 'message',
        resourceId: row!.id,
        targetFacilityId: row!.facilityId,
        after: {
          caseId: row!.caseId,
          authorRole: row!.authorRole,
          patientVisible: row!.patientVisible,
          bodyLength: row!.body.length,
        },
      },
      meta(req),
    );
    return row!;
  }

  // ---- internals (mirrors CasesController scoping) ----

  private async visibleCaseIds(me: User): Promise<readonly string[] | null> {
    if (me.role === 'admin') return null;
    if (me.role === 'patient') {
      // Patient sees only their own case(s).
      const linked = await this.db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.userId, me.id));
      const patientIds = linked.map((r) => r.id);
      if (patientIds.length === 0) return [];
      const rows = await this.db
        .select({ id: cases.id })
        .from(cases)
        .where(inArray(cases.patientId, patientIds));
      return rows.map((r) => r.id);
    }
    const clauses: SQL[] = [];
    if (me.role === 'surgeon') clauses.push(eq(cases.surgeonId, me.id));
    else if (me.facilityId) clauses.push(eq(cases.facilityId, me.facilityId));
    else return [];
    const rows = await this.db
      .select({ id: cases.id })
      .from(cases)
      .where(and(...clauses));
    return rows.map((r) => r.id);
  }

  private async fetchCaseIfVisible(me: User, caseId: string) {
    const [row] = await this.db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!row) throw new NotFoundException(`case ${caseId} not found`);
    if (me.role === 'admin') return row;
    if (me.role === 'surgeon' && row.surgeonId !== me.id) {
      throw new ForbiddenException('case not visible');
    }
    if (
      (me.role === 'coordinator' || me.role === 'allied' || me.role === 'anesthesia') &&
      (!me.facilityId || row.facilityId !== me.facilityId)
    ) {
      throw new ForbiddenException('case not visible');
    }
    if (me.role === 'patient') {
      const [link] = await this.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.userId, me.id), eq(patients.id, row.patientId)))
        .limit(1);
      if (!link) throw new ForbiddenException('case not visible');
    }
    return row;
  }
}
