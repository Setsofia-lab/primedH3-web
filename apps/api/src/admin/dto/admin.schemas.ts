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
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const listUsersQuerySchema = z.object({
  role: z.enum(userRoleValues).optional(),
  facilityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
