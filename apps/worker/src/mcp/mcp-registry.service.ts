/**
 * MCPRegistry — single read point for tool servers available to
 * agents. Servers register themselves at module-init; agents can
 * either ask for the full tool list (to attach to a Bedrock
 * tool_use payload) or call a specific tool directly.
 */
import { Injectable, Logger } from '@nestjs/common';
import { CalendarMcp } from './calendar.mcp';
import { EhrMcp } from './ehr.mcp';
import { TasksMcp } from './tasks.mcp';
import type { MCPServer, MCPTool, MCPToolResult } from './types';

@Injectable()
export class MCPRegistry {
  private readonly logger = new Logger(MCPRegistry.name);
  private readonly servers: Map<string, MCPServer>;

  constructor(
    private readonly calendar: CalendarMcp,
    private readonly tasks: TasksMcp,
    private readonly ehr: EhrMcp,
  ) {
    this.servers = new Map<string, MCPServer>([
      [calendar.id, calendar],
      [tasks.id, tasks],
      [ehr.id, ehr],
    ]);
    const total = [...this.servers.values()].reduce(
      (n, s) => n + s.listTools().length,
      0,
    );
    this.logger.log(
      `MCP registry online: ${this.servers.size} servers, ${total} tools`,
    );
  }

  /** Every tool from every server, namespaced by the tool's own name. */
  allTools(): readonly MCPTool[] {
    return [...this.servers.values()].flatMap((s) => s.listTools());
  }

  toolsForServer(serverId: string): readonly MCPTool[] {
    return this.servers.get(serverId)?.listTools() ?? [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    // Tool names are dot-namespaced ('calendar.find_common_slots').
    const serverId = name.split('.', 1)[0];
    const server = serverId ? this.servers.get(serverId) : undefined;
    if (!server) {
      return {
        ok: false,
        content: null,
        latencyMs: 0,
        errorMessage: `No MCP server registered for prefix '${serverId ?? ''}'`,
      };
    }
    return server.callTool(name, args);
  }
}
