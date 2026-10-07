# Five whys

**Symptom (hypothesis):** an agent-backed workflow passes its synthetic check with HTTP 200 while doing the wrong thing, for example refunding twice or citing a three-day-old status page.

1. **Why did the check pass?** It asserted transport: status code, latency and maybe a JSON field. The response was well formed.
2. **Why is transport not enough?** For agents, the HTTP layer is a wrapper around a plan of tool calls. The failure lives *inside* the run: wrong target, missing approval, a retry without an idempotency key.
3. **Why aren't those inside-the-run facts asserted?** Teams have traces but no declared contract for what a correct run looks like. Policies live in prompts and runbooks rather than in code.
4. **Why aren't policies declared as code?** Agent output feels non-deterministic, so teams reach for probabilistic scoring ("model judge: 0.82"). Nobody trusts a score enough to gate a release on it, so nothing gets gated.
5. **Why does that matter?** Many agent failures are *not* probabilistic. "Refund issued twice", "target ≠ requested ticket" and "claim not found in the cited source" are deterministic facts in the trace. They can be checked exactly and gated on.

**Root cause (hypothesis):** there is no deterministic, declared contract between the task and the trace, so transport success stands in for task success.

**Countermeasure in this prototype:** declared invariants per policy, deterministic validators over the trace, a separate Task verdict, and safe abstention as an explicit, reviewable outcome.
