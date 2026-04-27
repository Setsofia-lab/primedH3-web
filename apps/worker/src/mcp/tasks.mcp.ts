/**
 * Tasks MCP server.
 *
 * Read access to the case's task list (already in our DB) plus a
 * stub for "mirror to Asana". The TaskTrackerAgent uses the
 * dispatcher to call this once tool_use round-trips land (M16).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DB_CLIENT, type WorkerDb } from '../db/db.module';
import { tasks } from '../db/schema-ref';
import type { MCPServer, MCPTool, MCPToolResult } from './types';

const TOOLS: readonly MCPTool[] = [
  {
    name: 'tasks.list_open',
    description: 'List all open (non-done, non-soft-deleted) tasks for a case.',
    inputSchema: {
      type: 'object',
      properties: { caseId: { type: 'string' } },
      required: ['caseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'tasks.mirror_to_asana',
    description:
      'Push the case task list to the coordinator Asana project (stub: returns intended payload, no network call).',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        projectName: { type: 'string' },
      },
      required: ['caseId'],
      additionalProperties: false,
    },
  },
];

@Injectable()
export class TasksMcp implements MCPServer {
  private readonly logger = new Logger(TasksMcp.name);

  readonly id = 'tasks';
  readonly name = 'Tasks MCP';

  constructor(@Inject(DB_CLIENT) private readonly db: WorkerDb) {}

  listTools(): readonly MCPTool[] {
    return TOOLS;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const startedAt = Date.now();
    const caseId = String(args.caseId ?? '');
    if (!caseId) {
      return {
        ok: false,
        content: null,
        latencyMs: 0,
        errorMessage: 'caseId is required',
      };
    }

    if (name === 'tasks.list_open') {
      const rows = await this.db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          assigneeRole: tasks.assigneeRole,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(and(eq(tasks.caseId, caseId), isNull(tasks.deletedAt)));
      const open = rows.filter((r) => r.status !== 'done');
      return { ok: true, content: { items: open }, latencyMs: Date.now() - startedAt };
    }

    if (name === 'tasks.mirror_to_asana') {
      const projectName = String(args.projectName ?? `case-${caseId.slice(0, 8)}`);
      this.logger.log(`[stub] tasks.mirror_to_asana → project=${projectName}`);
      return {
        ok: true,
        content: {
          projectName,
          status: 'stubbed',
          note:
            'Asana token not yet provisioned; this MCP will perform the mirror once /primedhealth/<env>/asana/token is set in Secrets Manager.',
        },
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      ok: false,
      content: null,
      latencyMs: Date.now() - startedAt,
      errorMessage: `Unknown tool: ${name}`,
    };
  }
}
