/**
 * GET /admin/agents             — registry summary (agents + active prompt versions)
 * GET /admin/agents/runs        — paginated agent_runs list with filters
 *
 * Read-only for now. Prompt CRUD lands in M11.6.
 */
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, desc, eq, gte, type SQL } from 'drizzle-orm';
import { Roles } from '../auth/roles.decorator';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { agentRuns, agents, type AgentRun, type Agent } from '../db/schema';
import {
  listAgentRunsQuerySchema,
  type ListAgentRunsQuery,
} from './dto/admin.schemas';
import { ZodQueryPipe } from './zod-query.pipe';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/agents')
@Roles('admin')
export class AgentsAdminController {
  constructor(@Inject(DB_CLIENT) private readonly db: PrimedDb) {}

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
}
