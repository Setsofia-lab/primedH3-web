/**
 * Drizzle schema exports.
 *
 * Core entities for M4 (Constitution §6):
 *   facilities, users, patients, cases
 *
 * Added in M5 (Athena integration, per ADR 0002 read-only mirror):
 *   appointments (+ Athena-mirror columns on patients)
 *
 * Remaining entities ship with their resource cutover in M7:
 *   procedures, consults, referrals, tasks, messages, documents,
 *   assessments, agent_runs, agent_prompt_versions, audit_events.
 */
export * from './base';
export * from './facilities';
export * from './users';
export * from './patients';
export * from './appointments';
export * from './cases';
export * from './tasks';
export * from './audit-events';
export * from './messages';
export * from './documents';
export * from './agents';
