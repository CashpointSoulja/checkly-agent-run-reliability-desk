# Walkthrough video script

Recorded from the production build of this app in a 1280×720 desktop browser window (rendered at 1920×1080). All interactions are real clicks in the working UI. The narration uses a stock text-to-speech voice, not a cloned voice. No face appears.

- File: [`docs/video/walkthrough.mp4`](video/walkthrough.mp4) (about 76 s, H.264/AAC, burned-in subtitles)
- Subtitles: [`captions.srt`](video/captions.srt) · [`captions.vtt`](video/captions.vtt)

| Start | End | Narration (caption) | On screen |
|---|---|---|---|
| 00.30 | 04.70 | This is the Agent Run Reliability Desk, an independent concept for Checkly. | Initial seeded state, candidate release, Healthy selected (not yet validated) |
| 04.80 | 09.88 | Its premise: a green HTTP status is not proof that an agent did the right job. | Same view: synthetic/local-only banner and disclaimer |
| 09.98 | 13.68 | Eight synthetic fixtures are seeded across two agent releases. | Pointer moves over the seeded run list |
| 13.78 | 19.49 | You can also paste or upload your own JSON trace. It is evaluated locally, with no telemetry. | Click Load JSON trace, then Insert example trace |
| 19.59 | 26.40 | Running the validators applies deterministic rules, not AI scores, to every step, tool call and source. | Close import; click Run validators on both releases |
| 26.50 | 32.94 | The healthy refund passes both layers: HTTP 200, and every declared invariant holds. | Healthy run: Transport PASS, Task PASS; scroll to all-passing assertions |
| 33.04 | 39.52 | Now the wrong tool target. Transport passed with HTTP 200, but the task failed. | Click Wrong tool target: Transport PASS, Task FAIL |
| 39.62 | 46.25 | The exact assertion shows the agent updated ticket T-818 instead of T-881, at step s3. | Exact failed assertion INV-ticket-target, Actual "T-818", step s3 |
| 46.35 | 51.55 | Against the baseline, six scenarios regressed, so the release gate blocks the candidate. | Release gate: Release blocked, 6 regressions |
| 51.65 | 55.87 | In the baseline, the agent saw a stale status snapshot and abstained. | Click Baseline v2.3.1, then Stale source: Task REVIEW |
| 55.97 | 60.54 | That is a safe outcome, so a human confirms it instead of it counting as a failure. | Click Abstention confirmed correct |
| 60.64 | 65.98 | Finally, export a reproducible fixture with its fingerprint, and a review memo for the hand-off. | Back to candidate wrong target; download fixture JSON and review memo |
| 66.08 | 69.94 | The alert preview stays concise, and it is never sent anywhere. | Scroll to the alert preview, labelled Preview only, not sent |
| 70.04 | 75.90 | Independent concept by Ayo Ahmed. Not affiliated with Checkly. All data is synthetic. | Scroll to top; disclaimer visible |
