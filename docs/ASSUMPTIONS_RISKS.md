# Assumptions and risks

## Assumptions (to validate, not proven)

| # | Assumption | How to test cheaply | Kill signal |
|---|---|---|---|
| A1 | Teams running agents in production see green-but-wrong runs often enough to care | 10 interviews with SRE/platform owners of agent workflows; ask for the last wrong-but-200 incident | Fewer than 3 of 10 can name one in the last quarter |
| A2 | A meaningful share of those failures can be expressed as deterministic invariants | Ask design partners to write invariants for 20 real incidents (anonymised) | Under 50% expressible without a model-based judge |
| A3 | Traces already contain the needed facts (target, args, approvals, sources) | Map 3 partners' existing OTel spans to the schema | Key fields missing in 2 of 3 |
| A4 | Engineers will author and maintain invariants as code | Time-to-first-invariant in a pairing session | Over 30 minutes, or abandoned |
| A5 | Safe abstention is valued, not seen as failure | Show baseline vs candidate abstention cases to 5 owners | Owners treat REVIEW as FAIL and want it hidden |

## Risks

- **Overlap with AI root-cause features.** Checkly publicly ships Rocky AI for analysis. The desk is positioned as the deterministic contract *before* analysis, not as a replacement. Mitigation: present it as the input that makes RCA sharper.
- **Schema lock-in.** A bespoke trace schema could fight OpenTelemetry. Mitigation: v2 maps from OTel GenAI conventions, and the schema here is a teaching format.
- **False confidence.** Passing every invariant does not prove correctness; it proves the declared contract held. The UI says "applicable assertions passed", not "correct".
- **Synthetic bias.** All eight scenarios were written by the author to illustrate failure classes. Real distributions are unknown.
- **Trace trust.** `idempotent` and `approval_required` trust what the trace reports. A buggy tracer could hide a duplicate. See v2 item 4.
- **Brand confusion.** Mitigated by the permanent non-affiliation label, footer notice and README.
