/**
 * Tasks — per-case workup checklist.
 *
 * Visibility model: tasks inherit case visibility. If a caller can see
 * the parent case (per CasesController.scopeFor), they can see its
 * tasks. We re-check visibility for every read.
 *
 * Mutation model:
 *   - Create: admin or coordinator (anyone can create on cases they
 *     can see, but typically the coordinator does the triage).
 *   - Update: anyone with case visibility can transition status. We
 *     don't gate by assignee here — surgeons mark their sign-offs done
 *     even if they weren't the original assigneeUserId, etc.
 *   - Delete: not exposed (use soft-delete via deletedAt later if
 *     needed; for now tasks are immutable once created).
 *
 * Convenience: `?mine=true` returns tasks where assigneeUserId = caller
 * OR assigneeRole = caller's role (and not yet assigned to anyone
 * specific).
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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, tasks, type Task, type User } from '../db/schema';
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
  type CreateTaskInput,
  type ListTasksQuery,
  type UpdateTaskInput,
} from '../admin/dto/admin.schemas';
import { ZodBodyPipe } from '../admin/zod-body.pipe';
import { ZodQueryPipe } from '../admin/zod-query.pipe';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied')
export class TasksController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

  @Get()
  @ApiOperation({ summary: 'List tasks (filter by case / status / role / mine)' })
  async list(
    @CurrentUserRow() me: User,
    @Query(new ZodQueryPipe(listTasksQuerySchema)) query: ListTasksQuery,
  ): Promise<{ items: readonly Task[]; limit: number; offset: number }> {
    // Case scope: a non-admin only sees tasks for cases visible to them.
    const visibleCaseIds = await this.visibleCaseIds(me);
    if (visibleCaseIds === null) {
      // admin: no case-id restriction
    } else if (visibleCaseIds.length === 0) {
      return { items: [], limit: query.limit, offset: query.offset };
    }

    const clauses: SQL[] = [];
    if (visibleCaseIds !== null) {
      clauses.push(inArray(tasks.caseId, [...visibleCaseIds]));
    }
    if (query.caseId) clauses.push(eq(tasks.caseId, query.caseId));
    if (query.status) clauses.push(eq(tasks.status, query.status));
    if (query.assigneeRole) clauses.push(eq(tasks.assigneeRole, query.assigneeRole));
    if (query.mine) {
      // Tasks that are mine: assigneeUserId = me OR (assigneeRole = my role
      // AND assigneeUserId IS NULL — i.e. unclaimed, available to my role).
      const mineClause = or(
        eq(tasks.assigneeUserId, me.id),
        and(eq(tasks.assigneeRole, me.role), isNull(tasks.assigneeUserId)),
      );
      if (mineClause) clauses.push(mineClause);
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(asc(tasks.dueDate), asc(tasks.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task on a case' })
  async create(
    @CurrentUserRow() me: User,
    @Body(new ZodBodyPipe(createTaskSchema)) input: CreateTaskInput,
  ): Promise<Task> {
    const caseRow = await this.fetchCaseIfVisible(me, input.caseId);
    const [row] = await this.db
      .insert(tasks)
      .values({
        facilityId: caseRow.facilityId,
        caseId: caseRow.id,
        title: input.title,
        description: input.description ?? null,
        assigneeRole: input.assigneeRole,
        assigneeUserId: input.assigneeUserId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdBy: me.id,
      })
      .returning();
    return row!;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task (status, assignment, due date)' })
  async update(
    @CurrentUserRow() me: User,
    @Param('id') id: string,
    @Body(new ZodBodyPipe(updateTaskSchema)) input: UpdateTaskInput,
  ): Promise<Task> {
    const [existing] = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) throw new NotFoundException(`task ${id} not found`);

    // Visibility: caller must be able to see the parent case.
    await this.fetchCaseIfVisible(me, existing.caseId);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if ('description' in input) patch.description = input.description ?? null;
    if (input.assigneeRole !== undefined) patch.assigneeRole = input.assigneeRole;
    if ('assigneeUserId' in input) patch.assigneeUserId = input.assigneeUserId ?? null;
    if ('dueDate' in input) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === 'done') {
        patch.completedAt = new Date();
        patch.completedBy = me.id;
      } else if (existing.status === 'done') {
        // Reopening — clear the completion stamps.
        patch.completedAt = null;
        patch.completedBy = null;
      }
    }

    const [row] = await this.db
      .update(tasks)
      .set(patch)
      .where(eq(tasks.id, id))
      .returning();
    return row!;
  }

  // ---- internals ----

  /** Return all case ids the user can see, or null for admin (no filter). */
  private async visibleCaseIds(me: User): Promise<readonly string[] | null> {
    if (me.role === 'admin') return null;
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
    return row;
  }
}
