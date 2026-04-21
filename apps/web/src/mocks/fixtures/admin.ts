/* PrimedHealth — synthetic fixtures (NO real PHI).
   Ported 1:1 from /Users/samuelsetsofia/primedHV2/agents/fixtures.js
   with the SchedulingAgent removed (per product feedback). */

export type CaseStatus = 'cleared' | 'conditional' | 'workup' | 'deferred';

export interface PatientFixture {
  id: string;
  name: string;
  initials: string;
  age: number;
  procedure: string;
  procedureCode: string;
  surgeryDate: string;
  surgeon: string;
  asa: number;
  readiness: number;
  status: CaseStatus;
  conditions: string[];
  medications: string[];
}

export type UserRole = 'admin' | 'surgeon' | 'anesthesia' | 'coordinator';
export interface UserFixture {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  email: string;
  initials: string;
  status: 'active' | 'invited';
  lastActive: string;
  cases: number | null;
}

export interface AgentFixture {
  id: string;
  name: string;
  model: string;
  temperature: number;
  status: 'healthy' | 'degraded';
  runs24h: number;
  p50: number;
  description: string;
}

export type AuditActorType = 'agent' | 'human';
export interface AuditEventFixture {
  ts: number; // ms epoch (relative to "now" so the log feels live)
  actor: string;
  actorType: AuditActorType;
  action: string;
  target: string;
  result: string;
}

export interface PromptFixture {
  id: string;
  name: string;
  agent: string;
  version: number;
  updatedBy: string;
  updatedAt: string;
  description: string;
}

export const PATIENTS: PatientFixture[] = [
  { id: 'pt_alex_rivera',  name: 'Alex Rivera',  initials: 'AR', age: 47, procedure: 'Laparoscopic cholecystectomy', procedureCode: '47562', surgeryDate: '2026-04-28', surgeon: 'Dr. Oduya', asa: 2, readiness: 82, status: 'conditional', conditions: ['HTN, controlled', 'Former smoker (quit 2019)'], medications: ['Lisinopril 10mg daily'] },
  { id: 'pt_jordan_park',  name: 'Jordan Park',  initials: 'JP', age: 62, procedure: 'Total knee arthroplasty',     procedureCode: '27447', surgeryDate: '2026-05-02', surgeon: 'Dr. Oduya', asa: 2, readiness: 95, status: 'cleared',     conditions: ['OA, bilateral knees', 'BMI 29.1'], medications: ['Acetaminophen 500mg PRN', 'Meloxicam 15mg daily'] },
  { id: 'pt_maya_khan',    name: 'Maya Khan',    initials: 'MK', age: 34, procedure: 'Inguinal hernia repair',       procedureCode: '49505', surgeryDate: '2026-05-05', surgeon: 'Dr. Oduya', asa: 1, readiness: 60, status: 'workup',      conditions: ['Otherwise healthy'], medications: ['None'] },
  { id: 'pt_daniel_shaw',  name: 'Daniel Shaw',  initials: 'DS', age: 71, procedure: 'Tonsillectomy',                procedureCode: '42826', surgeryDate: '2026-05-10', surgeon: 'Dr. Oduya', asa: 3, readiness: 35, status: 'deferred',    conditions: ['CAD s/p CABG 2020', 'Type 2 DM (HbA1c 8.4)', 'OSA, untreated'], medications: ['Metformin 1000mg BID', 'Aspirin 81mg', 'Metoprolol 25mg BID'] },
  { id: 'pt_nora_bright',  name: 'Nora Bright',  initials: 'NB', age: 41, procedure: 'Thyroidectomy',                procedureCode: '60240', surgeryDate: '2026-05-14', surgeon: 'Dr. Oduya', asa: 2, readiness: 70, status: 'workup',      conditions: ['Papillary thyroid CA', 'Levothyroxine-dependent'], medications: ['Levothyroxine 125mcg daily'] },
];

