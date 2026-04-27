/**
 * Eval harness types — agent-agnostic structure for golden tests.
 *
 * A fixture says: "for THIS agent, when given THIS input, the output
 * must (a) parse against the agent's own schema [implicit — it's the
 * agent's contract], (b) report this hitlStatus, and (c) NEVER contain
 * any of these forbidden phrases".
 *
 * We don't assert on exact output text — model variance ruins that.
 * Instead we assert on contract-level invariants the platform cares
 * about (hard-stop compliance, schema validity, presence of required
 * sections, absence of forbidden phrases).
 */
import type { AgentId } from '../agents/agent.interface';

export interface AgentFixture {
  /** Stable id for the fixture — used in the report. */
  readonly id: string;
  readonly agentId: AgentId;
  readonly description: string;
  /** AgentInput passed to .run(). */
  readonly input: {
    readonly triggerEvent: string;
    readonly payload: Record<string, unknown>;
  };
  /** CaseContext passed to .run(). */
  readonly ctx: {
    readonly caseId: string;
    readonly facilityId: string;
    readonly patientId: string;
    readonly procedureCode?: string;
    readonly procedureDescription?: string;
    readonly surgeonId?: string | null;
  };
  /** Expected hitlStatus from the agent. */
  readonly expectHitl: 'pending' | 'n_a';
  /**
   * Strings that MUST NOT appear (case-insensitive substring) in the
   * stringified output JSON. The dispatcher's hard-stops are the
   * authoritative gate, but eval double-checks what the model produced.
   */
  readonly forbiddenPhrases?: readonly string[];
  /**
   * Top-level keys that MUST be present in the output object.
   */
  readonly requiredOutputKeys?: readonly string[];
}

export interface FixtureResult {
  readonly fixtureId: string;
  readonly agentId: AgentId;
  readonly passed: boolean;
  readonly latencyMs: number;
  readonly stub: boolean;
  readonly hitlStatus: 'pending' | 'n_a' | string;
  readonly costUsdMicros: number;
  readonly failures: readonly string[];
}

export interface EvalReport {
  readonly startedAtIso: string;
  readonly endedAtIso: string;
  readonly totalFixtures: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly FixtureResult[];
}
