import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'

export const DEMO = '/c/ikeja-market-women'

export const isPhone = (info: TestInfo) => info.project.name === 'phone'

/** Opens the demo ledger and waits for the engine to boot. */
export async function openLedger(page: Page, path = DEMO) {
  await page.goto(path)
  await expect(page.getByRole('region', { name: 'Connection' })).toBeVisible()
}

export async function reconnect(page: Page) {
  await page.getByRole('button', { name: 'Reconnect' }).click()
  await expect(page.getByText('All changes synced')).toBeVisible({ timeout: 10_000 })
}

export async function expectAccessible(page: Page) {
  // Let entrance animations settle so contrast is measured on final colours.
  await page.waitForTimeout(350)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary).toEqual([])
}
