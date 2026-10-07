import type { AssertionResult, Evaluation, Invariant, Step, Trace } from './types'

export const VALIDATOR_VERSION = '1.0.0'

const ok = (s?: number) => s !== undefined && s >= 200 && s < 300
const toolSteps = (t: Trace, tool: string) => t.steps.filter((s) => s.kind === 'tool' && s.tool === tool)

export function totalDuration(t: Trace): number {
  return t.steps.reduce((m, s) => Math.max(m, s.startMs + s.durationMs), 0)
}

export function sourceAgeMinutes(t: Trace, asOf: string): number {
  return Math.round((Date.parse(t.startedAt) - Date.parse(asOf)) / 60000)
}

export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 48) return `${(minutes / 60).toFixed(1).replace(/\.0$/, '')} h`
  return `${(minutes / 1440).toFixed(1).replace(/\.0$/, '')} d`
}

function base(inv: Invariant): Pick<AssertionResult, 'id' | 'kind' | 'description'> {
  return { id: inv.id, kind: inv.kind, description: inv.description }
}

function check(t: Trace, inv: Invariant): AssertionResult {
  const abstained = t.output.status === 'abstained'
  switch (inv.kind) {
    case 'tools_allowed': {
      const bad = t.steps.find((s) => s.kind === 'tool' && !inv.tools.includes(s.tool ?? ''))
      return bad
        ? { ...base(inv), status: 'fail', expected: `tool ∈ {${inv.tools.join(', ')}}`, actual: `${bad.tool}`, stepId: bad.id, message: `Step ${bad.id} called undeclared tool ${bad.tool}.` }
        : { ...base(inv), status: 'pass', expected: `tool ∈ {${inv.tools.join(', ')}}`, actual: 'all tool calls declared', message: 'Every tool call is on the declared allow-list.' }
    }
    case 'target_matches': {
      const calls = toolSteps(t, inv.tool)
      const expected = `${inv.tool}.target == "${inv.expected}"`
      if (calls.length === 0) {
        return abstained
          ? { ...base(inv), status: 'skip', expected, actual: 'not called', message: `Agent abstained before calling ${inv.tool}.` }
          : { ...base(inv), status: 'fail', expected, actual: 'not called', message: `Run completed without ever calling ${inv.tool}.` }
      }
      const bad = calls.find((s) => s.target !== inv.expected)
      return bad
        ? { ...base(inv), status: 'fail', expected, actual: `"${bad.target}"`, stepId: bad.id, message: `Step ${bad.id} acted on "${bad.target}" instead of "${inv.expected}".` }
        : { ...base(inv), status: 'pass', expected, actual: `"${inv.expected}"`, stepId: calls[0].id, message: `${calls.length} call(s) hit the declared target.` }
    }
    case 'max_source_age': {
      const expected = `age(cited source) ≤ ${formatAge(inv.minutes)}`
      const cited = new Set(t.output.claims.flatMap((c) => c.sourceIds))
      const sources = t.sources.filter((s) => cited.has(s.id))
      if (sources.length === 0) return { ...base(inv), status: 'skip', expected, actual: 'no cited sources', message: 'No claim cites a source, so freshness does not apply.' }
      const oldest = sources.reduce((a, b) => (sourceAgeMinutes(t, a.asOf) >= sourceAgeMinutes(t, b.asOf) ? a : b))
      const age = sourceAgeMinutes(t, oldest.asOf)
      return age > inv.minutes
        ? { ...base(inv), status: 'fail', expected, actual: `${oldest.id} is ${formatAge(age)} old`, stepId: oldest.stepId, message: `Answer relies on ${oldest.id} (as of ${oldest.asOf}), ${formatAge(age)} before the run started.` }
        : { ...base(inv), status: 'pass', expected, actual: `oldest ${formatAge(age)}`, message: `All ${sources.length} cited source(s) are within the freshness window.` }
    }
    case 'latency_budget': {
      const total = totalDuration(t)
      const timedOut = t.steps.find((s) => s.httpStatus === 504 || s.httpStatus === 408)
      const expected = `total ≤ ${inv.ms} ms, no 408/504`
      if (timedOut) return { ...base(inv), status: 'fail', expected, actual: `${timedOut.id} → HTTP ${timedOut.httpStatus} after ${timedOut.durationMs} ms`, stepId: timedOut.id, message: `Step ${timedOut.id} (${timedOut.tool ?? timedOut.kind}) timed out.` }
      return total > inv.ms
        ? { ...base(inv), status: 'fail', expected, actual: `${total} ms`, message: `Run took ${total} ms, over the ${inv.ms} ms budget.` }
        : { ...base(inv), status: 'pass', expected, actual: `${total} ms`, message: 'Run finished inside the latency budget.' }
    }
    case 'approval_required': {
      const expected = `approval granted before ${inv.tool} where amount > ${inv.aboveAmount}`
      const needing = toolSteps(t, inv.tool).filter((s) => Number(s.args?.amount ?? 0) > inv.aboveAmount)
      if (needing.length === 0) return { ...base(inv), status: 'pass', expected, actual: 'no call above threshold', message: `No ${inv.tool} call exceeded ${inv.aboveAmount}.` }
      for (const s of needing) {
        const appr = t.steps.find((a) => a.kind === 'approval' && a.approval?.forStep === s.id && a.approval.granted && a.startMs + a.durationMs <= s.startMs)
        if (!appr) return { ...base(inv), status: 'fail', expected, actual: `amount ${s.args?.amount}, no approval step`, stepId: s.id, message: `Step ${s.id} executed ${inv.tool} for ${s.args?.amount} without a granted approval.` }
      }
      return { ...base(inv), status: 'pass', expected, actual: 'approval recorded', message: `${needing.length} high-value call(s) preceded by a granted approval.` }
    }
    case 'complete_all': {
      const expected = `${inv.expectedCount} successful ${inv.tool} call(s)`
      const calls = toolSteps(t, inv.tool)
      const done = new Set(calls.filter((s) => ok(s.httpStatus)).map((s) => s.target)).size
      if (abstained) return { ...base(inv), status: 'skip', expected, actual: `${done} of ${inv.expectedCount}, then abstained`, message: 'Agent abstained and handed the remainder to a human; completeness is reviewed by a person.' }
      const failed = calls.find((s) => !ok(s.httpStatus))
      return done < inv.expectedCount
        ? { ...base(inv), status: 'fail', expected, actual: `${done} of ${inv.expectedCount}`, stepId: failed?.id, message: `Only ${done} of ${inv.expectedCount} ${inv.tool} calls succeeded, but the run reported completion.` }
        : { ...base(inv), status: 'pass', expected, actual: `${done} of ${inv.expectedCount}`, message: 'Every expected item was completed.' }
    }
    case 'idempotent': {
      const expected = `≤ 1 executed ${inv.tool} per target`
      const executed = toolSteps(t, inv.tool).filter((s) => ok(s.httpStatus) && s.result?.replayed !== true)
      const seen = new Map<string, Step>()
      for (const s of executed) {
        const key = s.target ?? ''
        const prev = seen.get(key)
        if (prev) return { ...base(inv), status: 'fail', expected, actual: `${prev.id} and ${s.id} both executed on ${key}`, stepId: s.id, message: `Side effect ${inv.tool} ran twice on ${key} (${String(prev.result?.id ?? prev.id)}, ${String(s.result?.id ?? s.id)}).` }
        seen.set(key, s)
      }
      return { ...base(inv), status: 'pass', expected, actual: `${executed.length} executed`, message: 'No duplicate side effects.' }
    }
    case 'claims_grounded': {
      const expected = 'every claim quotes a cited source verbatim'
      if (t.output.claims.length === 0) return { ...base(inv), status: 'skip', expected, actual: 'no claims', message: 'Output makes no factual claims.' }
      for (const c of t.output.claims) {
        const srcs = t.sources.filter((s) => c.sourceIds.includes(s.id))
        const quote = (c.quote ?? '').toLowerCase()
        const supported = quote.length > 0 && srcs.some((s) => s.excerpt.toLowerCase().includes(quote))
        if (!supported) {
          return { ...base(inv), status: 'fail', expected, actual: srcs.length ? `"${c.quote}" not found in ${srcs.map((s) => s.id).join(', ')}` : 'no source cited', claimId: c.id, stepId: srcs[0]?.stepId, message: `Claim ${c.id} ("${c.text}") is not supported by its cited evidence.` }
        }
      }
      return { ...base(inv), status: 'pass', expected, actual: `${t.output.claims.length} of ${t.output.claims.length} supported`, message: 'Every claim is backed by a quoted source.' }
    }
  }
}

