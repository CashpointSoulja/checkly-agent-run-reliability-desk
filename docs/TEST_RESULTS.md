# Test results

These are actual outputs from the run on 2026-10-07 (UTC), Node v22.23.3, on the commit that adds this file. ANSI colours have been stripped and the build output has been trimmed to its last lines.

```text
$ npm run typecheck
exit 0
$ npm run lint
exit 0
$ npm test

 ✓ src/domain/domain.test.ts (21 tests) 7ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  02:14:04
   Duration  240ms (transform 69ms, setup 0ms, collect 78ms, tests 7ms, environment 0ms, prepare 38ms)

$ npm run build
dist/assets/inter-latin-ext-600-normal-BnYJhD27.woff2      31.97 kB
dist/assets/inter-latin-ext-400-normal-C1t-h-pH.woff       42.88 kB
dist/assets/inter-latin-ext-500-normal-UMdmhHu2.woff       43.84 kB
dist/assets/inter-latin-ext-700-normal-6V9MnIL5.woff       43.94 kB
dist/assets/inter-latin-ext-600-normal-CAF0vJDd.woff       43.98 kB
dist/assets/index-BesTcXgt.css                             20.95 kB │ gzip:  4.47 kB
dist/assets/index-CGVxPJON.js                             191.62 kB │ gzip: 60.26 kB
✓ built in 5.71s
$ npm run e2e

Running 3 tests using 3 workers

  ✓  1 [desktop] › flow.spec.ts:4:1 › seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests (2.9s)
  ✓  2 [tablet] › flow.spec.ts:4:1 › seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests (4.7s)
  ✓  3 [phone] › flow.spec.ts:4:1 › seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests (4.7s)

  3 passed (5.3s)
```

## What the suites cover

- **Unit (Vitest, 21 tests, `src/domain/domain.test.ts`):** the expected transport/task verdict and first failed assertion for all 16 fixtures, green-HTTP-but-task-failure, safe abstention leading to REVIEW, determinism, release delta classification and gate counts, fixture export/re-import round trip, tamper detection, rejection of malformed JSON and unknown validators, alert length, and memo wording.
- **E2E (Playwright, Chromium, `e2e/flow.spec.ts`, at 1366×900, 820×1180 and 390×844):** seed → validate both releases → healthy PASS → wrong target blocked with its exact assertion → fixture download (JSON parsed and checked) → reviewer note → memo download (note present) → baseline safe abstention → invalid JSON error → re-import of the exported fixture reproduces → reload persists → reset. It also asserts **zero requests to any non-localhost origin** and **no horizontal overflow** at each width.

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
