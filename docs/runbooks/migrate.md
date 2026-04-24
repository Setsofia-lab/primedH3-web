# Runbook — Database migrations

PrimedHealth runs Drizzle migrations as a **one-shot ECS Fargate task**
using the same container image as the api service. The migrate task
definition is created by `ApiStack` under the family
`primedhealth-<env>-migrate`.

## When to run

- Immediately after `cdk deploy primedhealth-<env>-api` **if the
  commit introduced a new file under `apps/api/src/db/migrations/`**.
- Before starting any task that reads/writes new columns.

## Pre-flight

- You have the `primedhealth-<env>` AWS SSO profile configured and
  logged in (`aws sso login --profile primedhealth-dev`).
- Build passes locally: `pnpm --filter @primedhealth/api build`.
- You've generated the migration with `pnpm --filter @primedhealth/api
  migrate:generate --name <short-name>` and committed the resulting
  `*.sql` files under `apps/api/src/db/migrations/`.

## Execute — dev

Pull the stack outputs once so you have cluster, subnets, and SG to
pass to `run-task`:

```bash
export PROFILE=primedhealth-dev
export STACK=primedhealth-dev-api

read -r CLUSTER FAMILY SUBNETS SG <<<"$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK" --profile "$PROFILE" --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ClusterName` || OutputKey==`MigrateTaskFamily` || OutputKey==`ServiceSubnetIds` || OutputKey==`ServiceSgId`].OutputValue' \
    --output text
)"

echo "Cluster: $CLUSTER"
echo "Family:  $FAMILY"
```

Kick the task off:

```bash
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$FAMILY" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
  --count 1 \
  --profile "$PROFILE" --region us-east-1 \
  --query 'tasks[0].taskArn' --output text)

echo "Task ARN: $TASK_ARN"

aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --profile "$PROFILE" --region us-east-1

aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --profile "$PROFILE" --region us-east-1 \
  --query 'tasks[0].{StoppedReason:stoppedReason,Containers:containers[].{Name:name,ExitCode:exitCode}}'
```

Exit code `0` → success. Tail CloudWatch to see the log output:

```bash
aws logs tail /aws/ecs/primedhealth-dev/api --since 10m \
  --log-stream-name-prefix migrate --follow \
  --profile "$PROFILE" --region us-east-1
```

## Execute — prod

Same commands with `--profile primedhealth-prod` and stack name
`primedhealth-prod-api`. **Prod migrations require a change-management
approval** — post the migration diff in the #deploys channel before
running (policy wired in M8).

## Rollback

Drizzle does not auto-generate down migrations. For each forward
migration:

1. Capture a DB snapshot before running:
   ```bash
   aws rds create-db-cluster-snapshot \
     --db-cluster-identifier <cluster-id> \
     --db-cluster-snapshot-identifier pre-migrate-$(date +%s) \
     --profile primedhealth-<env>
   ```
2. If a migration goes wrong: restore from that snapshot and redeploy
   the previous api image version.
3. Hotfixes land as a new forward migration (a "down migration" in
   disguise) rather than mutating history.

## Troubleshooting

**Task exits with code 1 and "DATABASE_URL is required":** the task
role isn't authorized for the Aurora secret, or `DB_SECRET_ARN` is
empty. Re-check the `/primedhealth/<env>/db/master` secret exists
and that the ApiStack's task role has `secretsmanager:GetSecretValue`
on that ARN.

**Task stuck in PROVISIONING:** no IPs in the private subnets — scale
the NAT gateway or VPC subnets.

**Migration fails mid-way:** Drizzle's journal is transactional per
statement block. The `_journal.json` tracks applied files; safe to
re-run from a failed state — unapplied statements re-execute.

## CI automation (M8)

`deploy-backend.yml` will run migrations automatically via
`aws ecs run-task` after every successful image push to ECR but before
updating the api service. Until then, this is manual.
