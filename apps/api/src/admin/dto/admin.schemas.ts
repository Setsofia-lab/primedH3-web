/**
 * Zod schemas for admin endpoint bodies.
 *
 * Keep these in one file for now — the admin surface is small. Split
 * per-resource once we have 5+ endpoints.
 */
import { z } from 'zod';

export const createFacilitySchema = z.object({
  name: z.string().min(1).max(256),
  athenaPracticeId: z.string().min(1).max(32).optional(),
  timezone: z.string().min(1).max(64).default('America/New_York'),
});
export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

export const hydratePatientSchema = z.object({
  facilityId: z.string().uuid(),
  athenaResourceId: z.string().min(1),
  athenaPracticeId: z.string().optional(),
  force: z.boolean().optional(),
});
export type HydratePatientInput = z.infer<typeof hydratePatientSchema>;

export const listPatientsQuerySchema = z.object({
  facilityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export const caseStatusValues = [
  'referral',
  'workup',
  'clearance',
  'pre_hab',
  'ready',
  'completed',
  'cancelled',
] as const;

export const createCaseSchema = z.object({
  facilityId: z.string().uuid(),
  patientId: z.string().uuid(),
  surgeonId: z.string().uuid().optional(),
  coordinatorId: z.string().uuid().optional(),
  procedureCode: z.string().max(32).optional(),
  procedureDescription: z.string().max(2000).optional(),
  status: z.enum(caseStatusValues).optional(),
  // ISO-8601 date string — drizzle pgtable column is timestamptz
  surgeryDate: z.string().datetime().optional(),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const listCasesQuerySchema = z.object({
  facilityId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status: z.enum(caseStatusValues).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;

// Audit -----------------------------------------------------------

export const auditActionValues = [
  'create', 'update', 'delete', 'read', 'login', 'invite', 'hydrate', 'sign',
] as const;

export const listAuditQuerySchema = z.object({
  action: z.enum(auditActionValues).optional(),
  actorUserId: z.string().uuid().optional(),
  resourceType: z.string().min(1).max(32).optional(),
  resourceId: z.string().min(1).max(128).optional(),
  facilityId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

/**
 * Athena patient search — accepts the same parameter combinations Athena
 * accepts ([_id], [identifier], [name], [family,birthdate], [family,
 * gender], [family,given]). We don't pre-validate the combo here; if
 * the wrong mix lands at Athena it returns OperationOutcome 403 which
 * we surface unchanged.
 */
export const searchAthenaPatientsSchema = z.object({
  _id: z.string().optional(),
  identifier: z.string().optional(),
  name: z.string().optional(),
  family: z.string().optional(),
  given: z.string().optional(),
  birthdate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  practiceId: z.string().optional(),
});
export type SearchAthenaPatientsQuery = z.infer<typeof searchAthenaPatientsSchema>;

// Tasks ----------------------------------------------------------

export const taskStatusValues = ['pending', 'in_progress', 'done', 'blocked'] as const;
export const taskAssigneeRoleValues = [
  'admin', 'surgeon', 'anesthesia', 'coordinator', 'allied', 'patient',
] as const;

export const createTaskSchema = z.object({
  caseId: z.string().uuid(),
  title: z.string().min(1).max(256),
  description: z.string().max(4000).optional(),
  assigneeRole: z.enum(taskAssigneeRoleValues),
  assigneeUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(4000).nullable().optional(),
  status: z.enum(taskStatusValues).optional(),
  assigneeRole: z.enum(taskAssigneeRoleValues).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = z.object({
  caseId: z.string().uuid().optional(),
  status: z.enum(taskStatusValues).optional(),
  assigneeRole: z.enum(taskAssigneeRoleValues).optional(),
  mine: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

// Update case ----------------------------------------------------

export const updateCaseSchema = z.object({
  surgeonId: z.string().uuid().nullable().optional(),
  coordinatorId: z.string().uuid().nullable().optional(),
  procedureCode: z.string().max(32).nullable().optional(),
  procedureDescription: z.string().max(2000).nullable().optional(),
  status: z.enum(caseStatusValues).optional(),
  surgeryDate: z.string().datetime().nullable().optional(),
  readinessScore: z.number().int().min(0).max(100).nullable().optional(),
});
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export const userRoleValues = [
  'admin',
  'surgeon',
  'anesthesia',
  'coordinator',
  'allied',
  'patient',
] as const;

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(userRoleValues),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  facilityId: z.string().uuid().optional(),
  /**
   * When role === 'patient' and patientId is provided, the invite flow
   * links the new Cognito user to that already-mirrored patient row by
   * setting patients.user_id. Without the link, the patient logs in but
   * sees no case — so the admin form should always pair "patient invite"
   * with a patient-row pick.
   */
  patientId: z.string().uuid().optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const listUsersQuerySchema = z.object({
  role: z.enum(userRoleValues).optional(),
  facilityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
