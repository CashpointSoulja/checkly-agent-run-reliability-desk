# PRD: Agent Run Reliability Desk

Independent concept by Ayo Ahmed. Not affiliated with Checkly. Status: working prototype on synthetic data. Date: 2026-10-07.

## Problem (hypothesis)

A green HTTP status is not proof that an agent completed the correct job. Agent-backed endpoints can return 200 after acting on the wrong ticket, skipping a required approval, retrying a refund without an idempotency key, or quoting a stale or non-existent source. Status-code and latency checks are blind to all of these.

## Users

- **Primary:** the engineer who owns an agent-backed workflow (platform, SRE or AI engineering) and decides whether a new agent release ships.
- **Secondary:** the incident reviewer who needs a reproducible case and a written memo.

## Goals

1. Show transport success and task success as two separate verdicts for every run.
2. Make the exact failed invariant obvious: rule, expected, actual and step.
3. Gate a candidate release against a baseline on the same scenarios.
4. Treat safe abstention as a legitimate, human-reviewed outcome.
5. Make every finding reproducible offline (fixture + fingerprint) and shareable (memo, alert text).

## Non-goals

- Live monitoring, telemetry ingestion or any network connection.
- Any AI or model-based scoring, judging or "confidence". Every verdict comes from a deterministic rule.
- Executing real agent actions. Side effects in fixtures are labelled "simulated".

## Scope as built

| Capability | Behaviour |
|---|---|
| Seed fixtures | 8 scenarios × 2 releases (`v2.3.1` baseline, `v2.4.0-rc.1` candidate): healthy, wrong tool target, stale source, timeout, missing approval, partial success, duplicate side effect, unsupported claim |
| JSON import | Paste or upload a trace, an array of traces, or an exported fixture. Schema errors are listed by path. Unknown validator kinds are rejected |
| Validators (v1.0.0) | `tools_allowed`, `target_matches`, `max_source_age`, `latency_budget`, `approval_required`, `complete_all`, `idempotent`, `claims_grounded`, plus the implicit `SAFE-ABSTAIN` |
| Verdicts | Transport: PASS if the final HTTP status is 2xx. Task: FAIL if any assertion fails; REVIEW if the agent abstained safely; otherwise PASS |
| Timeline | Steps with offsets, duration bars, tool call signature, HTTP status, notes, simulated side-effect tags and failed-invariant tags |
| Evidence | Agent output, claims with cited sources and quotes, source URI, as-of time and age at run start |
| Release gate | Per scenario: regression / fixed / still failing / still passing / changed. The gate is BLOCKED if any candidate run fails |
| Human review | REVIEW runs take a decision (confirmed / escalated). Every run accepts a reviewer note. Stored in localStorage |
| Exports | Reproducible fixture JSON (fingerprint + expected verdict; re-import verifies it), review memo Markdown, release comparison Markdown, copyable alert text labelled "Preview only, not sent" |
| Reset | Clears imports, evaluations, reviews and local storage, and re-seeds |

## Seeded outcomes (candidate)

| Scenario | Transport | Task | First failed invariant | vs baseline |
|---|---|---|---|---|
| Healthy | PASS 200 | PASS | none | fixed (baseline emailed a stale contact) |
| Wrong tool target | PASS 200 | FAIL | `INV-ticket-target`: T-818 ≠ T-881 | regression |
| Stale source | PASS 200 | FAIL | `INV-fresh-status`: snapshot 3.1 d old, limit 15 min | regression (baseline abstained) |
| Timeout | FAIL 504 | FAIL | `INV-export-written` | still failing |
| Missing approval | PASS 200 | FAIL | `INV-approval`: $480 refund, no approval step | regression |
| Partial success | PASS 200 | FAIL | `INV-all-notified`: 3 of 5 | regression (baseline abstained) |
| Duplicate side effect | PASS 200 | FAIL | `INV-idempotent`: re_9120 and re_9121 | regression |
| Unsupported claim | PASS 200 | FAIL | `INV-grounded`: "database migration at 14:02" not in deploy log | regression |

Six of the eight candidate runs are green at the HTTP layer but fail the task.

## Requirements

- **Deterministic:** the same trace always gives byte-identical evaluation output (unit tested).
- **Local only:** no external requests after load (asserted in the e2e test).
- **Accessible:** status is never shown by colour alone (icon + word), all controls are real buttons with pressed and expanded state, visible focus rings, and reduced motion is respected.
- **Responsive:** no horizontal overflow at 1366, 820 and 390 px (asserted in e2e).

## Open questions

- Should `REVIEW` count against the release gate? Today it does not block, but it is shown.
- Should invariants be per policy (as here) or per check?
- What is the minimal OTel span set needed to populate this schema? See [ROADMAP.md](ROADMAP.md).
