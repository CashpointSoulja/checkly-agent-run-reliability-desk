import type { ComparisonRow } from '../domain/compare'
import type { Evaluation, Trace } from '../domain/types'
import { formatAge, sourceAgeMinutes, totalDuration } from '../domain/validators'
import { StatusChip } from './StatusChip'

interface Props {
  trace: Trace
  evaluation?: Evaluation
  row?: ComparisonRow
  onRun: () => void
  review: { decision?: string; note?: string }
  onReview: (r: { decision?: string; note?: string }) => void
}

const httpKind = (s?: number) => (s === undefined ? undefined : s >= 200 && s < 300 ? 'pass' : 'fail')

export function RunDetail({ trace: t, evaluation: e, row, onRun, review, onReview }: Props) {
  const total = Math.max(totalDuration(t), 1)
  const failedSteps = new Map<string, string[]>()
  e?.assertions.filter((a) => a.status === 'fail' && a.stepId).forEach((a) => failedSteps.set(a.stepId!, [...(failedSteps.get(a.stepId!) ?? []), a.id]))
  const failedClaims = new Set(e?.assertions.filter((a) => a.status === 'fail' && a.claimId).map((a) => a.claimId))

  return (
    <article className="panel run-detail">
      <header className="detail-head">
        <div>
          <p className="eyebrow"><code>{t.id}</code> · {t.agent}</p>
          <h1>{t.title}</h1>
          <p className="goal"><b>Task:</b> {t.task.goal} <span className="muted">Requested by {t.task.requestedBy}.</span></p>
        </div>
        <button className="btn primary" onClick={onRun}>{e ? 'Re-run validators' : 'Run validators'}</button>
      </header>

      {!e ? (
        <div className="not-run">
          <p><b>Not evaluated yet.</b> The trace below is the raw input: {t.steps.length} steps, {t.policy.invariants.length} declared invariants, {t.sources.length} source(s). Run validators to compare it with policy.</p>
        </div>
      ) : (
        <>
          <div className="verdicts">
            <div className={`verdict ${e.transport.status}`}>
              <span className="v-label">Transport</span>
              <StatusChip kind={e.transport.status} />
              <span className="v-detail">Final HTTP {e.transport.finalHttp} in {(e.transport.totalMs / 1000).toFixed(1)}s{e.transport.stepErrors.length ? ` · ${e.transport.stepErrors.length} non-2xx step(s)` : ''}</span>
            </div>
            <div className={`verdict ${e.task}`}>
              <span className="v-label">Task</span>
              <StatusChip kind={e.task} />
              <span className="v-detail">{e.summary}</span>
            </div>
          </div>
          {e.transport.status === 'pass' && e.task === 'fail' && (
            <p className="insight" role="note">HTTP {e.transport.finalHttp} came back, but the agent did not complete the right job. A status-code check alone would mark this run green.</p>
          )}
          {e.firstFailure && (
            <section className="failure" aria-label="Exact failed assertion">
              <h2>Exact failed assertion: <code>{e.firstFailure.id}</code></h2>
              <p>{e.firstFailure.message}</p>
              <dl>
                <div><dt>Rule</dt><dd><code>{e.firstFailure.kind}</code>: {e.firstFailure.description}</dd></div>
                <div><dt>Expected</dt><dd><code>{e.firstFailure.expected}</code></dd></div>
                <div><dt>Actual</dt><dd><code>{e.firstFailure.actual}</code></dd></div>
                {e.firstFailure.stepId && <div><dt>At step</dt><dd><a href={`#step-${e.firstFailure.stepId}`}><code>{e.firstFailure.stepId}</code></a></dd></div>}
              </dl>
            </section>
          )}
          {e.task === 'review' && (
            <section className="review-box" aria-label="Human review">
              <h2>{e.reviewReason === 'abstained' ? 'Human review needed: safe abstention' : 'Human review needed: not enough evidence for PASS'}</h2>
              <p>{e.reviewReason === 'abstained' ? t.output.abstainReason : `No failures, but nothing proves the job was done: ${e.coverage.steps} step(s), ${e.coverage.substantivePasses} non-vacuous assertion(s) from ${e.coverage.declaredInvariants} declared invariant(s). Add invariants or a fuller trace before trusting this run.`}</p>
              <div className="seg" role="group" aria-label="Review decision">
                {(e.reviewReason === 'abstained' ? ['Abstention confirmed correct', 'Escalated to owner'] : ['Needs invariants before release', 'Escalated to owner']).map((d) => (
                  <button key={d} aria-pressed={review.decision === d} onClick={() => onReview({ decision: d })}>{d}</button>
                ))}
              </div>
            </section>
          )}
          {row?.baseline && (
            <p className={`compare-line ${row.delta}`}>Baseline <StatusChip kind={row.baseline} compact /> → candidate <StatusChip kind={row.candidate} compact /> <b>{row.delta.replace('-', ' ')}</b></p>
          )}
        </>
      )}

      <section aria-label="Timeline">
        <h2 className="section-title">Timeline <span className="muted">{t.steps.length} steps · {total} ms</span></h2>
        <ol className="timeline">
          {t.steps.map((s) => {
            const fails = e ? failedSteps.get(s.id) : undefined
            return (
              <li key={s.id} id={`step-${s.id}`} className={`step ${s.kind}${fails ? ' failed' : ''}`}>
                <span className="t-id"><code>{s.id}</code><span className="muted">+{s.startMs}ms</span></span>
                <span className="t-main">
                  <span className="t-label">{s.kind === 'approval' ? '🛡 ' : ''}{s.label}</span>
                  {s.tool && <code className="t-tool">{s.tool}({s.target}{s.args ? `, ${Object.entries(s.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}` : ''})</code>}
                  {s.approval && <span className="t-note">Approval by {s.approval.approver}: {s.approval.granted ? 'granted' : 'denied'} for {s.approval.forStep}</span>}
                  {s.result && <span className="t-note">→ {JSON.stringify(s.result)}</span>}
                  {s.note && <span className="t-note">{s.note}</span>}
                  {s.sideEffect && <span className="tag side">side effect (simulated)</span>}
                  {fails && fails.map((f) => <span key={f} className="tag fail">{f}</span>)}
                </span>
                <span className="t-bar" aria-hidden="true"><span style={{ left: `${(s.startMs / total) * 100}%`, width: `${Math.max((s.durationMs / total) * 100, 1.5)}%` }} /></span>
                <span className="t-http">{s.httpStatus !== undefined ? <span className={`http ${httpKind(s.httpStatus)}`}>{s.httpStatus}</span> : <span className="muted">-</span>}<span className="muted">{s.durationMs}ms</span></span>
              </li>
            )
          })}
        </ol>
      </section>

      {e && (
        <section aria-label="Assertions">
          <h2 className="section-title">Assertions <span className="muted">validator v{e.validatorVersion}</span></h2>
          <ul className="assertions">
            {e.assertions.map((a) => (
              <li key={a.id} className={a.status}>
                <StatusChip kind={a.status} />
                <span className="a-main"><code>{a.id}</code> {a.description}<span className="a-msg">{a.message}</span></span>
                <span className="a-ea"><span><b>expected</b> <code>{a.expected}</code></span><span><b>actual</b> <code>{a.actual}</code></span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Output and evidence">
        <h2 className="section-title">Agent output and source evidence</h2>
        <blockquote className={`output ${t.output.status}`}><span className="tag">{t.output.status}</span> {t.output.message}</blockquote>
        {t.output.claims.length > 0 && (
          <ul className="claims">
            {t.output.claims.map((c) => (
              <li key={c.id} className={e ? (failedClaims.has(c.id) ? 'fail' : 'pass') : ''}>
                <code>{c.id}</code> “{c.text}”
                <span className="muted"> cites {c.sourceIds.join(', ') || 'nothing'}; quoted: “{c.quote}”</span>
              </li>
            ))}
          </ul>
        )}
        {t.sources.length > 0 ? (
          <ul className="sources">
            {t.sources.map((s) => (
              <li key={s.id}>
                <div className="s-head"><code>{s.id}</code> <b>{s.title}</b></div>
                <div className="s-meta"><code>{s.uri}</code> · as of {s.asOf.replace('T', ' ').replace(':00Z', ' UTC')} · <b>{formatAge(sourceAgeMinutes(t, s.asOf))} old</b> at run start{s.stepId ? ` · fetched in ${s.stepId}` : ''}</div>
                <p className="s-excerpt">{s.excerpt}</p>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">No external sources were used in this run.</p>}
      </section>

      <section aria-label="Declared policy">
        <h2 className="section-title">Declared policy <span className="muted"><code>{t.policy.id}@{t.policy.version}</code> · abstain {t.policy.abstainAllowed ? 'allowed' : 'not allowed'}</span></h2>
        <ul className="policy">
          {t.policy.invariants.map((i) => <li key={i.id}><code>{i.id}</code> <span className="muted">{i.kind}</span> {i.description}</li>)}
        </ul>
        <details className="raw">
          <summary>Raw trace JSON</summary>
          <pre>{JSON.stringify(t, null, 2)}</pre>
        </details>
      </section>

      <section aria-label="Notes for the review memo">
        <label className="section-title" htmlFor={`note-${t.id}`}>Reviewer note <span className="muted">stored in this browser only, included in the memo</span></label>
        <textarea id={`note-${t.id}`} className="note" value={review.note ?? ''} onChange={(ev) => onReview({ note: ev.target.value })} placeholder="e.g. Block release; add idempotency key to refunds.issue retries." />
      </section>
    </article>
  )
}
