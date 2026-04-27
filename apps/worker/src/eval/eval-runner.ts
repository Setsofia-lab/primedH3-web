/**
 * Eval runner — boots the worker's Nest context (without the SQS poller),
 * resolves each agent by id, runs every fixture, and prints a report.
 *
 * Usage:
 *   pnpm --filter @primedhealth/worker eval                  # run all fixtures
 *   pnpm --filter @primedhealth/worker eval -- intake_orchestrator  # filter
 *
 * Exit code is non-zero if any fixture failed → drop-in for CI.
 *
 * Requirements:
 *   - DATABASE_URL must be set (or DB_SECRET_ARN with AWS creds for the
 *     resolver to hydrate it). Readiness + TaskTracker query the DB.
 *   - AWS_BEDROCK_DISABLED=1 is recommended in dev/CI so fixtures
 *     exercise the deterministic stub path.
 *
 * Not part of the deployed runtime — tsconfig.build.json excludes
 * `src/eval/` so the Dockerfile's `dist/` doesn't ship the harness.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { resolveRuntimeSecrets } from '../config/secret-resolver';
import { AppModule } from '../app.module';
import { applyHardStops } from '../policies/hard-stops';
import { AgentDispatcherService } from '../agents/agent-dispatcher.service';
import { IntakeOrchestratorAgent } from '../agents/intake-orchestrator.agent';
import { RiskScreeningAgent } from '../agents/risk-screening.agent';
import { AnesthesiaClearanceAgent } from '../agents/anesthesia-clearance.agent';
import { SchedulingAgent } from '../agents/scheduling.agent';
import { ReferralAgent } from '../agents/referral.agent';
import { PatientCommsAgent } from '../agents/patient-comms.agent';
import { PreHabAgent } from '../agents/pre-hab.agent';
import { DocumentationAgent } from '../agents/documentation.agent';
import { TaskTrackerAgent } from '../agents/task-tracker.agent';
import { ReadinessAgent } from '../agents/readiness.agent';
import type { Agent, AgentId } from '../agents/agent.interface';
import { FIXTURES } from './fixtures';
import type { AgentFixture, EvalReport, FixtureResult } from './types';

async function main(): Promise<void> {
  // The eval runner needs DB access for ReadinessAgent + TaskTrackerAgent
  // (they query `tasks` / `agent_runs` directly). When DATABASE_URL is
  // unset locally, the resolver will warn and the agents will report
  // failures — that's the expected dev signal.
  await resolveRuntimeSecrets();

  const filterArg = process.argv[2];

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // Touch the dispatcher so its registry is initialised (the dispatcher
  // logs its own boot line when first instantiated).
  app.get(AgentDispatcherService);

  const agentClasses: Record<AgentId, new (...args: never[]) => Agent> = {
    intake_orchestrator: IntakeOrchestratorAgent,
    risk_screening: RiskScreeningAgent,
    anesthesia_clearance: AnesthesiaClearanceAgent,
    scheduling: SchedulingAgent,
    referral: ReferralAgent,
    patient_comms: PatientCommsAgent,
    pre_hab: PreHabAgent,
    documentation: DocumentationAgent,
    task_tracker: TaskTrackerAgent,
    readiness: ReadinessAgent,
  };

  const fixtures = filterArg
    ? FIXTURES.filter((f) => f.agentId === filterArg || f.id === filterArg)
    : FIXTURES;

  if (fixtures.length === 0) {
    console.error(`No fixtures matched filter '${filterArg ?? '<none>'}'`);
    process.exit(2);
  }

  const startedAtIso = new Date().toISOString();
  const startedAt = Date.now();
  const results: FixtureResult[] = [];

  for (const fix of fixtures) {
    const agent = app.get(agentClasses[fix.agentId]) as Agent;
    const result = await runFixture(fix, agent);
    results.push(result);
  }

  const endedAt = Date.now();
  const report: EvalReport = {
    startedAtIso,
    endedAtIso: new Date(endedAt).toISOString(),
    totalFixtures: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };

  printReport(report, endedAt - startedAt);
  await app.close();
  process.exit(report.failed > 0 ? 1 : 0);
}

async function runFixture(fix: AgentFixture, agent: Agent): Promise<FixtureResult> {
  const failures: string[] = [];
  const startedAt = Date.now();
  let hitlStatus: FixtureResult['hitlStatus'] = 'n_a';
  let stub = false;
  let costUsdMicros = 0;
  try {
    const result = await agent.run(fix.input, fix.ctx);
    hitlStatus = result.hitlStatus ?? 'n_a';
    stub = (result.output as { usedStub?: boolean }).usedStub ?? false;
    costUsdMicros = result.costUsdMicros ?? 0;

    // Hard-stops: applying them locally mirrors the dispatcher.
    const stops = applyHardStops(fix.agentId, result.output);
    const effectiveHitl = stops.hitlRequired ? 'pending' : hitlStatus;
    if (effectiveHitl !== fix.expectHitl) {
      failures.push(
        `expected hitlStatus=${fix.expectHitl} but got ${effectiveHitl} (raw=${hitlStatus}; hard-stop trips: ${stops.reasons.join(', ') || 'none'})`,
      );
    }

    const flat = JSON.stringify(result.output).toLowerCase();
    for (const phrase of fix.forbiddenPhrases ?? []) {
      if (flat.includes(phrase.toLowerCase())) {
        failures.push(`forbidden phrase "${phrase}" appeared in output`);
      }
    }
    for (const key of fix.requiredOutputKeys ?? []) {
      if (!(key in (result.output as Record<string, unknown>))) {
        failures.push(`required output key "${key}" missing`);
      }
    }
  } catch (err) {
    failures.push(`agent threw: ${(err as Error).message}`);
  }

  return {
    fixtureId: fix.id,
    agentId: fix.agentId,
    passed: failures.length === 0,
    latencyMs: Date.now() - startedAt,
    stub,
    hitlStatus,
    costUsdMicros,
    failures,
  };
}

function printReport(report: EvalReport, totalMs: number): void {
  /* eslint-disable no-console */
  const banner = report.failed === 0 ? 'OK' : 'FAILED';
  console.log('');
  console.log(`╭─ Eval ${banner} (${report.passed}/${report.totalFixtures}) — ${totalMs}ms`);
  for (const r of report.results) {
    const mark = r.passed ? '✔' : '✘';
    const stub = r.stub ? ' [stub]' : '';
    console.log(
      `│ ${mark} ${r.fixtureId.padEnd(40)} ${String(r.hitlStatus).padEnd(8)} ${r.latencyMs}ms${stub}`,
    );
    for (const f of r.failures) console.log(`│     – ${f}`);
  }
  console.log('╰─');
  /* eslint-enable no-console */
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('eval-runner failed:', err);
  process.exit(1);
});
