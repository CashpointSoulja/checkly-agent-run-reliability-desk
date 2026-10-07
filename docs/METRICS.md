# Metrics and success criteria

These are proposed metrics for a real pilot. The prototype collects **no telemetry**, so none of these numbers exist yet.

## North star

**Green-but-wrong runs caught before release:** candidate runs with transport PASS and task FAIL that are blocked at the gate, per 100 candidate runs evaluated.

- Numerator: candidate runs where `transport = pass` and `task = fail` and the gate was BLOCKED.
- Denominator: all candidate runs evaluated in pre-release suites.
- Why: this is the hypothesis in one number. If it is ~0 for real teams, the product has no reason to exist.

## Input metrics

| Metric | Definition (numerator / denominator) | Pilot target |
|---|---|---|
| Invariant coverage | Agent workflows with ≥ 3 declared invariants / agent workflows with a synthetic check | 60% by week 6 |
| Time to first invariant | Median minutes from opening the desk to first committed invariant | < 15 min |
| Exact-failure usefulness | Reviews where the first failed assertion was marked "this was the cause" / reviews of failed runs | ≥ 70% |
| Reproduction rate | Imported fixtures whose verdict reproduces / imported fixtures | 100% (determinism guarantee) |
| Safe-abstention rate | REVIEW runs / all candidate runs, tracked per release | Tracked, not targeted; a sharp drop is a signal |

## Guardrails

| Guardrail | Definition | Threshold |
|---|---|---|
| False block rate | Gate blocks later overridden as "invariant was wrong" / gate blocks | < 10% |
| Alert noise | Alerts acknowledged without action / alerts sent | < 20% |
| Validator latency | p95 evaluation time per trace in the browser | < 50 ms |

## Prototype success criteria (met or not, as of 2026-10-07)

| Criterion | Status | Evidence |
|---|---|---|
| All 8 failure classes are seeded and each one yields its expected first failed invariant | Met | `src/domain/domain.test.ts` (`it.each` table) |
| Transport and task verdicts are separated, with 6 of 8 candidates green at HTTP but failing the task | Met | unit test "green HTTP status does not imply task success" |
| Safe abstention is shown as REVIEW with a human decision | Met | unit + e2e |
| Exported fixture re-imports and reproduces; a tampered fixture is detected | Met | unit + e2e |
| No external network requests | Met | e2e request listener |
| No horizontal overflow at 1366 / 820 / 390 | Met | e2e on three projects |
| Validated with real users | **Not met** | No interviews were run; see ASSUMPTIONS_RISKS.md |
