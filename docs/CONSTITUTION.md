# PRIMEDHEALTH — PROJECT CONSTITUTION

> Single source of truth for building the PrimedHealth MVP end-to-end.
> Read this file first, before every new task, and whenever context is lost.
> This document is authoritative. If a request conflicts with it, stop and ask.

---

## 0. HOW TO USE THIS DOCUMENT

This constitution is written to be consumed by two different Claude workflows:

- **Phase 1 → Claude (design-led workflow).** Use Claude in a design/artifact-driven loop to generate the full UI, component library, page flows, and interactive mocks. Deliverables are a running Next.js app with **mocked** data only — no backend, no DB, no real auth.
- **Phase 2 & 3 → Claude Code (terminal / IDE).** Switch to Claude Code for all infrastructure, backend, CI/CD, Athena integration, and agent orchestration work. Claude Code gets CLI access to GitHub, Vercel, and AWS as specified in §10.

Every phase has a **hard gate** at the end: do not start the next phase until the acceptance criteria in §11 are met and the user explicitly says "proceed."

### Working rules for Claude / Claude Code

1. **Spec-first, code-second.** For any new feature, produce a short spec (user story, acceptance criteria, components touched, mock data shape) and get confirmation before coding.
2. **Small PRs.** One vertical slice per branch. Never mix refactors and features.
3. **Types everywhere.** TypeScript strict mode. No `any` without a comment explaining why.
4. **Mocks live behind a seam.** Every data call in Phase 1 goes through a `services/` layer so Phase 2 can swap implementations without touching components.
5. **Tests are part of done.** Unit tests for logic, Playwright smoke for each user journey, Storybook for every shared component.
6. **Ask before installing.** No new npm dependency without justification in the PR description.
7. **Never invent clinical content.** All medical copy (risk thresholds, ASA descriptions, pre-op instructions) must be flagged `// TODO: clinical review` and sourced from cited guidelines (ACS NSQIP, ASA, AAGBI, ERAS) where possible.

---

## 1. PRODUCT MISSION

### 1.1 Vision
PrimedHealth is a unified, AI-orchestrated perioperative platform that turns the messy, fragmented pre-surgical process into a single coordinated workflow. We replace phone tag, fax chains, and spreadsheet tracking with an agent-driven system that keeps surgeons, anesthesiologists, care coordinators, and patients aligned from the moment surgery is indicated until the patient is on the operating table.

### 1.2 Problem statement
Perioperative coordination today is the leading preventable cause of surgical cancellations, delays, and avoidable complications. A typical pre-op pathway involves 8–15 hand-offs between roles, each introducing latency, omission, and duplication. Incomplete consults, missed anesthesia clearances, and un-optimized patients cost U.S. health systems billions per year and cost patients avoidable harm.

### 1.3 Solution in one sentence
An agentic workflow layer on top of the EHR that automates the repetitive coordination work — risk screening, consult referrals, clearance chasing, patient education, pre-hab tracking, and team scheduling — while keeping every human provider in the loop for every clinical decision.

### 1.4 Primary users
- **Health Center Admin** — onboards the facility, monitors utilization, audits agent activity, edits agent configuration.
- **Surgeon** — opens a case, reviews AI-prepared workup, signs off on readiness.
- **Anesthesiologist / Anesthesia PA** — reviews auto-generated risk assessments, clears patient, flags concerns.
- **Care Coordinator / Nurse Navigator** — orchestrates the patient journey, owns task board, handles exceptions the agents escalate.
- **Pre-hab / Allied Clinician** (PT, nutrition, cardiology referral) — receives referrals, reports progress back.
- **Patient** — mobile-first experience; the **connector** across every provider. Completes forms, uploads documents, reads instructions, tracks readiness score, messages the team.

### 1.5 Success metrics (how we know we win)
- Time-to-surgical-readiness reduced by ≥ 40% vs. baseline.
- Same-day cancellation rate reduced by ≥ 50%.
- Provider time on coordination tasks reduced by ≥ 30%.
- Patient-reported clarity and confidence scores ≥ 4.5/5.
- Agent task completion rate ≥ 95% with < 2% escalations-per-case.

