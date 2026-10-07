import { FIXTURE_SCHEMA, fingerprint } from './exports'
import type { Trace } from './types'
import { evaluate } from './validators'

export interface ImportResult {
  traces: Trace[]
  errors: string[]
  reproduced: { id: string; match: boolean; detail: string }[]
}

const KINDS = ['tools_allowed', 'target_matches', 'max_source_age', 'latency_budget', 'approval_required', 'complete_all', 'idempotent', 'claims_grounded']

function validateTrace(t: unknown, where: string): string[] {
  const e: string[] = []
  if (!t || typeof t !== 'object') return [`${where}: not an object`]
  const x = t as Record<string, unknown>
  for (const k of ['id', 'scenario', 'title', 'agent', 'release', 'startedAt']) if (typeof x[k] !== 'string') e.push(`${where}.${k} must be a string`)
  if (typeof x.startedAt === 'string' && Number.isNaN(Date.parse(x.startedAt))) e.push(`${where}.startedAt is not an ISO date`)
  const task = x.task as Record<string, unknown> | undefined
  if (!task || typeof task.goal !== 'string') e.push(`${where}.task.goal must be a string`)
  const policy = x.policy as Record<string, unknown> | undefined
  if (!policy || !Array.isArray(policy.invariants)) e.push(`${where}.policy.invariants must be an array`)
  else (policy.invariants as Record<string, unknown>[]).forEach((inv, i) => { if (!KINDS.includes(String(inv?.kind))) e.push(`${where}.policy.invariants[${i}].kind "${inv?.kind}" is not a known validator`) })
  if (!Array.isArray(x.steps)) e.push(`${where}.steps must be an array`)
  else (x.steps as Record<string, unknown>[]).forEach((s, i) => { if (typeof s?.id !== 'string' || typeof s?.startMs !== 'number' || typeof s?.durationMs !== 'number') e.push(`${where}.steps[${i}] needs id, startMs, durationMs`) })
  if (!Array.isArray(x.sources)) e.push(`${where}.sources must be an array`)
  const out = x.output as Record<string, unknown> | undefined
  if (!out || typeof out.httpStatus !== 'number' || !['completed', 'abstained'].includes(String(out.status)) || !Array.isArray(out.claims)) e.push(`${where}.output needs httpStatus, status (completed|abstained), claims[]`)
  return e
}

export function importTraces(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (err) {
    return { traces: [], errors: [`Invalid JSON: ${(err as Error).message}`], reproduced: [] }
  }
  const items = Array.isArray(data) ? data : [data]
  const res: ImportResult = { traces: [], errors: [], reproduced: [] }
  items.forEach((item, i) => {
    const where = items.length > 1 ? `[${i}]` : 'trace'
    const wrapped = item && typeof item === 'object' && (item as Record<string, unknown>).schema === FIXTURE_SCHEMA
    const trace = wrapped ? (item as Record<string, unknown>).trace : item
    const errs = validateTrace(trace, wrapped ? `${where}.trace` : where)
    if (errs.length) { res.errors.push(...errs); return }
    const t = trace as Trace
    res.traces.push(t)
    if (wrapped) {
      const f = item as { fingerprint: string; expected: { task: string; transport: string; failedAssertions: string[] } }
      const ev = evaluate(t)
      const failed = ev.assertions.filter((a) => a.status === 'fail').map((a) => a.id).join(',')
      const match = fingerprint(t) === f.fingerprint && ev.task === f.expected.task && ev.transport.status === f.expected.transport && failed === f.expected.failedAssertions.join(',')
      res.reproduced.push({ id: t.id, match, detail: match ? `Reproduced: task ${ev.task.toUpperCase()}, fingerprint ${f.fingerprint}` : `Mismatch: expected ${f.expected.task}, got ${ev.task} (fingerprint ${fingerprint(t)} vs ${f.fingerprint})` })
    }
  })
  return res
}
