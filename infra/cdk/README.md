# @primedhealth/cdk

AWS CDK stacks for PrimedHealth infrastructure.

## Prereqs

1. CDK bootstrapped in target account (done in M0; qualifier `primedh`).
2. `aws sso login --profile primedhealth-dev` (or `primedhealth-prod`).
3. `pnpm install` from the repo root.

## Commands

```bash
# Synthesize CloudFormation without deploying
pnpm --filter @primedhealth/cdk synth:dev

# Show diff against the deployed stack
pnpm --filter @primedhealth/cdk diff:dev -- --profile primedhealth-dev

# Deploy to dev
pnpm --filter @primedhealth/cdk deploy:dev -- --profile primedhealth-dev

# Tear down dev
pnpm --filter @primedhealth/cdk destroy:dev -- --profile primedhealth-dev
```

Prod deploys go through CI/CD with manual approval (wired in M8).
Never run `deploy:prod` from a developer machine.

## Stacks

| Stack | Role | Status |
|---|---|---|
| `primedhealth-<env>-network` | VPC, subnets, NAT, flow logs, S3 endpoint | M3.1 |
| `primedhealth-<env>-secrets` | KMS CMK + Secrets Manager secrets | M3.2 |
| `primedhealth-<env>-data` | Aurora Serverless v2 + Redis + S3 uploads + SQS | M3.3 |
| `primedhealth-<env>-auth` | Cognito user pools per role group | M3.4 |
| `primedhealth-<env>-observability` | CloudWatch log groups + alarms + X-Ray | M3.5 |

## Guardrails

- `cdk-nag` is applied across the whole app. CI will fail on any
  `AwsSolutions-*` finding at **high** or **medium** severity.
- `env=<name>` context is **required** — no default, so nobody
  accidentally deploys to prod.
- Per-env CIDRs are non-overlapping (dev: `10.0.0.0/16`, prod:
  `10.10.0.0/16`) so VPC peering stays an option later.
