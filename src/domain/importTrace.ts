import { FIXTURE_SCHEMA, fingerprint } from './exports'
import type { Trace } from './types'
import { evaluate } from './validators'

export interface ImportResult {
  traces: Trace[]
  errors: string[]
  warnings: string[]
  /** Traces identical to one already loaded (same id and fingerprint): verified, not added twice. */
  alreadyLoaded: string[]
  reproduced: { id: string; match: boolean; detail: string }[]
}

export const IMPORT_LIMITS = { chars: 2_000_000, traces: 100, steps: 500, sources: 200, claims: 200, invariants: 100 }

const KINDS = ['tools_allowed', 'target_matches', 'max_source_age', 'latency_budget', 'approval_required', 'complete_all', 'idempotent', 'claims_grounded'] as const
const STEP_KINDS = ['plan', 'tool', 'approval', 'response']
const VERDICTS = ['pass', 'fail', 'review']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isHttp = (v: unknown) => Number.isInteger(v) && (v as number) >= 100 && (v as number) <= 599
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/
const isDate = (v: unknown) => {
  if (typeof v !== 'string') return false
  const m = ISO.exec(v)
  if (!m || Number.isNaN(Date.parse(v))) return false
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map((x) => Number(x ?? 0))
  const day = new Date(Date.UTC(y, mo - 1, d))
  return day.getUTCMonth() === mo - 1 && day.getUTCDate() === d && h < 24 && mi < 60 && s < 60
}

class Checker {
  errors: string[] = []
  str(o: Obj, k: string, at: string, optional = false) {
    if (optional && o[k] === undefined) return
    if (!isStr(o[k])) this.errors.push(`${at}.${k} must be a non-empty string`)
  }
  num(o: Obj, k: string, at: string, optional = false) {
    if (optional && o[k] === undefined) return
    if (!isNum(o[k])) this.errors.push(`${at}.${k} must be a non-negative number`)
  }
  bool(o: Obj, k: string, at: string, optional = false) {
    if (optional && o[k] === undefined) return
    if (typeof o[k] !== 'boolean') this.errors.push(`${at}.${k} must be true or false`)
  }
  obj(o: Obj, k: string, at: string, optional = false): Obj | undefined {
    if (optional && o[k] === undefined) return undefined
    if (!isObj(o[k])) { this.errors.push(`${at}.${k} must be an object`); return undefined }
    return o[k] as Obj
  }
  arr(o: Obj, k: string, at: string, max: number): unknown[] {
    const v = o[k]
    if (!Array.isArray(v)) { this.errors.push(`${at}.${k} must be an array`); return [] }
    if (v.length > max) { this.errors.push(`${at}.${k} has ${v.length} items; the limit is ${max}`); return [] }
    return v
  }
  unique(ids: unknown[], at: string) {
    const seen = new Set<unknown>()
    ids.forEach((id) => { if (seen.has(id)) this.errors.push(`${at}: duplicate id "${String(id)}"`); seen.add(id) })
  }
}

