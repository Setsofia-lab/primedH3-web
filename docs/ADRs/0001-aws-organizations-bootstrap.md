# ADR 0001: AWS Organizations + Identity Center bootstrap

**Status:** Accepted
**Date:** 2026-04-21
**Phase:** Phase 2 — M0

## Context

PrimedHealth is a production-grade, HIPAA-aligned healthcare app that will be
listed on Athena's Marketplace for pilot facilities. We need AWS infrastructure
with strong isolation between dev and prod, auditable access, and a clear path
to federated auth for CI/CD.

We started with a single standalone AWS account (`613649367863`). Constitution
§7 requires HIPAA alignment from day one; §10 requires least-privilege IAM and
CloudTrail-backed audit of every action.

## Decision

Bootstrap a three-account AWS Organization with IAM Identity Center.

- **Management account** `613649367863` — billing, Organizations, Identity
  Center, org-level CloudTrail. **No workloads, no PHI.**
- **`PrimedHealth Dev`** `984126996145` — dev + staging workloads. Athena
  Preview sandbox. No real PHI (synthetic data only).
- **`PrimedHealth Prod`** `492084584502` — production workloads. Athena
  Production. Real pilot facility PHI. BAA-covered.

### Auth

- No long-lived IAM access keys for humans. All human access via IAM Identity
  Center federation.
- `samsetsofia` IAM user access key deactivated on 2026-04-21 (kept as
  break-glass; delete once SSO is stable for ≥30 days).
- Permission sets:
  - `AdministratorAccess-ForHumans` (PT8H) — human operators, all accounts.
  - `ClaudeCodeDeployer-Dev` (PT4H) — scoped to dev account only.
  - `ClaudeCodeReadOnly-Prod` (PT4H) — observation-only on prod until M10
    cutover.

### Audit

- Multi-region, organization-level CloudTrail (`primedhealth-org-trail`) with
  KMS encryption (`alias/primedhealth-cloudtrail`) and log-file validation.
- S3 logs bucket (`primedhealth-cloudtrail-logs-613649367863`) — SSE-KMS,
  versioned, block-public, TLS-only, BucketOwnerEnforced.

### Cost control

- $150/mo budget on the management account (consolidates all child accounts).
  Actual alerts at 50/80/100%; forecast alert at 100%. Recipient:
  `setsofiaeli@gmail.com`.

### CDK

- Both member accounts bootstrapped with `cdk bootstrap` under qualifier
  `primedh`. Stack name: `CDKToolkit`. Execution policy: `AdministratorAccess`
  (to be tightened in M2 once stacks are defined).

## Alternatives considered

1. **Single account.** Rejected. Blast radius too large for HIPAA app with
   prod PHI. No way to isolate dev mistakes from prod resources.
2. **Control Tower / Landing Zone Accelerator.** Deferred. Valuable for ≥5
   accounts with strict compliance baselines; overhead too high for a 3-account
   MVP. Revisit at Phase 3 when we add security/log-archive accounts.
3. **Long-lived IAM user access keys for Claude Code.** Rejected. Keys are
   inherently riskier than short-lived SSO tokens and don't integrate with org
   audit cleanly. Future CI/automation will use GitHub Actions OIDC
   federation, not IAM users.
4. **3 separate AWS root accounts (not in an org).** Rejected. No consolidated
   billing, no shared SCPs, harder to audit, impossible to delegate admin.

## Consequences

Positive:
- Prod PHI is isolated by AWS account boundary — the strongest blast-radius
  control AWS offers.
- Every action across all three accounts is captured by the org-level
  CloudTrail.
- Adding a security/audit account or Control Tower later is additive, not a
  re-foundation.

Negative:
- Two extra accounts to manage.
- `samsetsofia` IAM user and its associated console password remain as
  break-glass — must be deleted or MFA-enforced after SSO proves stable.
- GuardDuty, AWS Config, and Security Hub are deliberately deferred until M3
  (cost: ~$60–100/mo with no workloads to audit yet). Revisit by M3.

## Follow-ups

- [M1] Commit `infra/bootstrap/` to source control.
- [M2] Tighten `ClaudeCodeDeployer-Dev` from `AdministratorAccess` to a scoped
  inline policy once the set of CDK stacks is known.
- [M3] Enable GuardDuty + AWS Config + Security Hub org-wide with delegated
  admin from the management account.
- [M3] Stand up org-level SCPs: deny non-us-east-1 regions, deny root login,
  deny disabling CloudTrail.
- [≥30 days] Delete `samsetsofia` IAM user.
- [M10] Upgrade `ClaudeCodeReadOnly-Prod` to a scoped deployer role once prod
  cutover is approved.
