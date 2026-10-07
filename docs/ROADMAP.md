# v2 roadmap

These items are ordered by how much each one would reduce risk in the riskiest assumption (see [ASSUMPTIONS_RISKS.md](ASSUMPTIONS_RISKS.md)). None of them is built.

1. **Invariants as code next to checks.** A small TypeScript construct (`new AgentRunInvariant(...)`) that lives in the same repo as monitoring code and is reviewed in the PR. Validate the shape with 5 design partners before writing it.
2. **OpenTelemetry ingestion.** Map GenAI semantic-convention spans (`gen_ai.*`, tool-call spans) onto the trace schema so no custom logging is needed. Start with an offline file import, not a live connection.
3. **Replay suites in CI.** Run the same fixture set against a candidate agent build in a PR and post the release-gate table as a comment. Blocking stays opt-in.
4. **Ledger-backed side-effect checks.** Today `idempotent` trusts the trace. v2 would reconcile against a read-only export of the system of record (refund ledger, email provider log).
5. **Abstention analytics.** Track the abstain rate per release and per policy so that "the agent got more confident" shows up as a regression signal.
6. **Rule authoring help (optional, clearly labelled).** Suggest candidate invariants from past traces for a human to accept. Suggestions never gate anything until they are reviewed and committed.
7. **Alert routing.** Turn the preview into real channel delivery only behind explicit configuration, with the same concise format.

**Explicitly out of scope for v2:** opaque quality scores, autonomous remediation, and any live connection that runs without a reviewed configuration.