export const USERS: UserFixture[] = [
  { id: 'u_admin_01', name: 'Dr. Rhea Malhotra', role: 'admin',       roleLabel: 'Health-center admin',  email: 'rhea.malhotra@bayview.demo', initials: 'RM', status: 'active',  lastActive: '2 min ago',  cases: null },
  { id: 'u_surg_01',  name: 'Dr. Marcus Oduya',  role: 'surgeon',     roleLabel: 'Surgeon · General',    email: 'm.oduya@bayview.demo',       initials: 'MO', status: 'active',  lastActive: '12 min ago', cases: 24 },
  { id: 'u_surg_02',  name: 'Dr. Lena Voss',     role: 'surgeon',     roleLabel: 'Surgeon · Orthopedics',email: 'l.voss@bayview.demo',        initials: 'LV', status: 'active',  lastActive: '1 h ago',    cases: 18 },
  { id: 'u_surg_03',  name: 'Dr. Ken Tanaka',    role: 'surgeon',     roleLabel: 'Surgeon · ENT',        email: 'k.tanaka@bayview.demo',      initials: 'KT', status: 'active',  lastActive: '3 h ago',    cases: 11 },
  { id: 'u_anes_01',  name: 'Dr. Saira Chen',    role: 'anesthesia',  roleLabel: 'Anesthesiologist',     email: 's.chen@bayview.demo',        initials: 'SC', status: 'active',  lastActive: 'just now',   cases: null },
  { id: 'u_anes_02',  name: 'Dr. Ben Auer',      role: 'anesthesia',  roleLabel: 'Anesthesiologist',     email: 'b.auer@bayview.demo',        initials: 'BA', status: 'active',  lastActive: '28 min ago', cases: null },
  { id: 'u_coord_01', name: 'Priya Okafor, RN',  role: 'coordinator', roleLabel: 'Care coordinator',     email: 'p.okafor@bayview.demo',      initials: 'PO', status: 'active',  lastActive: '5 min ago',  cases: 42 },
  { id: 'u_coord_02', name: 'Dana Lima, RN',     role: 'coordinator', roleLabel: 'Care coordinator',     email: 'd.lima@bayview.demo',        initials: 'DL', status: 'invited', lastActive: '—',          cases: 0 },
  { id: 'u_coord_03', name: 'Rico Vega, RN',     role: 'coordinator', roleLabel: 'Care coordinator',     email: 'r.vega@bayview.demo',        initials: 'RV', status: 'active',  lastActive: '17 min ago', cases: 38 },
];

/* SchedulingAgent intentionally dropped (deferred offering — own complex domain). */
export const AGENTS: AgentFixture[] = [
  { id: 'agt_intake',     name: 'IntakeOrchestrator',  model: 'claude-sonnet-4-5', temperature: 0.2, status: 'healthy',  runs24h: 412, p50: 2.1, description: 'Parses surgeon-submitted referrals and builds the case workup plan.' },
  { id: 'agt_clearance',  name: 'AnesthesiaClearance', model: 'claude-opus-4-5',   temperature: 0.1, status: 'healthy',  runs24h: 143, p50: 5.2, description: 'Drafts the pre-anesthesia note with cited guidelines for clinician review.' },
  { id: 'agt_documentation', name: 'DocumentationAgent', model: 'claude-sonnet-4-5', temperature: 0.1, status: 'healthy', runs24h: 198, p50: 3.8, description: 'Drafts H&Ps from Athena chart pulls; posts back via Athena MCP.' },
  { id: 'agt_referral',   name: 'ReferralAgent',       model: 'claude-sonnet-4-5', temperature: 0.3, status: 'healthy',  runs24h: 198, p50: 3.1, description: 'Finds specialists, drafts referral letters, tracks response SLAs.' },
  { id: 'agt_comms',      name: 'PatientCommsAgent',   model: 'claude-sonnet-4-5', temperature: 0.4, status: 'healthy',  runs24h: 188, p50: 2.4, description: 'Drafts SMS/email nudges at reading-level 6 in patient\u2019s preferred language.' },
  { id: 'agt_readiness',  name: 'ReadinessAgent',      model: 'claude-sonnet-4-5', temperature: 0.0, status: 'healthy',  runs24h: 524, p50: 0.8, description: 'Continuously recomputes the patient-facing 0\u2013100 readiness score.' },
  { id: 'agt_prehab',     name: 'PreHabAgent',         model: 'claude-haiku-4-5',  temperature: 0.2, status: 'healthy',  runs24h: 74,  p50: 1.2, description: 'Prescribes and tracks pre-hab regimen; nudges adherence.' },
  { id: 'agt_tasks',      name: 'TaskTrackerAgent',    model: 'claude-haiku-4-5',  temperature: 0.0, status: 'healthy',  runs24h: 312, p50: 0.9, description: 'Maintains the coordinator board; routes exceptions to humans.' },
  { id: 'agt_risk',       name: 'RiskScreeningAgent',  model: 'claude-opus-4-5',   temperature: 0.1, status: 'degraded', runs24h: 287, p50: 4.8, description: 'Computes ASA class, RCRI, STOP-BANG; flags deferral conditions.' },
];

