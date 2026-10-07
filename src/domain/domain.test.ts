import { describe, expect, it } from 'vitest'
import { compareReleases, gate } from './compare'
import { alertPreview, fixtureFile, reviewMemo } from './exports'
import { seedFixtures } from './fixtures'
import { importTraces } from './importTrace'
import { evaluate } from './validators'
import type { Evaluation } from './types'

const { candidate, baseline } = seedFixtures()
const evals = new Map<string, Evaluation>([...candidate, ...baseline].map((t) => [t.id, evaluate(t)]))
const byScenario = (list: typeof candidate, s: string) => evals.get(list.find((t) => t.scenario === s)!.id)!

describe('seed fixtures', () => {
  it('has 8 candidate and 8 baseline traces with unique ids', () => {
    expect(candidate).toHaveLength(8)
    expect(baseline).toHaveLength(8)
    expect(new Set([...candidate, ...baseline].map((t) => t.id)).size).toBe(16)
  })

  it.each([
    ['healthy', 'pass', 'pass', undefined],
    ['wrong-tool-target', 'pass', 'fail', 'INV-ticket-target'],
    ['stale-source', 'pass', 'fail', 'INV-fresh-status'],
    ['timeout', 'fail', 'fail', 'INV-export-written'],
    ['missing-approval', 'pass', 'fail', 'INV-approval'],
    ['partial-success', 'pass', 'fail', 'INV-all-notified'],
    ['duplicate-side-effect', 'pass', 'fail', 'INV-idempotent'],
    ['unsupported-claim', 'pass', 'fail', 'INV-grounded'],
  ])('candidate %s: transport %s, task %s, first failure %s', (s, transport, task, first) => {
    const e = byScenario(candidate, s)
    expect(e.transport.status).toBe(transport)
    expect(e.task).toBe(task)
    expect(e.firstFailure?.id).toBe(first)
  })

  it('green HTTP status does not imply task success', () => {
    const greenButWrong = candidate.filter((t) => evals.get(t.id)!.transport.status === 'pass' && evals.get(t.id)!.task === 'fail')
    expect(greenButWrong.map((t) => t.scenario)).toHaveLength(6)
  })

  it('baseline shows safe abstention as REVIEW, not PASS or FAIL', () => {
    expect(byScenario(baseline, 'stale-source').task).toBe('review')
    expect(byScenario(baseline, 'partial-success').task).toBe('review')
    expect(byScenario(baseline, 'stale-source').assertions.find((a) => a.id === 'SAFE-ABSTAIN')?.status).toBe('pass')
  })

  it('healthy baseline fails on the wrong email recipient', () => {
    const e = byScenario(baseline, 'healthy')
    expect(e.firstFailure?.id).toBe('INV-email-target')
    expect(e.firstFailure?.actual).toBe('"j.oliver@example.com"')
  })

  it('pins exact failure details', () => {
    expect(byScenario(candidate, 'wrong-tool-target').firstFailure).toMatchObject({ stepId: 's3', actual: '"T-818"' })
    expect(byScenario(candidate, 'stale-source').firstFailure?.actual).toBe('src-status-eu is 3.1 d old')
    expect(byScenario(candidate, 'duplicate-side-effect').firstFailure?.stepId).toBe('s4')
    expect(byScenario(candidate, 'unsupported-claim').firstFailure?.claimId).toBe('c2')
    expect(byScenario(candidate, 'partial-success').firstFailure?.actual).toBe('3 of 5')
  })

  it('is deterministic', () => {
    expect(JSON.stringify(evaluate(candidate[3]))).toBe(JSON.stringify(evaluate(structuredClone(candidate[3]))))
  })
})

describe('release comparison', () => {
  const rows = compareReleases(baseline, candidate, evals)
  it('classifies deltas', () => {
    expect(rows.map((r) => r.delta)).toEqual(['fixed', 'regression', 'regression', 'still-failing', 'regression', 'regression', 'regression', 'regression'])
  })
  it('blocks the candidate', () => {
    expect(gate(rows)).toEqual({ blocked: true, regressions: 6, failing: 7, review: 0 })
  })
})

describe('exports and import', () => {
  it('round-trips a fixture and reproduces its verdict', () => {
    const t = candidate[1]
    const file = fixtureFile(t, evals.get(t.id)!)
    const r = importTraces(JSON.stringify(file))
    expect(r.errors).toEqual([])
    expect(r.reproduced[0].match).toBe(true)
  })
  it('detects a tampered fixture', () => {
    const t = candidate[1]
    const file = fixtureFile(t, evals.get(t.id)!)
    file.trace.steps[2].target = 'T-881'
    expect(importTraces(JSON.stringify(file)).reproduced[0].match).toBe(false)
  })
  it('rejects malformed input with readable errors', () => {
    expect(importTraces('{nope').errors[0]).toMatch(/Invalid JSON/)
    expect(importTraces(JSON.stringify({ id: 'x' })).errors.length).toBeGreaterThan(3)
    const bad = structuredClone(candidate[0]) as unknown as { policy: { invariants: { kind: string }[] } }
    bad.policy.invariants[0].kind = 'ai_score'
    expect(importTraces(JSON.stringify(bad)).errors[0]).toMatch(/not a known validator/)
  })
  it('alert preview is concise and labelled as not sent', () => {
    const t = candidate[1]
    const rows = compareReleases(baseline, candidate, evals)
    const text = alertPreview(t, evals.get(t.id)!, rows[1])
    expect(text.split('\n').length).toBeLessThanOrEqual(6)
    expect(text).toContain('Not sent')
    expect(text).toContain('INV-ticket-target')
  })
  it('memo flags green-but-wrong runs', () => {
    const t = candidate[1]
    expect(reviewMemo(t, evals.get(t.id)!, { date: '2026-10-07' })).toContain('status-code check alone would have reported this run as green')
  })
})
