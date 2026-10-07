import type { ComparisonRow } from './compare'
import { gate } from './compare'
import type { Evaluation, Trace } from './types'
import { VALIDATOR_VERSION } from './validators'

export const FIXTURE_SCHEMA = 'agent-run-fixture/v1'

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

export function fingerprint(t: Trace): string {
  let h = 0x811c9dc5
  const s = canonical(t)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `fnv1a-${h.toString(16).padStart(8, '0')}`
}

export interface FixtureFile {
  schema: typeof FIXTURE_SCHEMA
  note: string
  validatorVersion: string
  fingerprint: string
  expected: { transport: 'pass' | 'fail'; task: Evaluation['task']; failedAssertions: string[] }
  trace: Trace
}

export function fixtureFile(t: Trace, e: Evaluation): FixtureFile {
  return {
    schema: FIXTURE_SCHEMA,
    note: 'Synthetic fixture. Re-import into the Agent Run Reliability Desk to reproduce the same verdict deterministically.',
    validatorVersion: VALIDATOR_VERSION,
    fingerprint: fingerprint(t),
    expected: { transport: e.transport.status, task: e.task, failedAssertions: e.assertions.filter((a) => a.status === 'fail').map((a) => a.id) },
    trace: t,
  }
}

const verdictWord = { pass: 'PASS', fail: 'FAIL (blocked)', review: 'REVIEW (safe abstention)' } as const

export function alertPreview(t: Trace, e: Evaluation, row?: ComparisonRow): string {
  const head = e.task === 'fail' ? 'BLOCKED' : e.task === 'review' ? 'NEEDS REVIEW' : 'OK'
  const lines = [
    `[${head}] ${t.scenario} · ${t.agent} ${t.release}`,
    `Transport ${e.transport.status.toUpperCase()} (HTTP ${e.transport.finalHttp}, ${(e.transport.totalMs / 1000).toFixed(1)}s) · Task ${verdictWord[e.task]}`,
  ]
  if (e.firstFailure) lines.push(`Failed ${e.firstFailure.id}: expected ${e.firstFailure.expected}; got ${e.firstFailure.actual}${e.firstFailure.stepId ? ` (step ${e.firstFailure.stepId})` : ''}`)
  if (e.task === 'review') lines.push(`Abstained: ${t.output.abstainReason}`)
  if (row?.baseline) lines.push(`vs baseline: ${row.baseline.toUpperCase()} → ${row.candidate.toUpperCase()} (${row.delta})`)
  lines.push('Preview only. Not sent to any channel.')
  return lines.join('\n')
}

export function reviewMemo(t: Trace, e: Evaluation, opts: { row?: ComparisonRow; decision?: string; note?: string; date: string }): string {
  const a = e.assertions
  return [
    `# Agent run review: ${t.title}`,
    '',
    `Independent concept by Ayo Ahmed. Not affiliated with Checkly. Synthetic fixture, evaluated locally.`,
    '',
    `- Run: \`${t.id}\``,
    `- Agent / release: ${t.agent} / ${t.release}`,
    `- Task: ${t.task.goal}`,
    `- Policy: ${t.policy.id}@${t.policy.version}`,
    `- Validator version: ${e.validatorVersion} · fixture fingerprint \`${fingerprint(t)}\``,
    `- Memo generated: ${opts.date}`,
    '',
    '## Verdict',
    '',
    `| Layer | Result | Detail |`,
    `|---|---|---|`,
    `| Transport | ${e.transport.status.toUpperCase()} | final HTTP ${e.transport.finalHttp}, ${e.transport.totalMs} ms, ${e.transport.stepErrors.length} non-2xx step(s) |`,
    `| Task | ${verdictWord[e.task]} | ${e.summary} |`,
    '',
    e.transport.status === 'pass' && e.task === 'fail' ? '> A status-code check alone would have reported this run as green.\n' : '',
    ...(e.firstFailure
      ? ['## Exact failed assertion', '', `- **${e.firstFailure.id}** (${e.firstFailure.kind}): ${e.firstFailure.description}`, `- Expected: \`${e.firstFailure.expected}\``, `- Actual: \`${e.firstFailure.actual}\``, `- Step: ${e.firstFailure.stepId ?? 'n/a'}`, `- ${e.firstFailure.message}`, '']
      : []),
    '## All assertions',
    '',
    '| ID | Status | Expected | Actual |',
    '|---|---|---|---|',
    ...a.map((x) => `| ${x.id} | ${x.status.toUpperCase()} | ${x.expected} | ${x.actual} |`),
    '',
    '## Agent output',
    '',
    `> ${t.output.message}`,
    '',
    ...t.output.claims.map((c) => `- ${c.id}: "${c.text}" cites ${c.sourceIds.join(', ') || 'nothing'}`),
    '',
    '## Evidence',
    '',
    ...(t.sources.length ? t.sources.map((s) => `- ${s.id}: ${s.title} (${s.uri}, as of ${s.asOf})`) : ['- No external sources in this run.']),
    '',
    ...(opts.row?.baseline ? ['## Release comparison', '', `Baseline ${opts.row.baseline.toUpperCase()} → candidate ${opts.row.candidate.toUpperCase()}: **${opts.row.delta}**`, ''] : []),
    '## Human review',
    '',
    `- Decision: ${opts.decision ?? 'not recorded'}`,
    `- Note: ${opts.note?.trim() || 'none'}`,
    '',
  ].join('\n')
}

export function releaseReport(baselineRelease: string, candidateRelease: string, rows: ComparisonRow[], date: string): string {
  const g = gate(rows)
  return [
    `# Release comparison: ${baselineRelease} → ${candidateRelease}`,
    '',
    'Independent concept by Ayo Ahmed. Not affiliated with Checkly. Synthetic fixtures, evaluated locally.',
    '',
    `Gate: **${g.blocked ? 'BLOCKED' : 'CLEAR'}**. ${g.failing} failing, ${g.regressions} regression(s), ${g.review} needing review. Generated ${date}.`,
    '',
    '| Scenario | Baseline | Candidate | Change |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.scenario} | ${r.baseline?.toUpperCase() ?? 'n/a'} | ${r.candidate.toUpperCase()} | ${r.delta} |`),
    '',
  ].join('\n')
}