### 1.6 Non-goals (explicitly out of scope for MVP)
- Intra-op anesthesia record-keeping.
- Post-op / discharge workflow (Phase 4+).
- Billing, coding, or RCM.
- Direct imaging or lab ordering (we refer through Athena, we don't replace orders).
- Clinical decision support that autonomously alters a treatment plan without human sign-off.

---

## 2. DESIGN SYSTEM

Extracted from the provided landing page screenshots. Claude must treat this section as binding style tokens.

### 2.1 Color palette

```
--primary-blue:     #4B6BEF   /* Primed Health brand blue (logo, links, underlines) */
--primary-blue-600: #3B55D9   /* hover / pressed */
--primary-blue-50:  #EEF2FE   /* subtle fills */

--accent-indigo:    #4F46E5   /* primary CTA ("Book a Meeting") */
--accent-indigo-600:#4338CA

--ink-900:          #0A1628   /* headings, dark CTAs, footer bg */
--ink-700:          #1F2A44   /* body heading */
--ink-500:          #4A5878   /* body text */
--ink-400:          #6B7895   /* secondary text */
--ink-300:          #A3ADC4   /* muted / placeholder */

--surface-0:        #FFFFFF   /* pure white cards */
--surface-50:       #F5F7FE   /* page background (soft lavender-white) */
--surface-100:      #EEF1FA   /* section alt */
--card-blue-50:     #DCE7FF   /* light card fill (see Services tile) */
--card-blue-100:    #C9D8FF

--success:          #10B981
--warning:          #F59E0B
--danger:           #EF4444
--info:             #3B82F6

--border:           #E4E8F5
--focus-ring:       #4B6BEF66
```

### 2.2 Typography

- **Headings:** `Fraunces` (Google Fonts) — a modern transitional serif with a distinctive italic; matches the "Perioperative Coordination made *seamless*" hero exactly. Fallback: `Instrument Serif`, then `Georgia, serif`.
- **Body / UI:** `Inter` (Google Fonts) at 400/500/600. Fallback: `system-ui, -apple-system, sans-serif`.
- **Monospace (dashboards, code, IDs):** `JetBrains Mono` or `Geist Mono`.

Type scale (rem, mobile-first, scales up at `md:` breakpoint):

```
display:  3.5 → 5.0      /* hero */
h1:       2.25 → 3.0
h2:       1.75 → 2.25
h3:       1.375 → 1.625
body-lg:  1.125
body:     1.0
small:    0.875
caption:  0.75
```

Headings use Fraunces with `font-feature-settings: "ss01", "cv11"`; italic variant is used for emphasis words, *never* for full paragraphs.

### 2.3 Spacing, radius, elevation
- Base spacing unit: `4px`. Use Tailwind's scale.
- Radii: `sm 6px`, `md 10px`, `lg 14px`, `xl 20px`, `2xl 28px`. Cards use `xl`, pills use `full`.
- Shadows: one soft `shadow-sm` (`0 1px 2px rgba(10,22,40,0.04)`) and one `shadow-lg` (`0 8px 24px rgba(10,22,40,0.08)`). No harsh drop shadows.
- Floating nav bar (as in screenshot 2): `surface-0` pill with `shadow-sm` and ~16px horizontal padding.

### 2.4 Components (shadcn/ui baseline)
Initialize `shadcn/ui` with the tokens above mapped into `tailwind.config.ts`. Required primitives: Button, Input, Textarea, Select, Dialog, Sheet, Tabs, Card, Badge, Avatar, Toast, Tooltip, DropdownMenu, Command, Progress, Skeleton, Table, Calendar, Popover.

### 2.5 Voice & tone
- **Clinical but human.** Never cutesy. Never alarmist.
- **Action-oriented.** Buttons are verbs: "Clear for surgery", "Assign coordinator", "Send to PT".
- **Transparency about AI.** Every agent-generated item carries a subtle "AI-drafted • review before sending" badge.

---

## 3. USER TYPES, JOURNEYS & SCREENS

Research references for the clinical workflow: ACS NSQIP Surgical Risk Calculator, ASA Physical Status Classification, ERAS Society pre-op protocols, AAGBI pre-op assessment guidelines, Joint Commission Universal Protocol. All clinical content must be reviewable against these.

### 3.1 Admin / Health Center (desktop)
Purpose: onboard the facility, monitor all users and cases, audit agents.

Screens:
- `/admin/onboarding` — facility registration, role invites, EHR (Athena) connection placeholder.
- `/admin/dashboard` — utilization tiles (active cases, cases at risk, avg time-to-clearance, cancellation rate), real-time activity feed, agent health panel.
- `/admin/users` — table of all providers and patients, status, last activity.
- `/admin/cases` — master list of all surgical cases across the facility, filter by service line, surgeon, status.
- `/admin/agents` — list of agents with run history, success rate, avg latency, token cost (Phase 3 real, Phase 1 mocked). Edit prompt, model, temperature inline.
- `/admin/audit` — immutable log of every agent action and every human override.

### 3.2 Surgeon (desktop / tablet)
- `/cases` — my cases, sortable by surgery date and readiness score.
- `/cases/[id]` — one-page surgical readiness cockpit: patient summary, ASA, NSQIP risk, outstanding consults, labs, imaging, agent-drafted H&P, sign-off button.
- `/cases/new` — open a new case; an intake agent suggests required workup based on procedure code.

### 3.3 Anesthesiologist (desktop / tablet)
- `/anesthesia/queue` — prioritized list of pending clearances, color-coded by risk.
- `/anesthesia/[caseId]` — AI-drafted anesthesia pre-op note, airway assessment, cardiac risk (RCRI), pulmonary risk, OSA screen (STOP-BANG), allergy & med reconciliation, clearance decision (clear / conditional / defer).

### 3.4 Care Coordinator (desktop)
- `/coordinator/board` — Kanban-style board of cases across stages (Referral → Workup → Clearance → Pre-hab → Ready). Agents populate and move cards; coordinators resolve exceptions.
- `/coordinator/tasks` — personal task inbox, including tasks escalated by agents.
- `/coordinator/messages` — unified inbox for patient messages across channels.

### 3.5 Allied clinician (lightweight portal)
- `/referrals/inbox` — incoming referrals with context pack already attached.
- `/referrals/[id]` — report progress, upload note; agent syncs back to the case.

### 3.6 Patient (mobile-first web app — PWA)
The patient is the **connector across all providers**. Built as a responsive Next.js app with PWA manifest, installable, optimized for ~390px viewport.

- `/app/login` — magic-link / OTP (mocked Phase 1).
- `/app/home` — Readiness Score (ring meter, 0–100), next step card, upcoming appointments.
- `/app/tasks` — checklist of what the patient must do (questionnaires, uploads, pre-hab exercises).
- `/app/messages` — thread-based chat with the care team and the patient-facing agent.
- `/app/education` — procedure-specific content, consent documents.
- `/app/upload` — camera-first document/photo upload.
- `/app/schedule` — confirm / reschedule appointments.
- `/app/day-of` — T-minus-24h checklist: NPO, meds to hold, arrival time, what to bring.

---

## 4. AI AGENT ROSTER

Every agent below has a single job, a single owner role, and an explicit trigger. In Phase 1 these are simulated with scripted outputs. In Phase 3 they become real LangChain/LangGraph runnables against Bedrock models. The roster and interfaces **do not change** between phases — only the implementation.

| # | Agent Name | Role | Triggered by | Primary user it serves | Default model (Phase 3) |
|---|---|---|---|---|---|
| 1 | `IntakeOrchestrator` | Accept new case, build required-workup plan from procedure code + patient history | Surgeon creates case | Surgeon, Coordinator | Claude Sonnet (Bedrock) |
| 2 | `RiskScreeningAgent` | Run NSQIP-style screen across 100+ conditions, flag risks | Case opens, patient data updates | Surgeon, Anesthesia | Claude Opus (Bedrock) |
| 3 | `AnesthesiaClearanceAgent` | Draft pre-anesthesia note, compute ASA/RCRI/STOP-BANG | Labs & H&P present | Anesthesiologist | Claude Opus (Bedrock) |
| 4 | `ReferralAgent` | Draft and send specialty referrals with context pack | Risk agent flags cardiac/pulm/endo/etc. | Coordinator, Allied | Claude Sonnet |
| 5 | `SchedulingAgent` | Find common slots across providers + patient; proposes appts via **hospital calendar MCP** | New referral, reschedule request | Coordinator, Patient | Claude Haiku |
| 6 | `PatientCommsAgent` | Handle patient messages, answer FAQs from approved knowledge base, escalate clinical Qs | Inbound patient message | Patient, Coordinator | Claude Sonnet |
| 7 | `PreHabAgent` | Prescribe and track pre-hab regimen, nudge adherence | Cleared for pre-hab | Patient, PT | Claude Haiku |
| 8 | `DocumentationAgent` | Pull from Athena, draft H&Ps and op-notes, post back via **Athena MCP** | On demand / scheduled | Surgeon, Coordinator | Claude Sonnet |
| 9 | `TaskTrackerAgent` | Maintain the care-coordinator Kanban; writes to **Asana MCP** mirror | Any status change | Coordinator | Claude Haiku |
| 10 | `ReadinessAgent` | Continuously recompute the patient-facing Readiness Score | Any event on the case | Patient, Surgeon | Claude Sonnet |

Every agent exposes this contract (identical in Phase 1 mock and Phase 3 real):

```ts
interface Agent {
  id: string;
  name: string;
  role: string;           // human description
  systemPrompt: string;   // editable from admin dashboard
  model: ModelId;         // Bedrock model id
  temperature: number;
  triggers: TriggerSpec[]; // event-driven
  tools: ToolRef[];        // MCP tools it may call
  run(input: AgentInput, ctx: CaseContext): Promise<AgentRun>;
}
```

Every agent run is recorded with: input, output, tool calls, latency, token count, cost, and human-review status. The admin dashboard reads from this log.

---

## 5. TECH STACK — SPECIFICATION, IMPLEMENTATION & VALIDATION

### 5.1 Phase 1 — Frontend & UX only

**Specification**
- Pixel-faithful to the design system in §2.
- Every screen in §3 reachable and interactive with mocked state.
- Every agent in §4 has a visible, scripted simulation the user can trigger.
- Mobile patient app works installable on iOS/Android browsers (PWA).

**Implementation**
- **Framework:** Next.js 15+ (App Router, React 19, Server Components where trivially correct, otherwise Client).
- **Language:** TypeScript strict.
- **Styling:** Tailwind CSS v4 + shadcn/ui.
- **State:** Zustand for cross-component app state; TanStack Query for all "remote" data (backed by MSW in Phase 1).
- **Forms:** React Hook Form + Zod resolvers.
- **Animation:** Framer Motion (agent "thinking" states, score ring, card transitions).
- **Charts:** Recharts (admin analytics).
- **Mock API layer:** **Mock Service Worker (MSW)** with a `mocks/handlers/*.ts` file per resource. Seeds from `mocks/fixtures/*.json`.
- **Agent simulation:** `src/agents/mock/` — each agent has a `scripted.ts` returning stepwise outputs with artificial delays; emits events to a client-side EventBus so the UI shows "Agent X is drafting…", "Agent X called tool hospital-calendar.find_slots", etc.
- **Component workshop:** Storybook 8.
- **Icons:** Lucide React.
- **Package manager:** pnpm.

**Agentic simulation framework (Phase 1)**
Even though LangChain runs only in Phase 3, we pre-shape Phase 1 so the real framework drops in without rewrites:
- Define agents as serializable JSON configs in `src/agents/registry.ts`.
- Wrap each mock agent in a `SimulatedRunnable` that exposes the same `.invoke()` / `.stream()` interface LangChain LCEL uses.
- Simulate MCP tool calls by calling fake local adapters (`tools/mock/hospital-calendar.ts`, `tools/mock/asana.ts`, `tools/mock/athena.ts`) that log to the UI.

**Validation**
- **Unit:** Vitest + React Testing Library.
- **E2E:** Playwright — one spec per user journey (admin onboarding, surgeon sign-off, anesthesia clearance, coordinator board, patient day-of). These specs must keep passing through Phase 2 and Phase 3.
- **Visual regression:** Chromatic (optional but recommended) or Playwright screenshot comparison.
- **Accessibility:** `@axe-core/playwright` run in CI; WCAG 2.1 AA is the bar.
- **Lint/format:** ESLint (flat config), Prettier, `typescript-eslint` strict.

### 5.2 Phase 2 — Backend, infra & Athena sandbox

**Specification**
- Every mocked endpoint in Phase 1 gets a real counterpart returning the same TypeScript shape.
- Auth: patient OTP + provider SSO (Cognito mocks until real IdPs configured).
- Athena Sandbox is the source of truth for clinical data. We **do not** duplicate Athena data; we cache per-case context.
- All infra described as code (AWS CDK in TypeScript).

**Implementation**
- **Backend runtime:** Node 22 + TypeScript, **NestJS** (modular, DI-friendly, strong fit for multi-agent orchestration in Phase 3) OR **Fastify** if the team prefers lighter. Default to NestJS.
- **API style:** REST + OpenAPI 3.1, plus a GraphQL gateway for the client if complexity warrants (not required for MVP).
- **DB:** PostgreSQL on **Amazon Aurora Serverless v2**. ORM: **Drizzle** (type-safe, migration-first) or Prisma. Default Drizzle.
- **Cache / queue:** ElastiCache Redis + SQS for agent job queue.
- **Object storage:** S3 for patient uploads, pre-signed URLs only.
- **Auth:** **AWS Cognito** user pools (one per role group), OIDC to providers' IdPs later.
- **Athena integration:** Athena Health Sandbox (`api.preview.platform.athenahealth.com`) — dedicated service module `integrations/athena/` with retry, rate-limit, and idempotency.
- **Compute:** **AWS ECS Fargate** behind ALB; one service per bounded context (api, worker, agents — agents split in Phase 3).
- **Networking:** VPC with private subnets for RDS and ECS tasks, public only for ALB.
- **Secrets:** AWS Secrets Manager (no `.env` in prod).
- **Observability:** CloudWatch Logs + OpenTelemetry → AWS X-Ray. Structured JSON logs with correlation IDs.
- **Hosting frontend:** Vercel, connected to GitHub `main` (prod) and `staging` branches.
- **CI/CD:** **GitHub Actions** with YAML workflows: `lint.yml`, `test.yml`, `build.yml`, `deploy-frontend.yml` (Vercel), `deploy-backend.yml` (AWS CDK deploy + ECS rollout), `db-migrate.yml`.
- **IaC:** AWS CDK v2 in TypeScript, stacks: `NetworkStack`, `DataStack`, `AuthStack`, `ApiStack`, `AgentStack` (Phase 3), `ObservabilityStack`.

**Validation**
- **Unit:** Jest for Nest services, ≥ 80% coverage on services and domain logic.
- **Contract:** OpenAPI schema is the contract; frontend generates a typed client via `openapi-typescript`.
- **Integration:** test containers for Postgres + Redis.
- **E2E:** the Playwright suite from Phase 1 runs against a staging deployment.
- **Load:** k6 baseline scenarios for the 5 busiest endpoints.
- **Security:** dependency scan (GitHub Dependabot), IaC scan (cdk-nag), OWASP ZAP baseline scan in CI, secret scan (gitleaks).

### 5.3 Phase 3 — Agentic orchestration

**Specification**
- Every agent in §4 is a real runnable. No mocks remain except for MCP servers we don't yet have.
- Agents are orchestrated via **LangGraph** (stateful graph) inside a LangChain project.
- Models come from **AWS Bedrock** (Claude family primary, Titan/Llama as backup).
- Admin dashboard can edit prompt, swap model, tune temperature; changes are versioned.

**Implementation**
- **Framework:** LangChain JS + LangGraph JS. Use LCEL for simple chains, LangGraph for any multi-step agent with branching or human-in-the-loop.
- **Model provider:** `@langchain/aws` → Bedrock. Supported IDs in MVP: `anthropic.claude-sonnet-4-*`, `anthropic.claude-opus-4-*`, `anthropic.claude-haiku-*`.
- **Agent service:** separate ECS service `agents-worker` that consumes SQS messages. Each message is one `AgentRun`.
- **Tool integrations via MCP:** at minimum — hospital calendar (Google/Microsoft Graph), Asana, and Athena (EHR). Each exposed as an MCP server the agents connect to.
- **Prompt registry:** prompts stored in Postgres (`agent_prompts` table) with `version`, `author`, `created_at`, `is_active`. Admin UI writes new versions; runtime loads the active one.
- **Tracing:** LangSmith project per env (`primed-dev`, `primed-staging`, `primed-prod`). Every run linked in the admin dashboard.
- **Guardrails:** Bedrock Guardrails for PHI redaction on logs; JSON-schema validation on every tool input/output; hard-stop policies (`NEVER_AUTO_CLEAR_PATIENT`, `NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF`).
- **Human-in-the-loop:** every clinical recommendation ends in a pending-approval state; the surgeon/anesthesia provider must click "accept" in the UI for the agent's draft to become part of the record.

**Validation**
- **Eval harness:** a `evals/` suite of frozen test cases per agent (input → expected behavior). Run on every prompt change in CI (gated deploy).
- **Offline metrics:** exact-match on structured outputs, LLM-judge on free-text, latency, cost per run.
- **Online metrics:** acceptance rate (was the human override required?), escalation rate, time saved per case.
- **Red-team suite:** adversarial inputs (PHI leak attempts, prompt injections, conflicting instructions from patient messages).

---

## 6. DATA MODEL (high-level)

These entities must exist from Phase 1 (as mock fixtures) and carry through Phase 2 (real tables) unchanged in shape:

`Facility`, `User` (discriminated by `role`), `Patient`, `Case`, `Procedure`, `Consult`, `Referral`, `Task`, `Message`, `Document`, `Appointment`, `Assessment` (RiskScreening / AnesthesiaClearance / ReadinessScore snapshots), `AgentRun`, `AgentPromptVersion`, `AuditEvent`.

Every table has `id (uuid)`, `createdAt`, `updatedAt`, `createdBy`, and soft-delete `deletedAt`. All clinical tables have `facilityId` for tenant isolation.

---

## 7. SECURITY, PRIVACY & COMPLIANCE POSTURE

- Target: **HIPAA-aligned** from day one; SOC 2 Type I within 6 months post-launch.
- Principle of least privilege: IAM roles per service, no wildcard actions.
- Encryption: TLS 1.3 in transit; AES-256 at rest (RDS, S3, EBS).
- PHI never sent to non-Bedrock models. Bedrock in a HIPAA-eligible region (`us-east-1` with BAA).
- Audit log is append-only, exported to a locked S3 bucket.
- All patient-facing surfaces clearly mark AI-drafted content.
- No third-party analytics that send PHI. Use self-hosted PostHog or a HIPAA-BAA analytics vendor.

---

## 8. ROADMAP

### Phase 1 — Frontend & UX E2E (Claude design workflow)
**Outcome:** a running Next.js app at `localhost:3000` + deployed preview on Vercel, covering every user journey with mocked data and simulated agents.

Milestones:
1. **Scaffold & design system.** Next.js app, Tailwind tokens from §2, shadcn/ui initialized, Fraunces + Inter loaded, Storybook set up, CI green.
2. **Marketing site.** Replicate the 4 reference screens (landing, services, contact, footer) at production quality; this is where brand style is locked.
3. **Auth & shell.** Role-based layouts (admin, provider, patient-mobile). Mock login that picks a role.
4. **Admin dashboard.** Users, cases, agents (read-only config in Phase 1).
5. **Surgeon cockpit.** Case list + single-case readiness view.
6. **Anesthesia queue + clearance view.**
7. **Coordinator Kanban + task inbox.**
8. **Patient mobile PWA.** All patient screens in §3.6.
9. **Agent simulation layer.** Scripted agents wired into every relevant UI; live activity stream visible in admin dashboard.
10. **E2E pass.** Playwright journeys green. Lighthouse ≥ 90 on the marketing site, ≥ 85 on app screens.

**GATE — stop here and wait for explicit "proceed to Phase 2" from the user.**

### Phase 2 — Backend, APIs, Athena sandbox (Claude Code workflow)
**Outcome:** the Phase 1 app, unchanged on the surface, now running against a real backend on AWS with Athena Sandbox data.

Milestones:
1. **Repo restructure** to monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/shared-types`, `infra/`.
2. **CDK baseline:** `NetworkStack`, `DataStack` (Aurora + Redis + S3), `AuthStack` (Cognito).
3. **API skeleton:** NestJS app, health checks, OpenAPI, typed client generated into `apps/web`.
4. **Athena integration module** with retries, caching, and a local replay harness for dev.
5. **Auth wiring:** replace mock login with Cognito; role claims flow to UI.
6. **Resource-by-resource cutover:** users → cases → consults → referrals → tasks → messages → documents → appointments → assessments. MSW handlers deleted as each resource goes live.
7. **CI/CD hardening:** preview deployments for every PR (Vercel + AWS preview env), automated DB migrations, rollback runbook.
8. **Staging + pilot data:** load sandbox demo patients, run Playwright E2E against staging.

**GATE — explicit "proceed to Phase 3."**

### Phase 3 — Agentic orchestration (Claude Code workflow)
**Outcome:** every agent in §4 is real, triggered by real events, writing back through MCP tools, observable in the admin dashboard.

Milestones:
1. **LangChain + LangGraph scaffold** in `apps/worker`; Bedrock client configured.
2. **Prompt registry + admin editor** (UI already stubbed in Phase 1 — wire to real table).
3. **Agents 1, 2, 10 first** (Intake, Risk, Readiness) — they unlock the core case timeline.
4. **Agents 3, 4, 5** (Anesthesia, Referral, Scheduling) — requires calendar MCP.
5. **Agents 6, 7** (Patient comms, PreHab) — requires patient-channel testing + guardrails.
6. **Agents 8, 9** (Documentation, TaskTracker) — requires Athena and Asana MCP.
7. **Eval harness + LangSmith dashboards** wired into admin.
8. **Shadow mode for 2 weeks.** Agents run, outputs are logged, humans still do all the work. We compare.
9. **Supervised rollout.** Turn on one agent at a time in production.

---

## 9. REPOSITORY LAYOUT (target, monorepo from Phase 2)

```
primed/
├─ apps/
│  ├─ web/              # Next.js (Phase 1 lives here first)
│  ├─ api/              # NestJS REST + OpenAPI
│  └─ worker/           # Agent runtime (Phase 3)
├─ packages/
│  ├─ shared-types/     # zod schemas + TS types shared by web/api
│  ├─ ui/               # shadcn-based component library
│  └─ agent-contracts/  # Agent, AgentRun, ToolRef interfaces
├─ infra/               # AWS CDK
├─ evals/               # Agent eval suites
├─ docs/
│  ├─ CONSTITUTION.md   # this file
│  ├─ ADRs/             # architecture decision records
│  └─ runbooks/
└─ .github/workflows/
```

In **Phase 1 only**, the structure can start flat as a single Next.js app; restructure on the first day of Phase 2.

---

## 10. CLAUDE CODE OPERATING PERMISSIONS

When Phase 2 begins, Claude Code will be granted CLI access to:

- **GitHub** (`gh` CLI) — create repos, branches, PRs, merge after CI green.
- **Vercel** (`vercel` CLI) — link project, set env vars, deploy previews.
- **AWS** (`aws` CLI + CDK) — provision all resources in a dedicated sandbox account. IAM role scoped to the VPC, ECS, RDS, Cognito, S3, and Bedrock services required.
- **Athena Sandbox** — API keys stored in Secrets Manager; Claude Code may reference them via CDK, never echo them.

Claude Code must:
- Ask before creating paid resources above $X/month (user sets X).
- Open a PR for every change to production config; never `git push` to `main` directly.
- Write an ADR in `docs/ADRs/` for any non-trivial architectural choice.
- Run the full CI locally before opening a PR.

---

## 11. ACCEPTANCE CRITERIA (GATES)

### End of Phase 1 — must all be true
- [ ] Every screen in §3 is reachable and functional with mocked data.
- [ ] Every agent in §4 has a working simulation that can be triggered from the UI.
- [ ] Patient PWA installs on iOS Safari and Android Chrome.
- [ ] Playwright E2E covers the 5 primary journeys and is green in CI.
- [ ] Storybook has ≥ 90% of shared components.
- [ ] Lighthouse ≥ 85 on all primary app screens; ≥ 90 on marketing.
- [ ] Accessibility: zero axe-core critical violations.
- [ ] Styling matches §2 tokens exactly (design review sign-off).

### End of Phase 2
- [ ] Every Phase 1 mock has been replaced with a real API call; no MSW in production bundle.
- [ ] Cognito auth works for all three role groups.
- [ ] At least one demo patient's data round-trips cleanly from Athena Sandbox to UI.
- [ ] All CDK stacks deploy cleanly from scratch in a fresh AWS account.
- [ ] All CI jobs pass; preview envs work on every PR.
- [ ] Security: cdk-nag and ZAP baseline clean.

### End of Phase 3
- [ ] Every agent in §4 runs against Bedrock and appears in the admin dashboard.
- [ ] Prompt/model/temperature can be edited from admin and takes effect on next run.
- [ ] LangSmith traces are visible and linked per run.
- [ ] Eval harness runs in CI and blocks deploy on regression.
- [ ] Human-in-the-loop is enforced for every clinical write; no agent can finalize a clinical record alone.
- [ ] Shadow-mode metrics captured for ≥ 2 weeks before supervised rollout.

---

## 12. DECISIONS & OPEN QUESTIONS

### Locked decisions (owner-confirmed)
1. **Athena Sandbox practice IDs:** primary `1128700` (Hospital/Health System), secondary `195900` (Ambulatory for clinic-based pre-op), `80000` for the patient PHR app.
2. **Athena API surface for MVP:** Patient, Appointments, Chart, Encounter, Documents and Forms, **Event Notifications** (event-driven backbone for agents), Provider, Practice Configuration, Hospital, Insurance and Financial. Deferred: Quality Management and Pop Health (Phase 4+). Out of scope: Obstetrics (OB) Episode.
3. **Hospital calendar MCP target:** Google Workspace (Google Calendar API) first.
4. **Task tracker mirror:** Asana.
5. **Display serif:** Fraunces (confirmed).

### Still open
6. Pre-hab content library for Agent 7 (`PreHabAgent`) — TBD. Phase 1 uses placeholder copy marked `// TODO: clinical review`.

---

## 13. GLOSSARY

- **Perioperative:** the entire span around surgery — pre-op assessment, intra-op, and post-op.
- **ASA Classification:** American Society of Anesthesiologists physical-status grading (I–VI).
- **NSQIP:** ACS National Surgical Quality Improvement Program; source of our risk model reference.
- **Pre-hab:** pre-surgical rehabilitation — strength, nutrition, smoking cessation, glycemic control.
- **MCP:** Model Context Protocol; how our agents call external tools (calendar, Asana, Athena).
- **MSW:** Mock Service Worker; intercepts `fetch`/`XHR` in the browser for Phase 1 mocks.
- **LCEL / LangGraph:** LangChain's declarative chain / stateful graph runtimes.
- **Readiness Score:** 0–100 composite score patients and providers see, computed by Agent 10.

---

*End of constitution. Changes to this document require a PR and explicit owner approval.*