function validateTrace(t: unknown, at: string): { errors: string[]; warnings: string[] } {
  const c = new Checker()
  const warnings: string[] = []
  if (!isObj(t)) return { errors: [`${at}: must be a JSON object`], warnings }
  for (const k of ['id', 'scenario', 'title', 'agent', 'release', 'startedAt']) c.str(t, k, at)
  if (isStr(t.startedAt) && !isDate(t.startedAt)) c.errors.push(`${at}.startedAt must be an ISO 8601 date-time with timezone`)

  const task = c.obj(t, 'task', at)
  if (task) { c.str(task, 'goal', `${at}.task`); c.str(task, 'requestedBy', `${at}.task`) }

  const policy = c.obj(t, 'policy', at)
  if (policy) {
    const p = `${at}.policy`
    c.str(policy, 'id', p); c.str(policy, 'version', p); c.bool(policy, 'abstainAllowed', p)
    const invs = c.arr(policy, 'invariants', p, IMPORT_LIMITS.invariants)
    if (Array.isArray(policy.invariants) && invs.length === 0) warnings.push(`${p}.invariants is empty, so this run can only evaluate as REVIEW, never PASS`)
    invs.forEach((inv, i) => {
      const w = `${p}.invariants[${i}]`
      if (!isObj(inv)) { c.errors.push(`${w} must be an object`); return }
      c.str(inv, 'id', w); c.str(inv, 'description', w)
      if (!(KINDS as readonly string[]).includes(String(inv.kind))) { c.errors.push(`${w}.kind "${String(inv.kind)}" is not a known validator`); return }
      switch (inv.kind) {
        case 'tools_allowed':
          if (!Array.isArray(inv.tools) || inv.tools.length === 0 || !inv.tools.every(isStr)) c.errors.push(`${w}.tools must be a non-empty array of tool names`)
          break
        case 'target_matches': c.str(inv, 'tool', w); c.str(inv, 'expected', w); break
        case 'max_source_age': c.num(inv, 'minutes', w); break
        case 'latency_budget': c.num(inv, 'ms', w); break
        case 'approval_required': c.str(inv, 'tool', w); c.num(inv, 'aboveAmount', w); break
        case 'complete_all':
          c.str(inv, 'tool', w)
          if (!Number.isInteger(inv.expectedCount) || (inv.expectedCount as number) < 1) c.errors.push(`${w}.expectedCount must be a whole number of at least 1`)
          break
        case 'idempotent': c.str(inv, 'tool', w); break
      }
    })
    c.unique(invs.filter(isObj).map((i) => i.id), `${p}.invariants`)
  }

  const approvalTools = new Set(isObj(policy) && Array.isArray(policy.invariants) ? policy.invariants.filter((i) => isObj(i) && i.kind === 'approval_required').map((i) => (i as Obj).tool) : [])
  const steps = c.arr(t, 'steps', at, IMPORT_LIMITS.steps)
  const stepIds = new Set(steps.filter(isObj).map((s) => s.id))
  steps.forEach((s, i) => {
    const w = `${at}.steps[${i}]`
    if (!isObj(s)) { c.errors.push(`${w} must be an object`); return }
    c.str(s, 'id', w); c.str(s, 'label', w); c.num(s, 'startMs', w); c.num(s, 'durationMs', w)
    if (!STEP_KINDS.includes(String(s.kind))) c.errors.push(`${w}.kind must be one of ${STEP_KINDS.join(', ')}`)
    if (s.kind === 'tool') c.str(s, 'tool', w)
    else c.str(s, 'tool', w, true)
    c.str(s, 'target', w, true); c.str(s, 'idempotencyKey', w, true); c.bool(s, 'sideEffect', w, true)
    if (s.note !== undefined && typeof s.note !== 'string') c.errors.push(`${w}.note must be a string`)
    const args = c.obj(s, 'args', w, true); c.obj(s, 'result', w, true)
    if (args && args.amount !== undefined && !isNum(args.amount)) c.errors.push(`${w}.args.amount must be a non-negative number, not ${JSON.stringify(args.amount)}`)
    else if (s.kind === 'tool' && approvalTools.has(s.tool) && !isNum(args?.amount)) c.errors.push(`${w}.args.amount is required: ${String(s.tool)} is under an approval_required invariant`)
    if (s.httpStatus !== undefined && !isHttp(s.httpStatus)) c.errors.push(`${w}.httpStatus must be an integer HTTP status (100-599)`)
    const ap = c.obj(s, 'approval', w, s.kind !== 'approval')
    if (ap) {
      c.str(ap, 'forStep', `${w}.approval`); c.str(ap, 'approver', `${w}.approval`); c.bool(ap, 'granted', `${w}.approval`)
      if (isStr(ap.forStep) && !stepIds.has(ap.forStep)) c.errors.push(`${w}.approval.forStep "${ap.forStep}" does not match any step id`)
    }
  })
  c.unique(steps.filter(isObj).map((s) => s.id), `${at}.steps`)

  const sources = c.arr(t, 'sources', at, IMPORT_LIMITS.sources)
  sources.forEach((s, i) => {
    const w = `${at}.sources[${i}]`
    if (!isObj(s)) { c.errors.push(`${w} must be an object`); return }
    for (const k of ['id', 'title', 'uri', 'excerpt']) c.str(s, k, w)
    if (!isDate(s.asOf)) c.errors.push(`${w}.asOf must be an ISO 8601 date-time with timezone`)
    c.str(s, 'stepId', w, true)
    if (isStr(s.stepId) && !stepIds.has(s.stepId)) c.errors.push(`${w}.stepId "${s.stepId}" does not match any step id`)
  })
  c.unique(sources.filter(isObj).map((s) => s.id), `${at}.sources`)
  const sourceIds = new Set(sources.filter(isObj).map((s) => s.id))

  const out = c.obj(t, 'output', at)
  if (out) {
    const w = `${at}.output`
    if (!isHttp(out.httpStatus)) c.errors.push(`${w}.httpStatus must be an integer HTTP status (100-599)`)
    if (!['completed', 'abstained'].includes(String(out.status))) c.errors.push(`${w}.status must be "completed" or "abstained"`)
    if (typeof out.message !== 'string') c.errors.push(`${w}.message must be a string`)
    if (out.status === 'abstained') c.str(out, 'abstainReason', w)
    const claims = c.arr(out, 'claims', w, IMPORT_LIMITS.claims)
    claims.forEach((cl, i) => {
      const cw = `${w}.claims[${i}]`
      if (!isObj(cl)) { c.errors.push(`${cw} must be an object`); return }
      c.str(cl, 'id', cw); c.str(cl, 'text', cw)
      if (cl.quote !== undefined && typeof cl.quote !== 'string') c.errors.push(`${cw}.quote must be a string`)
      if (!Array.isArray(cl.sourceIds) || !cl.sourceIds.every(isStr)) c.errors.push(`${cw}.sourceIds must be an array of source ids`)
      else cl.sourceIds.forEach((id) => { if (!sourceIds.has(id)) c.errors.push(`${cw}.sourceIds: "${id}" does not match any source id`) })
    })
    c.unique(claims.filter(isObj).map((x) => x.id), `${w}.claims`)
  }
  if (Array.isArray(t.steps) && t.steps.length === 0) warnings.push(`${at}.steps is empty, so this run can only evaluate as REVIEW, never PASS`)
  return { errors: c.errors, warnings }
}

