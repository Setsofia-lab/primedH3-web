/**
 * Wire format the api publishes to SQS and the worker consumes.
 * Shared via @primedhealth/shared-types in M11.3 once we move the
 * schema there; for now both sides import from this file.
 */
import { z } from 'zod';

export const agentMessageSchema = z.object({
  /** UUID — primary key in the agent_runs table the worker will create. */
  runId: z.string().uuid(),
  /** Which agent should handle this message. */
  agentId: z.enum([
    'intake_orchestrator',
    'risk_screening',
    'anesthesia_clearance',
    'referral',
    'scheduling',
    'patient_comms',
    'pre_hab',
    'documentation',
    'task_tracker',
    'readiness',
  ]),
  /** Domain event that triggered this run, e.g. 'case.created'. */
  triggerEvent: z.string().min(1).max(64),
  /** Bedrock model id to use. May come from the prompt registry. */
  model: z.string().min(1).max(64).optional(),
  /** Optional override (otherwise the agent uses its default). */
  temperature: z.number().min(0).max(2).optional(),
  /** Pin to a specific prompt version; null/undefined → active version. */
  promptVersionId: z.string().uuid().optional(),
  /** What the run is about. */
  context: z.object({
    caseId: z.string().uuid(),
    facilityId: z.string().uuid(),
    patientId: z.string().uuid(),
    procedureCode: z.string().nullable().optional(),
    procedureDescription: z.string().nullable().optional(),
    surgeonId: z.string().uuid().nullable().optional(),
  }),
  /** Free-form payload from the originating event. */
  payload: z.record(z.string(), z.unknown()).default({}),
  /** Wallclock UTC ms — for fan-out tracing. */
  publishedAt: z.number().int(),
});

export type AgentMessage = z.infer<typeof agentMessageSchema>;