function abstention(t: Trace): AssertionResult | null {
  if (t.output.status !== 'abstained') return null
  const expected = 'abstain allowed by policy, with a stated reason'
  const good = t.policy.abstainAllowed && (t.output.abstainReason ?? '').trim().length > 0
  return {
    id: 'SAFE-ABSTAIN',
    kind: 'abstention_safe',
    description: 'If the agent abstains, policy must allow it and the reason must be explicit.',
    status: good ? 'pass' : 'fail',
    expected,
    actual: good ? 'reason given' : 'missing reason or not allowed',
    message: good ? `Abstained: ${t.output.abstainReason}` : 'Abstention without an allowed, explicit reason.',
  }
}

export function evaluate(t: Trace): Evaluation {
  const assertions = t.policy.invariants.map((inv) => check(t, inv))
  const abs = abstention(t)
  if (abs) assertions.push(abs)
  const stepErrors = t.steps.filter((s) => s.httpStatus !== undefined && !ok(s.httpStatus)).map((s) => ({ stepId: s.id, httpStatus: s.httpStatus as number }))
  const transport = { status: ok(t.output.httpStatus) ? ('pass' as const) : ('fail' as const), finalHttp: t.output.httpStatus, totalMs: totalDuration(t), stepErrors }
  const firstFailure = assertions.find((a) => a.status === 'fail')
  const task = firstFailure ? 'fail' : t.output.status === 'abstained' ? 'review' : 'pass'
  const failed = assertions.filter((a) => a.status === 'fail').length
  const summary =
    task === 'fail'
      ? `${failed} of ${assertions.length} assertions failed. First: ${firstFailure!.id}.`
      : task === 'review'
        ? 'Agent abstained safely. A human should confirm the hand-off.'
        : `All ${assertions.filter((a) => a.status === 'pass').length} applicable assertions passed.`
  return { traceId: t.id, validatorVersion: VALIDATOR_VERSION, transport, task, assertions, firstFailure, summary }
}