function validateWrapper(item: Obj, at: string): string[] {
  const e: string[] = []
  if (item.schema !== FIXTURE_SCHEMA) e.push(`${at}.schema "${String(item.schema)}" is not supported; expected "${FIXTURE_SCHEMA}"`)
  if (typeof item.fingerprint !== 'string' || !/^fnv1a-[0-9a-f]{8}$/.test(item.fingerprint)) e.push(`${at}.fingerprint must look like "fnv1a-xxxxxxxx"`)
  if (!isStr(item.validatorVersion)) e.push(`${at}.validatorVersion must be a non-empty string`)
  const x = item.expected
  if (!isObj(x)) e.push(`${at}.expected must be an object`)
  else {
    if (!['pass', 'fail'].includes(String(x.transport))) e.push(`${at}.expected.transport must be "pass" or "fail"`)
    if (!VERDICTS.includes(String(x.task))) e.push(`${at}.expected.task must be "pass", "fail" or "review"`)
    if (!Array.isArray(x.failedAssertions) || !x.failedAssertions.every((a) => typeof a === 'string')) e.push(`${at}.expected.failedAssertions must be an array of assertion ids`)
  }
  if (!isObj(item.trace)) e.push(`${at}.trace must be an object`)
  return e
}

/**
 * Validates and parses traces. The batch is atomic: any error imports nothing.
 * `loaded` maps ids already in the desk (seeds and earlier imports) to their fingerprints; a trace reusing one of those
 * ids is rejected unless it is byte-for-byte the same run, in which case it is only verified.
 */
export function importTraces(text: string, loaded: ReadonlyMap<string, string> = new Map()): ImportResult {
  const res: ImportResult = { traces: [], errors: [], warnings: [], alreadyLoaded: [], reproduced: [] }
  if (text.length > IMPORT_LIMITS.chars) return { ...res, errors: [`Input is ${text.length} characters; the limit is ${IMPORT_LIMITS.chars}`] }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (err) {
    return { ...res, errors: [`Invalid JSON: ${(err as Error).message}`] }
  }
  const items = Array.isArray(data) ? data : [data]
  if (items.length === 0) return { ...res, errors: ['No traces found: the array is empty'] }
  if (items.length > IMPORT_LIMITS.traces) return { ...res, errors: [`${items.length} traces; the limit is ${IMPORT_LIMITS.traces} per import`] }
  const ids = new Set<string>()
  items.forEach((item, i) => {
    const where = items.length > 1 ? `[${i}]` : 'trace'
    const wrapped = isObj(item) && ('schema' in item || 'trace' in item || 'fingerprint' in item || 'expected' in item)
    if (wrapped) {
      const we = validateWrapper(item, where)
      if (we.length) { res.errors.push(...we); return }
    }
    const trace = wrapped ? (item as Obj).trace : item
    const at = wrapped ? `${where}.trace` : where
    const v = validateTrace(trace, at)
    if (v.errors.length) { res.errors.push(...v.errors); return }
    const t = trace as Trace
    if (ids.has(t.id)) { res.errors.push(`${at}.id "${t.id}" appears more than once in this import`); return }
    ids.add(t.id)
    const existing = loaded.get(t.id)
    if (existing !== undefined && existing !== fingerprint(t)) { res.errors.push(`${at}.id "${t.id}" is already loaded with different content; give the new run its own id`); return }
    res.warnings.push(...v.warnings)
    if (existing !== undefined) res.alreadyLoaded.push(t.id)
    else res.traces.push(t)
    if (wrapped) {
      const f = item as { fingerprint: string; expected: { task: string; transport: string; failedAssertions: string[] } }
      const ev = evaluate(t)
      const failed = ev.assertions.filter((a) => a.status === 'fail').map((a) => a.id).join(',')
      const match = fingerprint(t) === f.fingerprint && ev.task === f.expected.task && ev.transport.status === f.expected.transport && failed === f.expected.failedAssertions.join(',')
      res.reproduced.push({ id: t.id, match, detail: match ? `Reproduced: task ${ev.task.toUpperCase()}, fingerprint ${f.fingerprint}` : `Mismatch: expected ${f.expected.task}, got ${ev.task} (fingerprint ${fingerprint(t)} vs ${f.fingerprint})` })
    }
  })
  if (res.errors.length) return { traces: [], errors: res.errors, warnings: [], alreadyLoaded: [], reproduced: [] }
  return res
}
