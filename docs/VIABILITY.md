# Viability memo: why this concept fits the role

Independent concept by Ayo Ahmed. Not affiliated with Checkly. This memo ties the prototype to the public job description *Product Manager (DevTools & AI Reliability, remote)* (https://jobs.ashbyhq.com/checkly/8a10b860-5b29-414e-ac25-97a6a86b866f, checked 2026-10-07). It does not claim knowledge of Checkly's internal plans or systems.

## What the JD asks for, and how this prototype responds

| JD (quoted) | This prototype |
|---|---|
| "Nobody has really figured out what reliability means for this kind of software yet. That's the problem you'd own." | It proposes one concrete, testable definition: a run is reliable when its *declared invariants* hold, which is separate from transport health. |
| "Agents take actions no runbook anticipated." (The JD also notes that model-backed features fail probabilistically.) | It separates the failures that are probabilistic from the ones that are deterministic facts in the trace (wrong target, missing approval, duplicate side effect) and gates on the latter. |
| "Shape Checkly's point of view on reliability in an AI-native world: how teams monitor AI-generated code, agent-driven workflows …" | The point of view is "a green HTTP status is not proof that an agent completed the correct job", made inspectable in a working tool. |
| "monitoring defined as code … versioned and reviewed like everything else they ship" | Invariants are declarative data with stable IDs, versioned per policy (`refunds-policy@2026.10`). The v2 roadmap puts them in code next to checks. |
| "powered by OpenTelemetry and Playwright" | The trace schema is deliberately span-like, and v2 maps from OTel GenAI conventions. The e2e suite itself runs on Playwright. |
| "reason about APIs, MCPs, CLIs, and how systems fit together" | The fixtures model tool calls, targets, idempotency keys, approvals and source provenance at the API level. |
| "You can prototype in code, throw together a mock, or pressure-test technical viability yourself" | This is a typed, tested, deployed prototype, not a deck. |
| "You ship with AI where it helps and know when not to." | The deliberate choice here is to *not* score with a model where a deterministic rule is exact, and to label every simulated element. |
| "We write more than we talk." | The full PM package (PRD, JTBD, five whys, metrics, risks, roadmap, test evidence) is written for async review. |
| "Customer signals come first … most of the time they beat your gut." | The riskiest assumptions are listed with cheap tests and kill signals before any build-out ([ASSUMPTIONS_RISKS.md](ASSUMPTIONS_RISKS.md)). |

## Where it would sit (hypothesis)

Checkly publicly offers API and browser checks with assertions, alerting, monitoring as code and AI-assisted analysis. A natural extension, if customer research supported it, is a **task-level assertion layer for agent-backed endpoints**: the same check that asserts `status == 200` could also assert that the run's trace satisfies declared invariants. It would complement AI root-cause analysis by giving it a precise failed contract to explain.

## What would make this a bad bet

- Agent owners cannot point to recent green-but-wrong incidents (A1).
- Most real failures need judgment rather than rules (A2).
- The needed facts are not in traces today (A3).

Each has a cheap test in [ASSUMPTIONS_RISKS.md](ASSUMPTIONS_RISKS.md).
