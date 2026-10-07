# Test results

These are actual outputs from the run on 2026-10-07 (UTC), Node v22.23.3, on the commit that rejects duplicate ids and makes imports fail closed. ANSI colours have been stripped and the build output has been trimmed to its last lines.

```text
$ npm run typecheck
exit 0
$ npm run lint
exit 0
$ npm test
 ✓ src/domain/domain.test.ts (21 tests) 8ms
 ✓ src/domain/validation.test.ts (50 tests) 24ms
 Test Files  2 passed (2)
      Tests  71 passed (71)
   Start at  04:55:55
   Duration  270ms (transform 98ms, setup 0ms, collect 174ms, tests 32ms, environment 0ms, prepare 73ms)

$ npm run build
dist/assets/index-BJiV_QtM.css                             21.05 kB │ gzip:  4.49 kB
dist/assets/index-BqeZebOV.js                             201.86 kB │ gzip: 63.37 kB
✓ built in 5.31s
$ npm run e2e
Running 6 tests using 3 workers

  ✓  3 [desktop] › flow.spec.ts:4:1 › seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests (3.3s)
  ✓  4 [desktop] › flow.spec.ts:80:1 › a completed HTTP 200 trace with no steps, sources or invariants is REVIEW, never green (398ms)
  ✓  1 [phone] › flow.spec.ts:4:1 › seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests (5.8s)
  ✓  2 [tablet] › flow.spec.ts:4:1 › seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests (5.9s)
  ✓  5 [phone] › flow.spec.ts:80:1 › a completed HTTP 200 trace with no steps, sources or invariants is REVIEW, never green (365ms)
  ✓  6 [tablet] › flow.spec.ts:80:1 › a completed HTTP 200 trace with no steps, sources or invariants is REVIEW, never green (369ms)

  6 passed (6.8s)
```

## What the suites cover

- **Fail-closed import probes (Vitest, 15 tests, also in `src/domain/validation.test.ts`):** a trace that reuses a seed id with different content (wrong-target content under the healthy id) is rejected, so verdicts and exports cannot mix; two traces sharing an id reject the whole batch; any error in a batch imports nothing; an exported fixture identical to a loaded seed is verified but not added twice; source `asOf` values `yesterday`, `2026`, `2026-10-01`, `2026-13-01T00:00:00Z`, `2026-02-30T00:00:00Z`, `2026-10-01T25:00:00Z` and a timestamp without timezone are rejected; `amount: "480 GBP"` is rejected at import and FAILs `INV-approval` if evaluated directly; a missing amount on a tool under an approval rule is rejected; `granted: "false"` is rejected at import and is not treated as granted by the validator; a wrapper with no `expected` imports and reproduces nothing.
- **Validation hardening (Vitest, 35 tests, `src/domain/validation.test.ts`):** a completed HTTP 200 trace with `steps=[]`, `sources=[]` and `policy.invariants=[]` evaluates as REVIEW (`EVIDENCE-COVERAGE`), never PASS, both directly and after JSON import and fixture round trip; invariants that pass vacuously (allow-list with no tool calls, idempotency with no executions, approvals with no calls, latency budget) do not count as evidence; 18 nested-schema rejections (task, policy, invariant fields per kind, step kind/timing/HTTP status, duplicate ids, sources, claims citing unknown sources, output, abstention reason); 10 fixture-wrapper rejections (schema, fingerprint, validator version, `expected.*`, missing trace, nested trace errors), none of which throw.
- **Unit (Vitest, 21 tests, `src/domain/domain.test.ts`):** the expected transport/task verdict and first failed assertion for all 16 fixtures, green-HTTP-but-task-failure, safe abstention leading to REVIEW, determinism, release delta classification and gate counts, fixture export/re-import round trip, tamper detection, rejection of malformed JSON and unknown validators, alert length, and memo wording.
- **E2E (Playwright, Chromium, `e2e/flow.spec.ts`, at 1366×900, 820×1180 and 390×844):** seed → validate both releases → healthy PASS → wrong target blocked with its exact assertion → fixture download (JSON parsed and checked) → reviewer note → memo download (note present) → baseline safe abstention → invalid JSON error → re-import of the exported fixture reproduces and is not added twice → a different trace reusing the healthy seed id is rejected ("Nothing imported") and Healthy stays PASS → example trace imports → reload persists → reset. It also asserts **zero requests to any non-localhost origin** and **no horizontal overflow** at each width. A second spec imports the zero-evidence probe through the UI and checks Transport PASS, Task REVIEW, the review panel and the `EVIDENCE-COVERAGE` row, with no overflow ([desktop](screenshots/zero-evidence-review-desktop.png), [tablet](screenshots/zero-evidence-review-tablet.png), [phone](screenshots/zero-evidence-review-phone.png)).

## Visual inspection

Screenshots of the production build were inspected at each width ([`docs/screenshots/`](screenshots/)).

| Width | Finding | Fix |
|---|---|---|
| 1366 desktop | Three-column layout readable; no overflow | none |
| 820 tablet | Page overflowed horizontally by 687 px, because the run list was a single horizontal row | Run list changed to a wrapping grid; re-measured overflow is 0 px |
| 390 phone | Single column; selecting a run did not bring the detail into view | Selecting a run on narrow screens scrolls to the run detail |

Re-measured `scrollWidth − innerWidth` after the fixes: desktop 0 px, tablet 0 px, phone 0 px.

## Not yet tested

- No signed-out check of a public URL yet, because no public deployment exists at the time of writing (see the README's Hosting section).
- No screen-reader pass with assistive technology. Labels, roles and keyboard order were checked by hand and through Playwright role queries only.
- No testing with real users.
