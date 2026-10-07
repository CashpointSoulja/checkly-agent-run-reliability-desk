# Test plan

| Layer | Tool | What is covered | Command |
|---|---|---|---|
| Types | TypeScript `tsc -b` (strict) | Whole app and domain | `npm run typecheck` |
| Lint | ESLint (typescript-eslint, react-hooks) | Whole repo | `npm run lint` |
| Unit | Vitest | Each of the 8 candidate scenarios: transport verdict, task verdict, first failed invariant. Exact failure details (step, actual). Baseline abstentions → REVIEW. Determinism. Release deltas and gate. Fixture round-trip, tamper detection, malformed JSON, unknown validator kinds. Alert length and "Not sent". Memo green-but-wrong note | `npm test` |
| Build | Vite production build | Bundles and assets | `npm run build` |
| E2E | Playwright (Chromium) at 1366×900, 820×1180, 390×844 | Disclaimer and synthetic banner visible → 8 runs "not run" → run validators → gate BLOCKED with exact counts → healthy PASS → wrong target: transport PASS, task FAIL, exact assertion `INV-ticket-target` with `"T-818"` → alert says "Not sent" → download fixture and check its expected verdict → add a reviewer note, download the memo and check it contains the note → baseline stale source shows safe abstention, record the decision → invalid JSON error → re-import the downloaded fixture, which reproduces → reload keeps state → reset clears → no horizontal overflow → **zero requests to any non-local host** | `npm run e2e` |
| Visual | Playwright screenshots, inspected by eye | Desktop 1366, tablet 820, phone 390, before and after validation | `docs/screenshots/` |

## Manual checks

- Keyboard: tab through the toolbar, run list, review buttons and export buttons, and check that the focus ring is visible.
- The `prefers-reduced-motion` setting removes the staggered reveal.
- The live URL opens signed out in a fresh browser profile with no login.
