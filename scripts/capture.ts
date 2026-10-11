/**
 * Captures the README screenshots and demo GIF from a running preview build.
 *   npm run build && npm run preview &
 *   npx tsx scripts/capture.ts
 * Needs ffmpeg on PATH for the GIF.
 */
import { chromium, type Browser, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = 'docs'
const NOW = new Date('2026-10-11T08:54:00+01:00')
const DEMO = '/c/ikeja-market-women'

const phone = { width: 390, height: 844 }
const desktop = { width: 1440, height: 900 }

async function open(browser: Browser, viewport: { width: number; height: number }, video?: string) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: viewport.width < 720,
    hasTouch: viewport.width < 720,
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
    reducedMotion: 'no-preference',
    // The "saved for offline" notice would land in every shot.
    serviceWorkers: 'block',
    ...(video ? { recordVideo: { dir: video, size: viewport } } : {}),
  })
  const page = await context.newPage()
  await page.clock.setFixedTime(NOW)
  return { context, page }
}

async function ready(page: Page, path: string) {
  await page.goto(BASE + path)
  await page.getByRole('region', { name: 'Connection' }).waitFor()
  await page.waitForTimeout(600)
}

async function dismissTip(page: Page) {
  const tip = page.getByRole('button', { name: 'Dismiss tip' })
  if (await tip.isVisible()) await tip.click()
}

async function waitForToasts(page: Page) {
  await page
    .locator('.toast')
    .first()
    .waitFor({ state: 'detached', timeout: 10_000 })
    .catch(() => {})
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` })

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()

  {
    const { context, page } = await open(browser, desktop)
    await ready(page, DEMO)
    await dismissTip(page)
    await shot(page, 'desktop-offline')
    await page.getByRole('button', { name: 'Reconnect' }).click()
    await page.getByText('All changes synced').waitFor()
    await waitForToasts(page)
    await shot(page, 'desktop-conflict')
    await page.getByRole('button', { name: /^Funke Adeyemi, week 7/ }).click()
    await page.waitForTimeout(400)
    await shot(page, 'desktop-payment')
    await page.keyboard.press('Escape')
    await ready(page, `${DEMO}/rotation`)
    await shot(page, 'desktop-rotation')
    await context.close()
  }

  {
    const { context, page } = await open(browser, phone)
    await ready(page, DEMO)
    await dismissTip(page)
    await shot(page, 'phone-offline')
    await page.getByRole('button', { name: 'Reconnect' }).click()
    await page.getByText('All changes synced').waitFor()
    await waitForToasts(page)
    await page.getByRole('button', { name: 'Review' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'phone-conflict')
    await page.keyboard.press('Escape')
    await ready(page, `${DEMO}/members/funke`)
    await shot(page, 'phone-member')
    await ready(page, '/')
    await shot(page, 'phone-home')
    await context.close()
  }

  // Demo GIF: record a payment offline, reconnect, settle the clash.
  {
    const dir = `${OUT}/.video`
    rmSync(dir, { recursive: true, force: true })
    const { context, page } = await open(browser, phone, dir)
    await ready(page, DEMO)
    await dismissTip(page)
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: 'Record payment' }).click()
    await page.waitForTimeout(700)
    await page.getByRole('combobox', { name: /^Member/ }).selectOption({ label: 'Funke Adeyemi' })
    await page.waitForTimeout(500)
    await page.getByRole('radio', { name: 'Transfer' }).check({ force: true })
    await page.getByLabel('Reference').pressSequentially('4410', { delay: 90 })
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Save payment' }).click()
    await page.waitForTimeout(1600)
    await page.getByRole('button', { name: 'Reconnect' }).click()
    await page.waitForTimeout(2600)
    await page.getByRole('button', { name: 'Review' }).click()
    await page.waitForTimeout(1400)
    await page.getByRole('button', { name: 'Keep ₦20,000' }).click()
    await page.waitForTimeout(1800)
    await context.close()
    const webm = readdirSync(dir).find((f) => f.endsWith('.webm'))!
    renameSync(`${dir}/${webm}`, `${dir}/demo.webm`)
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      `${dir}/demo.webm`,
      '-vf',
      'fps=10,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      `${OUT}/demo.gif`,
    ])
    rmSync(dir, { recursive: true, force: true })
  }

  await browser.close()
}

await main()