/* Audit timestamps are relative to import time, refreshed each session. */
const T_NOW = Date.now();
export const AUDIT: AuditEventFixture[] = [
  { ts: T_NOW - 60_000,    actor: 'AnesthesiaClearance', actorType: 'agent', action: 'drafted.pre_op_note',    target: 'case/pt_alex_rivera',  result: 'pending_review' },
  { ts: T_NOW - 180_000,   actor: 'Dr. Saira Chen',      actorType: 'human', action: 'signed.clearance',       target: 'case/pt_jordan_park',  result: 'approved' },
  { ts: T_NOW - 420_000,   actor: 'ReferralAgent',       actorType: 'agent', action: 'sent.referral',          target: 'provider/cardio_lin',  result: 'delivered' },
  { ts: T_NOW - 600_000,   actor: 'TaskTrackerAgent',    actorType: 'agent', action: 'moved.card',             target: 'case/pt_daniel_shaw',  result: 'workup_to_clearance' },
  { ts: T_NOW - 900_000,   actor: 'PatientCommsAgent',   actorType: 'agent', action: 'drafted.sms',            target: 'patient/pt_maya_khan', result: 'pending_review' },
  { ts: T_NOW - 1_320_000, actor: 'Priya Okafor, RN',    actorType: 'human', action: 'approved.sms',           target: 'patient/pt_maya_khan', result: 'sent' },
  { ts: T_NOW - 1_800_000, actor: 'Dr. Marcus Oduya',    actorType: 'human', action: 'signed.h_and_p',         target: 'case/pt_alex_rivera',  result: 'approved' },
  { ts: T_NOW - 2_400_000, actor: 'DocumentationAgent',  actorType: 'agent', action: 'requested.labs',         target: 'case/pt_nora_bright',  result: 'awaiting_fax' },
  { ts: T_NOW - 3_000_000, actor: 'IntakeOrchestrator',  actorType: 'agent', action: 'opened.case',            target: 'case/pt_daniel_shaw',  result: 'workup_started' },
  { ts: T_NOW - 3_600_000, actor: 'Dr. Rhea Malhotra',   actorType: 'human', action: 'updated.prompt',         target: 'agent/agt_risk',       result: 'version 14' },
  { ts: T_NOW - 4_500_000, actor: 'ReadinessAgent',      actorType: 'agent', action: 'recomputed.score',       target: 'case/pt_alex_rivera',  result: 'sent' },
  { ts: T_NOW - 5_400_000, actor: 'PreHabAgent',         actorType: 'agent', action: 'nudged.exercise',        target: 'patient/pt_jordan_park', result: 'delivered' },
];

export const PROMPTS: PromptFixture[] = [
  { id: 'pmt_pre_op',       name: 'Pre-anesthesia note',     agent: 'AnesthesiaClearance', version: 14, updatedBy: 'Dr. Rhea Malhotra', updatedAt: '2h ago', description: 'Structured pre-op note with ASA, airway, co-morbidities, cited guidelines.' },
  { id: 'pmt_risk_summary', name: 'Risk summary',            agent: 'RiskScreeningAgent',  version: 9,  updatedBy: 'Dr. Saira Chen',    updatedAt: '1d ago', description: 'ASA + RCRI + STOP-BANG roll-up for surgeon cockpit.' },
  { id: 'pmt_referral',     name: 'Specialist referral',     agent: 'ReferralAgent',       version: 6,  updatedBy: 'Priya Okafor, RN',  updatedAt: '3d ago', description: 'Cover letter, clinical question, relevant workup attached.' },
  { id: 'pmt_sms_nudge',    name: 'Patient SMS \u2014 nudge',agent: 'PatientCommsAgent',   version: 22, updatedBy: 'Priya Okafor, RN',  updatedAt: '4h ago', description: 'Reading-level 6, max 160 chars, includes deep link.' },
  { id: 'pmt_h_and_p',      name: 'H&P draft',               agent: 'DocumentationAgent',  version: 11, updatedBy: 'Dr. Marcus Oduya',  updatedAt: '6h ago', description: 'Pulled from Athena; structured note for surgeon review.' },
  { id: 'pmt_readiness',    name: 'Readiness recomputation', agent: 'ReadinessAgent',      version: 31, updatedBy: 'Dr. Rhea Malhotra', updatedAt: '5d ago', description: 'Weighted formula across labs, consults, sign-offs, patient tasks.' },
];

export function patientById(id: string) {
  return PATIENTS.find((p) => p.id === id);
}
export function patientByName(name: string) {
  return PATIENTS.find((p) => p.name === name);
}
