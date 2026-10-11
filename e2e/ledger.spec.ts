import { expect, test } from '@playwright/test'
import { DEMO, expectAccessible, isPhone, openLedger, reconnect } from './helpers'

test.describe('demo ledger', () => {
  test('opens offline with three changes waiting', async ({ page }) => {
    await openLedger(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Ikeja Market Women Ajo' })).toBeVisible()
    await expect(page.getByText("You're offline.")).toBeVisible()
    await expect(page.getByText('3 changes waiting to sync')).toBeVisible()
    await expectAccessible(page)
  })

  test('records a payment that survives a reload', async ({ page }, info) => {
    await openLedger(page)
    if (isPhone(info)) {
      await page.getByRole('button', { name: 'Record payment' }).click()
      await page.getByRole('combobox', { name: /^Member/ }).selectOption({ label: 'Funke Adeyemi' })
    } else {
      await page.getByRole('button', { name: /^Funke Adeyemi, week 7/ }).click()
    }
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expectAccessible(page)
    await sheet.getByRole('radio', { name: 'Transfer' }).check({ force: true })
    await sheet.getByLabel('Reference').fill('4410')
    await sheet.getByRole('button', { name: 'Save payment' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('4 changes waiting to sync')).toBeVisible()

    await page.reload()
    await expect(page.getByText('4 changes waiting to sync')).toBeVisible()
    await page.goto(`${DEMO}/members/funke`)
    await expect(page.getByText('Transfer ref 4410', { exact: false })).toBeVisible()
  })

  test('undo puts the square back', async ({ page }, info) => {
    test.skip(isPhone(info), 'Same flow on both; the grid is the quickest way in')
    await openLedger(page)
    await page.getByRole('button', { name: /^Funke Adeyemi, week 7/ }).click()
    await page.getByRole('button', { name: 'Save payment' }).click()
    await expect(page.getByRole('button', { name: /^Funke Adeyemi, week 7.*paid/ })).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('button', { name: /^Funke Adeyemi, week 7, Sat \d+ \w+, due/ })).toBeVisible()
  })

  test('rejects an amount it cannot read', async ({ page }, info) => {
    await openLedger(page)
    if (isPhone(info)) await page.getByRole('button', { name: 'Record payment' }).click()
    else await page.getByRole('button', { name: /^Funke Adeyemi, week 7/ }).click()
    const amount = page.getByRole('dialog').getByLabel('Amount', { exact: true })
    await amount.fill('twenty')
    await page.getByRole('button', { name: 'Save payment' }).click()
    await expect(page.getByText('Enter an amount, like 20,000 or 20k.')).toBeVisible()
    await expect(amount).toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('syncing', () => {
  test('reconnecting drains the queue and surfaces the clash', async ({ page }, info) => {
    await openLedger(page)
    await reconnect(page)
    await expect(page.getByRole('region', { name: 'Connection' })).not.toContainText('waiting')

    if (isPhone(info)) {
      await expect(page.getByText('Funke, week 5: two versions')).toBeVisible()
      await page.getByRole('button', { name: 'Review' }).click()
    } else {
      await expect(page.getByRole('heading', { name: 'Two versions to check' })).toBeVisible()
    }
    await expectAccessible(page)
    await page.getByRole('button', { name: 'Keep ₦20,000' }).first().click()
    await expect(page.getByRole('heading', { name: 'Two versions to check' })).toHaveCount(0)
    await expect(page.getByText(/Kept ₦20,000 for Funke/).first()).toBeVisible()
  })

  test("Kemi's changes reach Iya Sade's phone in another tab", async ({ page, context }) => {
    await openLedger(page)
    const iya = await context.newPage()
    await iya.goto(`${DEMO}/members/ngozi?device=iya-sade`)
    await expect(iya.getByRole('definition').filter({ hasText: '₦120,000' })).toBeVisible()

    await reconnect(page)
    await expect(iya.getByRole('definition').filter({ hasText: '₦140,000' })).toBeVisible({ timeout: 10_000 })
  })

  test('opens with no network once the app has been installed', async ({ page, context }) => {
    await openLedger(page)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Ikeja Market Women Ajo' })).toBeVisible()
    await expect(page.getByText('No network on this device')).toBeVisible()
  })
})
