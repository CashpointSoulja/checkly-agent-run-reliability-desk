import type { Evaluation, TaskVerdict, Trace } from './types'

export type Delta = 'regression' | 'fixed' | 'still-failing' | 'still-passing' | 'changed' | 'new'

export interface ComparisonRow {
  scenario: string
  baseline?: TaskVerdict
  candidate: TaskVerdict
  delta: Delta
}

export function classify(baseline: TaskVerdict | undefined, candidate: TaskVerdict): Delta {
  if (!baseline) return 'new'
  if (candidate === 'fail') return baseline === 'fail' ? 'still-failing' : 'regression'
  if (baseline === 'fail') return 'fixed'
  return baseline === candidate ? 'still-passing' : 'changed'
}

export function compareReleases(baseline: Trace[], candidate: Trace[], evals: Map<string, Evaluation>): ComparisonRow[] {
  return candidate.map((c) => {
    const b = baseline.find((x) => x.scenario === c.scenario)
    const bv = b ? evals.get(b.id)?.task : undefined
    const cv = evals.get(c.id)!.task
    return { scenario: c.scenario, baseline: bv, candidate: cv, delta: classify(bv, cv) }
  })
}

export function gate(rows: ComparisonRow[]): { blocked: boolean; regressions: number; failing: number; review: number } {
  const regressions = rows.filter((r) => r.delta === 'regression').length
  const failing = rows.filter((r) => r.candidate === 'fail').length
  const review = rows.filter((r) => r.candidate === 'review').length
  return { blocked: failing > 0, regressions, failing, review }
}
