import { expect, test } from '@playwright/test'
import { DEMO, expectAccessible, isPhone, openLedger, reconnect } from './helpers'

test('pays out the current turn, warning about the shortfall', async ({ page }) => {
  await openLedger(page, `${DEMO}/rotation`)
  await expect(page.getByRole('heading', { level: 1, name: 'Rotation' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: /Collecting now/ }).click()
  const sheet = page.getByRole('dialog', { name: "Mama Bisi's turn" })
  await expect(sheet.getByText('Funke Adeyemi')).toBeVisible()
  await sheet.getByRole('button', { name: 'Pay out to Mama Bisi' }).click()
  await expect(sheet.getByRole('alert')).toContainText('₦20,000 less than the full pot')
  await sheet.getByRole('button', { name: /Yes, pay out ₦140,000/ }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: /^Collected/ })).toHaveCount(7)
})

test('starts a new circle from scratch', async ({ page }) => {
  await openLedger(page, '/new')
  await expectAccessible(page)
  await page.getByRole('button', { name: /Next: members/ }).click()
  await expect(page.getByText('Give the circle a name people will recognise.')).toBeVisible()

  await page.getByLabel('Circle name').fill('Yaba Tech Staff Esusu')
  await page.getByLabel('Each person pays').fill('50k')
  await page.getByRole('radio', { name: 'Monthly' }).check({ force: true })
  await page.getByLabel('Your name').fill('Tolu Adebayo')
  await page.getByRole('button', { name: /Next: members/ }).click()

  await expect(page.getByRole('heading', { name: 'Who is saving?' })).toBeFocused()
  for (const name of ['Chidi Okafor', 'Aisha Musa']) {
    await page.getByLabel('Add someone').fill(name)
    await page.keyboard.press('Enter')
  }
  await expect(page.getByRole('list', { name: 'People in this circle' }).getByRole('listitem')).toHaveCount(3)
  await page.getByRole('button', { name: /Next: order/ }).click()
  await page.getByRole('button', { name: 'Move Aisha Musa earlier' }).click()
  await page.getByRole('button', { name: 'Create circle' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Yaba Tech Staff Esusu' })).toBeVisible()
  await expect(page.getByText(/₦50,000/).first()).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Yaba Tech Staff Esusu/ })).toBeVisible()
})

test('a new phone joins with the invite link', async ({ page, context }) => {
  await openLedger(page)
  await reconnect(page)
  const tunde = await context.newPage()
  await tunde.goto('/join/ikeja-market-women?device=tunde')
  await expect(tunde.getByRole('heading', { name: 'Ikeja Market Women Ajo' })).toBeVisible()
  await expectAccessible(tunde)
  await tunde.getByRole('button', { name: 'Join circle' }).click()
  await expect(tunde.getByText('Choose yourself, or add yourself as new.')).toBeVisible()
  await tunde.getByText("I'm new to this circle").click()
  await tunde.getByLabel('Your name').fill('Tunde Bakare')
  await tunde.getByRole('button', { name: 'Join circle' }).click()
  await expect(tunde).toHaveURL(/\/c\/ikeja-market-women$/)
  await expect(tunde.getByRole('heading', { level: 1, name: 'Ikeja Market Women Ajo' })).toBeVisible()
  await tunde.goto(`${DEMO}/members`)
  await expect(tunde.getByRole('link', { name: /Tunde Bakare/ })).toBeVisible()
})

test('explains a code that does not exist', async ({ page }) => {
  await openLedger(page, '/join?device=tunde')
  await page.getByLabel('Circle code or invite link').fill('no-such-circle')
  await page.getByRole('button', { name: 'Find circle' }).click()
  await expect(page.getByRole('heading', { name: 'No circle with that code' })).toBeVisible()
})

test('members list is readable and accessible', async ({ page }) => {
  await openLedger(page, `${DEMO}/members`)
  await expect(page.getByRole('link', { name: /Blessing Udo.*Owes ₦40,000/ })).toBeVisible()
  await expectAccessible(page)
})

test('member page shows history and blocks removing someone who has paid', async ({ page }) => {
  await openLedger(page, `${DEMO}/members/blessing`)
  await expect(page.getByRole('heading', { level: 1, name: 'Blessing Udo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send a reminder' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove from circle' })).toBeDisabled()
  await expectAccessible(page)
})

test('invite sheet shows a QR code and closes with Escape', async ({ page }, info) => {
  await openLedger(page)
  const invite = page.getByRole('button', { name: 'Invite' })
  await invite.click()
  const sheet = page.getByRole('dialog', { name: /Invite to/ })
  await expect(sheet.getByRole('img', { name: /QR code for/ })).toBeVisible()
  await expect(sheet.locator('code')).toHaveText('ikeja-market-women')
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  if (!isPhone(info)) await expect(invite).toBeFocused()
})

test('sync page can take the phone offline and back', async ({ page }) => {
  await openLedger(page, `${DEMO}/sync`)
  await expectAccessible(page)
  const signal = page.getByRole('switch', { name: /Signal/ })
  await expect(signal).not.toBeChecked()
  await signal.check({ force: true })
  await expect(page.getByText('All changes synced')).toBeVisible({ timeout: 10_000 })
  await signal.uncheck({ force: true })
  await expect(page.getByText("You're offline.")).toBeVisible()
})

test('home, credits and unknown pages', async ({ page }) => {
  await openLedger(page, '/')
  await expect(page.getByRole('heading', { level: 1, name: 'Your circles' })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Photo credits' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Photo credits' })).toBeVisible()
  await expectAccessible(page)
  await page.goto('/c/not-here')
  await expect(page.getByRole('heading', { name: "This circle isn't on this phone" })).toBeVisible()
  await page.goto('/nope/nope')
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible()
})

test('keyboard users can skip to the content', async ({ page }, info) => {
  test.skip(isPhone(info), 'No hardware keyboard on the phone profile')
  await openLedger(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
