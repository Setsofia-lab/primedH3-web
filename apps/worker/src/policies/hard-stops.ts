/**
 * Hard-stop policies (Constitution §5.3).
 *
 * Categorical guardrails that force a HITL hand-off for any agent
 * output that touches a clinical-decision boundary. The dispatcher
 * runs `applyHardStops(agentId, output)` after the model returns; if
 * any rule trips, the run is persisted with `hitlStatus = 'pending'`
 * and side-effects are skipped until a human approves.
 *
 * Rules are intentionally conservative: when in doubt, request review.
 * The reasons[] array is surfaced in the admin runs panel so reviewers
 * see why the run paused.
 */
import type { AgentId } from '../agents/agent.interface';

export interface HardStopVerdict {
  readonly hitlRequired: boolean;
  readonly reasons: readonly string[];
}

export interface HardStopRule {
  readonly id: string;
  readonly description: string;
  readonly appliesTo: readonly AgentId[] | 'all';
  readonly check: (output: Record<string, unknown>) => string | null;
}

/** Treat unknown values as plain JSON for shallow scanning. */
function flatten(obj: unknown, depth = 0): string {
  if (depth > 5 || obj == null) return '';
  if (typeof obj === 'string') return obj.toLowerCase();
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj).toLowerCase();
  if (Array.isArray(obj)) return obj.map((x) => flatten(x, depth + 1)).join(' ');
  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => `${k.toLowerCase()}=${flatten(v, depth + 1)}`)
      .join(' ');
  }
  return '';
}

/**
 * RULE 1 — patient clearance must come from a provider, never an agent.
 * Trips on output that asserts a patient is "cleared" / "approved for
 * surgery" / equivalent.
 */
const NEVER_AUTO_CLEAR_PATIENT: HardStopRule = {
  id: 'NEVER_AUTO_CLEAR_PATIENT',
  description:
    'Risk and anesthesia agents may recommend a clearance verdict but a human provider must confirm.',
  appliesTo: ['risk_screening', 'anesthesia_clearance'],
  check: (output) => {
    const haystack = flatten(output);
    // Be specific — "no clearance issues" is fine, "cleared" / "clearance: cleared" is not.
    if (
      /\bcleared\b/.test(haystack) ||
      /clearance=cleared/.test(haystack) ||
      /\bapproved for surgery\b/.test(haystack) ||
      /\bauto[-_ ]?cleared\b/.test(haystack)
    ) {
      return 'Output asserts a clearance verdict; provider must confirm before flipping case status.';
    }
    return null;
  },
};

/**
 * RULE 2 — outbound communication and referral letters never auto-send.
 * The agent drafts; a provider signs off.
 */
const NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF: HardStopRule = {
  id: 'NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF',
  description:
    'Referral / patient comms / documentation agents must produce drafts; sending requires a human signature.',
  appliesTo: ['referral', 'patient_comms', 'documentation'],
  check: (output) => {
    const haystack = flatten(output);
    if (
      /\bsent=true\b/.test(haystack) ||
      /status=sent\b/.test(haystack) ||
      /delivered=true\b/.test(haystack)
    ) {
      return 'Output marks outbound message as sent without provider signoff.';
    }
    return null;
  },
};

/**
 * RULE 3 — scheduling agents may propose slots but never auto-book.
 */
const NEVER_BOOK_WITHOUT_PROVIDER_APPROVAL: HardStopRule = {
  id: 'NEVER_BOOK_WITHOUT_PROVIDER_APPROVAL',
  description: 'Scheduling agent proposes slots; booking requires a coordinator/provider click.',
  appliesTo: ['scheduling'],
  check: (output) => {
    const haystack = flatten(output);
    if (
      /\bbooked=true\b/.test(haystack) ||
      /status=booked\b/.test(haystack) ||
      /confirmed=true\b/.test(haystack)
    ) {
      return 'Output marks a slot as booked without explicit provider approval.';
    }
    return null;
  },
};

/**
 * RULE 4 — universal: no medication prescriptions from any agent.
 */
const NEVER_PRESCRIBE_MEDICATION: HardStopRule = {
  id: 'NEVER_PRESCRIBE_MEDICATION',
  description: 'No agent may emit a medication prescription. Drug recommendations require provider review.',
  appliesTo: 'all',
  check: (output) => {
    const haystack = flatten(output);
    if (
      /\bprescription=/.test(haystack) ||
      /\bdispense=/.test(haystack) ||
      /\brx_signed\b/.test(haystack)
    ) {
      return 'Output appears to contain a prescription directive.';
    }
    return null;
  },
};

export const HARD_STOP_RULES: readonly HardStopRule[] = [
  NEVER_AUTO_CLEAR_PATIENT,
  NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF,
  NEVER_BOOK_WITHOUT_PROVIDER_APPROVAL,
  NEVER_PRESCRIBE_MEDICATION,
];

export function applyHardStops(
  agentId: AgentId,
  output: Record<string, unknown>,
): HardStopVerdict {
  const reasons: string[] = [];
  for (const rule of HARD_STOP_RULES) {
    const applies = rule.appliesTo === 'all' || rule.appliesTo.includes(agentId);
    if (!applies) continue;
    const verdict = rule.check(output);
    if (verdict) reasons.push(`[${rule.id}] ${verdict}`);
  }
  return { hitlRequired: reasons.length > 0, reasons };
}
