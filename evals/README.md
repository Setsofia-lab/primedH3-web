# Evals

Agent evaluation harness. Stood up in Phase 3 M7.

Per Constitution §5.3: frozen test cases per agent (input → expected behavior),
run on every prompt change in CI (gated deploy). Offline metrics: exact-match
on structured outputs, LLM-judge on free-text, latency, cost per run.

Structure (planned):

```
evals/
├─ agents/
│  ├─ IntakeOrchestrator/
│  ├─ RiskScreeningAgent/
│  └─ ...
├─ judges/
├─ harness/
└─ runner.ts
```
