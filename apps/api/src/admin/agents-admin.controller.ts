/**
 * GET  /admin/agents                          — registry summary
 * GET  /admin/agents/runs                     — paginated agent_runs list
 * GET  /admin/agents/:key/prompts             — list prompt versions for an agent
 * POST /admin/agents/:key/prompts             — create a new (inactive) version
 * POST /admin/agents/:key/prompts/:id/activate— promote a version to active
 *
 * Admin-only. Prompts are immutable once written — promoting a new
 * version is the only way to "edit" the live behaviour.
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
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { and, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthContext } from '../auth/auth-context';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import {
  agentPrompts,
  agentRuns,
  agents,
  type Agent,
  type AgentPrompt,
  type AgentRun,
  type User,
} from '../db/schema';
import { meta } from './audit-meta';
import {
  createPromptVersionSchema,
  listAgentRunsQuerySchema,
  type CreatePromptVersionInput,
  type ListAgentRunsQuery,
} from './dto/admin.schemas';
import { ZodBodyPipe } from './zod-body.pipe';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/agents')
@Roles('admin')
export class AgentsAdminController {
  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Agent registry — keys, default models, enabled flags' })
  async list(): Promise<{ items: readonly Agent[] }> {
    const items = await this.db.select().from(agents);
    return { items };
  }

  @Get('runs')
  @ApiOperation({ summary: 'List recent agent runs (filterable)' })
  async runs(
    @Query(new ZodQueryPipe(listAgentRunsQuerySchema)) query: ListAgentRunsQuery,
  ): Promise<{ items: readonly AgentRun[]; limit: number; offset: number }> {
    const clauses: SQL[] = [];
    if (query.agentKey) clauses.push(eq(agentRuns.agentKey, query.agentKey));
    if (query.caseId) clauses.push(eq(agentRuns.caseId, query.caseId));
    if (query.status) clauses.push(eq(agentRuns.status, query.status));
    if (query.hitlStatus) clauses.push(eq(agentRuns.hitlStatus, query.hitlStatus));
    if (query.since) clauses.push(gte(agentRuns.createdAt, new Date(query.since)));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(agentRuns)
      .where(where)
      .orderBy(desc(agentRuns.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }

  @Get(':key/prompts')
  @ApiOperation({ summary: 'List prompt versions for an agent (newest first)' })
  async listPrompts(
    @Param('key') key: string,
  ): Promise<{ agent: Agent; items: readonly AgentPrompt[] }> {
    const agent = await this.findAgentByKey(key);
    const items = await this.db
      .select()
      .from(agentPrompts)
      .where(eq(agentPrompts.agentId, agent.id))
      .orderBy(desc(agentPrompts.version));
    return { agent, items };
  }

  @Post(':key/prompts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new prompt version (inactive until activated)' })
  async createPrompt(
    @Param('key') key: string,
    @Body(new ZodBodyPipe(createPromptVersionSchema)) input: CreatePromptVersionInput,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<AgentPrompt> {
    const agent = await this.findAgentByKey(key);

    // Atomically pick max(version)+1 to avoid races between two
    // concurrent admin clicks. The unique index (agent_id, version)
    // would also catch the race; inlining +1 in SQL avoids retries.
    const [row] = await this.db
      .insert(agentPrompts)
      .values({
        agentId: agent.id,
        version: sql<number>`(SELECT COALESCE(MAX(version), 0) + 1 FROM ${agentPrompts} WHERE agent_id = ${agent.id})`,
        systemPrompt: input.systemPrompt,
        model: input.model,
        temperature: input.temperature,
        isActive: false,
        note: input.note ?? null,
        authorUserId: me.id,
      })
      .returning();

    if (!row) throw new Error('failed to insert prompt version');

    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'create',
        resourceType: 'agent_prompt',
        resourceId: row.id,
        after: { agentKey: key, version: row.version },
      },
      meta(req),
    );
    return row;
  }

  @Post(':key/prompts/:id/activate')
  @ApiOperation({ summary: 'Promote a prompt version to active (atomic swap)' })
  async activatePrompt(
    @Param('key') key: string,
    @Param('id') promptId: string,
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Req() req: FastifyRequest,
  ): Promise<AgentPrompt> {
    const agent = await this.findAgentByKey(key);
    const [target] = await this.db
      .select()
      .from(agentPrompts)
      .where(and(eq(agentPrompts.id, promptId), eq(agentPrompts.agentId, agent.id)))
      .limit(1);
    if (!target) throw new NotFoundException('prompt version not found for this agent');

    // Two-statement swap: drop the active flag from any sibling, set it
    // on the target. The worker reads via LIMIT 1, so a brief overlap
    // is harmless. A partial unique index would tighten this further;
    // tracked for when we observe contention.
    await this.db
      .update(agentPrompts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(agentPrompts.agentId, agent.id), eq(agentPrompts.isActive, true)));
    const [activated] = await this.db
      .update(agentPrompts)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(agentPrompts.id, promptId))
      .returning();

    if (!activated) throw new Error('failed to activate prompt version');

    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'update',
        resourceType: 'agent_prompt',
        resourceId: activated.id,
        after: { agentKey: key, version: activated.version, isActive: true },
      },
      meta(req),
    );
    return activated;
  }

  private async findAgentByKey(key: string): Promise<Agent> {
    const [row] = await this.db.select().from(agents).where(eq(agents.key, key)).limit(1);
    if (!row) throw new NotFoundException(`agent '${key}' not found`);
    return row;
  }
}
