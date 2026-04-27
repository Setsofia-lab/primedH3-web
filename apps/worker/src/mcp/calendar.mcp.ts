/**
 * Calendar MCP server (stub).
 *
 * Exposes scheduling tools that the SchedulingAgent can call once
 * tool_use round-trips are wired (M16). Today the methods return
 * deterministic placeholder data so callers can be tested end-to-end
 * without an external calendar.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { MCPServer, MCPTool, MCPToolResult } from './types';

const TOOLS: readonly MCPTool[] = [
  {
    name: 'calendar.find_common_slots',
    description:
      'Find slots common to a surgeon and an OR room within a window. Returns a list of {startIso, endIso} candidates.',
    inputSchema: {
      type: 'object',
      properties: {
        surgeonId: { type: 'string' },
        durationMinutes: { type: 'integer', minimum: 30, maximum: 720 },
        earliestIso: { type: 'string' },
        latestIso: { type: 'string' },
        facilityRoomId: { type: 'string' },
      },
      required: ['surgeonId', 'durationMinutes', 'earliestIso', 'latestIso'],
      additionalProperties: false,
    },
  },
  {
    name: 'calendar.propose_slot',
    description: 'Persist a proposed slot for human approval. Does NOT book.',
    inputSchema: {
      type: 'object',
      properties: {
        caseId: { type: 'string' },
        startIso: { type: 'string' },
        endIso: { type: 'string' },
      },
      required: ['caseId', 'startIso', 'endIso'],
      additionalProperties: false,
    },
  },
];

@Injectable()
export class CalendarMcp implements MCPServer {
  private readonly logger = new Logger(CalendarMcp.name);

  readonly id = 'calendar';
  readonly name = 'Calendar MCP (stub)';

  listTools(): readonly MCPTool[] {
    return TOOLS;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const startedAt = Date.now();
    if (name === 'calendar.find_common_slots') {
      const earliest = new Date(String(args.earliestIso ?? new Date().toISOString()));
      const slots = [0, 7, 14].map((days) => {
        const start = new Date(earliest.getTime() + days * 24 * 3600 * 1000);
        start.setHours(8, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      });
      this.logger.log(`[stub] calendar.find_common_slots → ${slots.length} candidates`);
      return { ok: true, content: { slots }, latencyMs: Date.now() - startedAt };
    }
    if (name === 'calendar.propose_slot') {
      this.logger.log(`[stub] calendar.propose_slot recorded for case ${String(args.caseId)}`);
      return {
        ok: true,
        content: { proposedAt: new Date().toISOString(), bookingStatus: 'pending_human_approval' },
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
