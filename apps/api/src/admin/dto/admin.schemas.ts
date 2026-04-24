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
