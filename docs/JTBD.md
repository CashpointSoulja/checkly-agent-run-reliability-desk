# Jobs to be done

## Primary job

> **When** a new release of our agent goes out, **I want to** know whether it still does the *right* job and not just whether it returns 200, **so I can** block a bad release before customers see a wrong refund, a stale answer or a duplicated side effect.

The person doing it is a platform, SRE or AI engineer who owns an agent-backed workflow in production (support ops, finance ops, incident tooling).

## Related jobs

| Job | Today's workaround | What the desk offers |
|---|---|---|
| Prove a run did the requested task | Read the raw trace by hand, or trust the 200 | Transport and Task verdicts shown side by side, with the exact failed assertion |
| Catch silent regressions between agent versions | Eyeball a few runs after deploy | Same scenarios replayed against baseline and candidate, labelled regression / fixed / still failing |
| Know when the agent *should* have stopped | Nothing, because abstentions look like failures | Safe abstention is a first-class REVIEW verdict with a human decision |
| Hand off an incident | Screenshots in Slack | Reproducible fixture JSON with fingerprint, plus a Markdown review memo |
| Page the right person with the right detail | Generic "check failed" alert | A three-to-five-line alert that names the invariant, expected vs actual and the step |

## Forces

- **Push:** agents now take side-effecting actions such as refunds, emails and ticket updates. A wrong action that returns 200 is worse than an outage because nobody gets paged.
- **Pull:** teams already write monitoring as code. Invariants written as code sit naturally next to their checks.
- **Anxiety:** "Will this become another flaky eval score?" That is why the desk uses deterministic rules with no scoring.
- **Habit:** status-code and latency assertions are the default because they are easy. The desk keeps them and adds a second layer next to them.
