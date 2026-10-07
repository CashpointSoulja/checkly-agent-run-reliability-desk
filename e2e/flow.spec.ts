import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('seed → validate → pass → blocked → abstain → export → re-import → reset, with no external requests', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()) })
  await page.goto('/')
  await expect(page.getByText('Independent concept by Ayo Ahmed. Not affiliated with Checkly.').first()).toBeVisible()
  await expect(page.getByText(/no telemetry, no monitoring connection, no real agent actions/)).toBeVisible()

  const runs = page.locator('nav .run')
  await expect(runs).toHaveCount(8)
  await expect(runs.first()).toContainText('not run')

  await page.getByRole('button', { name: 'Run validators on both releases' }).click()
  await expect(page.getByText('✕ Release blocked')).toBeVisible()
  await expect(page.getByText('7 failing · 6 regressions · 0 review')).toBeVisible()

  const detail = page.locator('#run-detail')
  await expect(detail.locator('.verdict.pass').filter({ hasText: 'Task' })).toBeVisible()

  await runs.filter({ hasText: 'Wrong tool target' }).click()
  await expect(detail.locator('.verdict.pass').filter({ hasText: 'Transport' })).toBeVisible()
  await expect(detail.locator('.verdict.fail').filter({ hasText: 'Task' })).toBeVisible()
  await expect(detail.getByRole('heading', { name: /Exact failed assertion: INV-ticket-target/ })).toBeVisible()
  await expect(detail.locator('.failure')).toContainText('"T-818"')
  await expect(page.locator('pre.alert')).toContainText('Not sent')

  const [fx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Reproducible fixture (.json)' }).click()])
  const fixtureText = readFileSync((await fx.path())!, 'utf8')
  expect(JSON.parse(fixtureText).expected).toEqual({ transport: 'pass', task: 'fail', failedAssertions: ['INV-ticket-target'] })

  await page.getByRole('textbox', { name: /Reviewer note/ }).fill('Block release until ticket IDs come from structured state.')
  const [memo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Review memo (.md)' }).click()])
  const memoText = readFileSync((await memo.path())!, 'utf8')
  expect(memoText).toContain('Exact failed assertion')
  expect(memoText).toContain('Block release until ticket IDs')

  await page.getByRole('button', { name: 'Baseline v2.3.1' }).click()
  await runs.filter({ hasText: 'Stale source' }).click()
  await expect(detail.getByRole('heading', { name: /safe abstention/ })).toBeVisible()
  await detail.getByRole('button', { name: 'Abstention confirmed correct' }).click()
  await expect(detail.getByRole('button', { name: 'Abstention confirmed correct' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Load JSON trace' }).click()
  await page.getByLabel('Trace JSON').fill('{"broken": ')
  await page.getByRole('button', { name: 'Import and evaluate' }).click()
  await expect(page.locator('.import-result')).toContainText('Invalid JSON')
  await page.getByLabel('Trace JSON').fill(fixtureText)
  await page.getByRole('button', { name: 'Import and evaluate' }).click()
  await expect(page.locator('.import-result')).toContainText('Reproduced: task FAIL')
  await expect(page.locator('.import-result')).toContainText('verified and not added twice')
  await expect(page.getByRole('button', { name: 'Imported (0)' })).toBeVisible()

  const clash = { ...JSON.parse(fixtureText).trace, id: 'healthy@v2.4.0-rc.1' }
  await page.getByLabel('Trace JSON').fill(JSON.stringify(clash))
  await page.getByRole('button', { name: 'Import and evaluate' }).click()
  await expect(page.locator('.import-result')).toContainText('Nothing imported')
  await expect(page.locator('.import-result')).toContainText('already loaded with different content')
  await expect(page.getByRole('button', { name: 'Imported (0)' })).toBeVisible()
  await page.getByRole('button', { name: 'Candidate v2.4.0-rc.1' }).click()
  await runs.filter({ hasText: 'Healthy' }).click()
  await expect(detail.locator('.verdict.pass').filter({ hasText: 'Task' })).toBeVisible()

  await page.getByRole('button', { name: 'Insert example trace' }).click()
  await page.getByRole('button', { name: 'Import and evaluate' }).click()
  await expect(page.getByRole('button', { name: 'Imported (1)' })).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Imported (1)' })).toBeVisible()

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByRole('button', { name: 'Imported (0)' })).toBeVisible()
  await expect(runs.first()).toContainText('not run')

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  expect(external).toEqual([])
})

test('a completed HTTP 200 trace with no steps, sources or invariants is REVIEW, never green', async ({ page }, info) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load JSON trace' }).click()
  const probe = {
    id: 'probe-empty', scenario: 'probe', title: 'Empty probe', agent: 'probe-agent', release: 'v0', startedAt: '2026-10-07T00:00:00Z',
    task: { goal: 'Do the job', requestedBy: 'qa@example.com' },
    policy: { id: 'probe', version: '1', abstainAllowed: false, invariants: [] },
    steps: [], sources: [],
    output: { httpStatus: 200, status: 'completed', message: 'Done.', claims: [] },
  }
  await page.locator('#trace-json').fill(JSON.stringify(probe))
  await page.getByRole('button', { name: 'Import and evaluate' }).click()
  await expect(page.locator('.import-result .warn')).toContainText('never PASS')
  const detail = page.locator('#run-detail')
  await expect(detail.locator('.verdict.pass').filter({ hasText: 'Transport' })).toBeVisible()
  await expect(detail.locator('.verdict.review').filter({ hasText: 'Task' })).toContainText('Not enough evidence for PASS')
  await expect(detail.locator('.verdict.pass').filter({ hasText: 'Task' })).toHaveCount(0)
  await expect(detail.getByRole('heading', { name: 'Human review needed: not enough evidence for PASS' })).toBeVisible()
  await expect(detail.locator('.assertions li.review')).toContainText('EVIDENCE-COVERAGE')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await detail.screenshot({ path: `docs/screenshots/zero-evidence-review-${info.project.name}.png` })
})
