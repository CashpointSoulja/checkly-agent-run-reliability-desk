import { describe, expect, it } from 'vitest'
import { fixtureFile } from './exports'
import { seedFixtures } from './fixtures'
import { importTraces } from './importTrace'
import type { Trace } from './types'
import { evaluate } from './validators'

const { candidate } = seedFixtures()
const healthy = candidate.find((t) => t.scenario === 'healthy')!

function empty(): Trace {
  const t = structuredClone(healthy)
  t.id = 'probe-empty'
  t.steps = []
  t.sources = []
  t.policy.invariants = []
  t.output = { httpStatus: 200, status: 'completed', message: 'Done.', claims: [] }
  return t
}
const mutate = (fn: (t: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = structuredClone(healthy) as unknown as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  fn(t)
  return importTraces(JSON.stringify(t))
}

describe('zero-evidence runs never go green', () => {
  it('completed HTTP 200 with no steps, sources or invariants evaluates as REVIEW', () => {
    const e = evaluate(empty())
    expect(e.transport.status).toBe('pass')
    expect(e.task).toBe('review')
    expect(e.reviewReason).toBe('insufficient_evidence')
    expect(e.summary).not.toMatch(/All 0/)
    expect(e.assertions.find((a) => a.id === 'EVIDENCE-COVERAGE')?.status).toBe('review')
  })
  it('the same trace imported as JSON is accepted with a warning and still evaluates as REVIEW', () => {
    const r = importTraces(JSON.stringify(empty()))
    expect(r.errors).toEqual([])
    expect(r.warnings.join(' ')).toMatch(/invariants is empty.*never PASS/)
    expect(evaluate(r.traces[0]).task).toBe('review')
  })
  it('invariants that pass only vacuously do not count as evidence', () => {
    const t = empty()
    t.policy.invariants = [
      { id: 'A', kind: 'tools_allowed', description: 'allow-list', tools: ['x'] },
      { id: 'B', kind: 'latency_budget', description: 'fast', ms: 1000 },
      { id: 'C', kind: 'idempotent', description: 'once', tool: 'x' },
      { id: 'D', kind: 'approval_required', description: 'approve', tool: 'x', aboveAmount: 0 },
    ]
    const e = evaluate(t)
    expect(e.assertions.filter((a) => a.status === 'fail')).toEqual([])
    expect(e.task).toBe('review')
    t.steps = [{ id: 's1', kind: 'response', label: 'reply', startMs: 0, durationMs: 10 }]
    expect(evaluate(t).task).toBe('review')
  })
  it('a fixture of a zero-evidence run reproduces REVIEW on re-import', () => {
    const t = empty()
    const r = importTraces(JSON.stringify(fixtureFile(t, evaluate(t))))
    expect(r.errors).toEqual([])
    expect(r.reproduced[0]).toMatchObject({ match: true })
    expect(r.reproduced[0].detail).toContain('REVIEW')
  })
  it('the seeded healthy run still passes on real evidence', () => {
    const e = evaluate(healthy)
    expect(e.task).toBe('pass')
    expect(e.coverage.substantivePasses).toBeGreaterThan(0)
  })
})

describe('nested trace schema', () => {
  const cases: [string, (t: Record<string, any>) => void, RegExp][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['task.requestedBy', (t) => { delete t.task.requestedBy }, /task\.requestedBy must be a non-empty string/],
    ['policy.abstainAllowed', (t) => { t.policy.abstainAllowed = 'yes' }, /policy\.abstainAllowed must be true or false/],
    ['invariant not an object', (t) => { t.policy.invariants[0] = null }, /invariants\[0\] must be an object/],
    ['invariant missing kind field', (t) => { const i = t.policy.invariants.findIndex((x: { kind: string }) => x.kind === 'target_matches'); delete t.policy.invariants[i].expected }, /\.expected must be a non-empty string/],
    ['duplicate invariant id', (t) => { t.policy.invariants[1].id = t.policy.invariants[0].id }, /invariants: duplicate id/],
    ['step kind', (t) => { t.steps[0].kind = 'magic' }, /steps\[0\]\.kind must be one of/],
    ['negative duration', (t) => { t.steps[0].durationMs = -5 }, /steps\[0\]\.durationMs must be a non-negative number/],
    ['string httpStatus on step', (t) => { t.steps[0].httpStatus = '200' }, /steps\[0\]\.httpStatus must be an integer HTTP status/],
    ['tool step without tool', (t) => { const s = t.steps.find((x: { kind: string }) => x.kind === 'tool'); delete s.tool }, /\.tool must be a non-empty string/],
    ['duplicate step id', (t) => { t.steps[1].id = t.steps[0].id }, /steps: duplicate id/],
    ['source not an object', (t) => { t.sources.push('x') }, /sources\[\d+\] must be an object/],
    ['source bad date', (t) => { t.sources[0].asOf = 'yesterday' }, /sources\[0\]\.asOf must be an ISO date/],
    ['claim cites unknown source', (t) => { t.output.claims.push({ id: 'cx', text: 'made up', sourceIds: ['nope'] }) }, /"nope" does not match any source id/],
    ['claim sourceIds not array', (t) => { t.output.claims.push({ id: 'cy', text: 'x', sourceIds: 'src-1' }) }, /sourceIds must be an array/],
    ['output http out of range', (t) => { t.output.httpStatus = 2000 }, /output\.httpStatus must be an integer HTTP status/],
    ['output message missing', (t) => { delete t.output.message }, /output\.message must be a string/],
    ['abstained without reason', (t) => { t.output.status = 'abstained'; delete t.output.abstainReason }, /output\.abstainReason must be a non-empty string/],
    ['task is an array', (t) => { t.task = [] }, /trace\.task must be an object/],
  ]
  it.each(cases)('rejects %s with a readable error', (_name, fn, re) => {
    const r = mutate(fn)
    expect(r.traces).toEqual([])
    expect(r.errors.join('\n')).toMatch(re)
  })
  it('rejects empty arrays and duplicate ids across one import', () => {
    expect(importTraces('[]').errors[0]).toMatch(/No traces found/)
    expect(importTraces(JSON.stringify([healthy, healthy])).errors[0]).toMatch(/appears more than once/)
  })
})

describe('fixture wrapper validation', () => {
  const file = () => JSON.parse(JSON.stringify(fixtureFile(healthy, evaluate(healthy))))
  const cases: [string, (f: Record<string, any>) => void, RegExp][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['unknown schema', (f) => { f.schema = 'agent-run-fixture/v9' }, /schema .* is not supported/],
    ['missing schema on a wrapper', (f) => { delete f.schema }, /schema "undefined" is not supported/],
    ['fingerprint type', (f) => { f.fingerprint = 123 }, /fingerprint must look like/],
    ['missing validatorVersion', (f) => { delete f.validatorVersion }, /validatorVersion must be a non-empty string/],
    ['expected missing', (f) => { delete f.expected }, /expected must be an object/],
    ['expected.task', (f) => { f.expected.task = 'green' }, /expected\.task must be/],
    ['expected.transport', (f) => { f.expected.transport = 'review' }, /expected\.transport must be/],
    ['expected.failedAssertions', (f) => { f.expected.failedAssertions = 'none' }, /failedAssertions must be an array/],
    ['trace missing', (f) => { delete f.trace }, /trace must be an object/],
    ['nested trace error is located', (f) => { f.trace.steps[0].kind = 'x' }, /trace\.trace\.steps\[0\]\.kind/],
  ]
  it.each(cases)('rejects %s without throwing', (_name, fn, re) => {
    const f = file()
    fn(f)
    let r: ReturnType<typeof importTraces> | undefined
    expect(() => { r = importTraces(JSON.stringify(f)) }).not.toThrow()
    expect(r!.traces).toEqual([])
    expect(r!.errors.join('\n')).toMatch(re)
  })
  it('a valid wrapper still round-trips', () => {
    const r = importTraces(JSON.stringify(file()))
    expect(r.errors).toEqual([])
    expect(r.reproduced[0].match).toBe(true)
  })
})
