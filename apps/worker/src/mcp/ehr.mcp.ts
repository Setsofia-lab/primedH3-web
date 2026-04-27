/**
 * EHR MCP server (read-only, stub for now).
 *
 * Per ADR 0002 we are read-only against Athena. Once the api's Athena
 * client matures (M11.x) this MCP can either:
 *   (a) shell out to the api's `/internal/athena/*` endpoints, or
 *   (b) be hosted alongside the api.
 *
 * Today the methods return placeholder structures so callers can
 * exercise the protocol while we wait on the real wiring.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { MCPServer, MCPTool, MCPToolResult } from './types';

const TOOLS: readonly MCPTool[] = [
  {
    name: 'ehr.get_problem_list',
    description: 'Fetch the patient problem list (read-only Athena pull).',
    inputSchema: {
      type: 'object',
      properties: { patientId: { type: 'string' } },
      required: ['patientId'],
      additionalProperties: false,
    },
  },
  {
    name: 'ehr.get_active_medications',
    description: 'Fetch active medications. Returns names only — never doses.',
    inputSchema: {
      type: 'object',
      properties: { patientId: { type: 'string' } },
      required: ['patientId'],
      additionalProperties: false,
    },
  },
  {
    name: 'ehr.get_allergies',
    description: 'Fetch the allergy list.',
    inputSchema: {
      type: 'object',
      properties: { patientId: { type: 'string' } },
      required: ['patientId'],
      additionalProperties: false,
    },
  },
];

@Injectable()
export class EhrMcp implements MCPServer {
  private readonly logger = new Logger(EhrMcp.name);

  readonly id = 'ehr';
  readonly name = 'EHR MCP (read-only stub)';

  listTools(): readonly MCPTool[] {
    return TOOLS;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const startedAt = Date.now();
    const patientId = String(args.patientId ?? '');
    if (!patientId) {
      return {
        ok: false,
        content: null,
        latencyMs: 0,
        errorMessage: 'patientId is required',
      };
    }

    // Stubbed responses — real Athena pulls land in M16 once the api
    // exposes /internal/athena/* endpoints scoped to the worker.
    this.logger.log(`[stub] ${name} for patient ${patientId.slice(0, 8)}`);
    if (name === 'ehr.get_problem_list') {
      return {
        ok: true,
        content: { items: [], stub: true, note: 'Athena pull pending; returns empty list.' },
        latencyMs: Date.now() - startedAt,
      };
    }
    if (name === 'ehr.get_active_medications') {
      return {
        ok: true,
        content: { items: [], stub: true, note: 'Names only when wired; never doses.' },
        latencyMs: Date.now() - startedAt,
      };
    }
    if (name === 'ehr.get_allergies') {
      return {
        ok: true,
        content: { items: [], stub: true },
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
