# ADR 0002: Athena integration — read-only, event-driven cache

**Status:** Accepted
**Date:** 2026-04-24
**Phase:** Phase 2 — M5

## Context

Our Athena Preview app was granted 112 scopes (athenaOne MDP, Event
Notifications, FHIR R4 SMART V2) — all read scopes. Write scopes on
DocumentReference / Binary were not granted; athenaOne Appointment
scopes were not granted either. Expanding the scope grant requires a
partner-team conversation at Athena.

Separately, the product team's strong preference is that PrimedHealth
**owns the pre-op workflow record**: AI-drafted H&Ps, pre-op notes,
agent outputs, coordinator board state, clearance decisions,
readiness scores. Athena stays the EHR system of record for
historical clinical data (chart, meds, labs, conditions, allergies,
encounters).

## Decision

Athena integration is **read-only plus event subscriptions**, one-way.
PrimedHealth never writes to Athena. Handoff to EHR-world happens via
surgeon-signed PDF export at sign-off — the facility uploads via their
existing Athena workflow.

### Architecture

```
┌──────────────────────────────┐           ┌──────────────────────────────┐
│         Athena EHR           │ ──read──▶ │       PrimedHealth           │
│  (historical clinical data)  │ ─events─▶ │  (pre-op workflow + agents) │
└──────────────────────────────┘           └──────────────────────────────┘
```

### Data ownership per §6 entity

| Entity | Owner | Notes |
|---|---|---|
| Facility, User | PrimedHealth | |
| Patient | Athena → cached | mirrored; `athenaPatientId` joins |
| Appointment | Athena → cached | hydrated from event stream |
| Case, Procedure, Consult, Referral, Task, Message | PrimedHealth | |
| Document (drafts, signed) | PrimedHealth | PDF export, no POST to Athena |
| Assessment (risk, anesthesia clearance, readiness) | PrimedHealth | agent outputs |
| AgentRun, PromptVersion, AuditEvent | PrimedHealth | |

### API usage

- **FHIR R4** is the primary read surface.
- **athenaOne (proprietary `/v1/{practiceid}/...`)** covers the long tail and appointment workflows once Athena enables those scopes.
- **Event Notifications** drives cache invalidation + agent triggers.

## Alternatives considered

1. **Write-back architecture** (original Constitution §5.2 framing). Rejected: requires Athena write scopes (not granted), introduces split-brain between our agent outputs and their sign-off status, and creates a Marketplace-review dependency for go-live.
2. **Pull-only on demand** (no cache, query Athena on every request). Rejected: latency budget for agent loops can't accommodate multi-second Athena calls on every invocation. Pre-hydrating on case creation + event-driven top-up is the compromise.
3. **Athena as authoritative for everything.** Rejected: incompatible with agent-driven workflows — we need a place to store drafts, scores, and task state that isn't the EHR.

## Consequences

Positive:
- Unblocks M5 immediately — no waiting on Athena scope expansions.
- Simpler audit trail; one source of truth per fact.
- No approval-to-EHR handoff step in agent flows; less to go wrong.
- Future-proof: `facility.athenaWriteBackEnabled` flag can flip on per-facility write-back when/if scopes are granted.

Negative:
- Two sources of truth UX burden — our UI must clearly label Athena-sourced fields vs PrimedHealth-owned fields.
- Handoff to OR staff on surgery day is manual (signed PDF export). Acceptable for pilot; revisit if facilities demand EHR-integrated records.

## Confirmed URL + auth patterns (against live Preview, 2026-04-24)

| Thing | Value |
|---|---|
| Token endpoint | `https://api.preview.platform.athenahealth.com/oauth2/v1/token` |
| FHIR base | `https://api.preview.platform.athenahealth.com/fhir/r4` |
| athenaOne base | `https://api.preview.platform.athenahealth.com/v1/{practiceid}` |
| Auth | Client-assertion JWT (RFC 7523, RS256) with our private JWK; kid `primedhealth-dev-athena-1` |
| Token TTL | 3600s (1 hour) |
| `ah-practice` on FHIR | REQUIRED query param on every FHIR request. Value: `Organization/a-1.Practice-<practiceid>` (not bare numeric). |
| Patient id format (sandbox) | `a-<practiceid>.E-<encounternum>` — e.g., `a-1128700.E-14914` |
| Search constraints | Athena enforces FHIR search parameter combos: `[_id]`, `[identifier]`, `[name]`, `[family,birthdate]`, `[family,gender]`, `[family,given]`. No blind sweeps. |

## Follow-ups

- [M5.6] Drizzle migration: add `source`, `athenaResourceId`, `athenaLastSyncAt`, `athenaVersion` to Patient + Appointment tables.
- [M5.7] FHIR Patient → DB row mapper; FHIR Appointment mapper once scope granted.
- [M5.8] Event Notifications subscriber (webhook receiver, SQS enqueue).
- [M5.9] Replay harness for offline tests (record live Preview responses).
- [M10] Per-facility `athenaWriteBackEnabled` toggle (stays false at pilot launch).
