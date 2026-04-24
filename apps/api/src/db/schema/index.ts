/**
 * Drizzle schema exports.
 *
 * Core entities for M4 (Constitution §6):
 *   facilities, users, patients, cases
 *
 * Remaining entities ship with their resource cutover in M7:
 *   procedures, consults, referrals, tasks, messages, documents,
 *   appointments, assessments, agent_runs, agent_prompt_versions,
 *   audit_events.
 */
export * from './base';
export * from './facilities';
export * from './users';
export * from './patients';
export * from './cases';
