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
  await expect(page.getByRole('button', { name: 'Imported (1)' })).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Imported (1)' })).toBeVisible()

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByRole('button', { name: 'Imported (0)' })).toBeVisible()
  await expect(runs.first()).toContainText('not run')

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  expect(external).toEqual([])
})
