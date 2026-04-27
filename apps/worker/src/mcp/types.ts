/**
 * MCP — Model Context Protocol type definitions.
 *
 * We adopt Anthropic's MCP shape so that when we move tools out of the
 * worker process to dedicated network servers (M16+), agents need
 * minimal changes — just swap the in-process MCPServer for a
 * NetworkMCPClient.
 *
 * For now everything runs in-process and is exposed through
 * MCPRegistry; the dispatcher can ask the registry for available
 * tools to attach to a Bedrock InvokeModel call's `tool_use` payload.
 */

export interface JSONSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

export interface MCPTool {
  /** Stable, namespaced tool name (e.g. 'calendar.find_common_slots'). */
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JSONSchema;
}

export interface MCPToolResult {
  readonly ok: boolean;
  readonly content: unknown;
  readonly latencyMs: number;
  readonly errorMessage?: string;
}

export interface MCPServer {
  /** Stable id used for log correlation. Lowercase, no spaces. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;

  listTools(): readonly MCPTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
}
