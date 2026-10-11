/**
 * Renders the app icons from the same mark used in the UI.
 * Run with: npx tsx scripts/make-icons.ts (needs Playwright's Chromium).
 */
import { chromium } from '@playwright/test'

const mark = (size: number, pad: number, rounded: boolean) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="#0f4a36"/>
  <g transform="translate(${pad} ${pad}) scale(${(32 - pad * 2) / 32})">
    <circle cx="16" cy="16" r="9" fill="none" stroke="#dcebe2" stroke-width="3" stroke-dasharray="4.2 2.9"/>
    <circle cx="16" cy="7" r="3.4" fill="#e3a21a"/>
  </g>
</svg>`

const icons = [
  { file: 'icon-192.png', size: 192, pad: 2, rounded: true },
  { file: 'icon-512.png', size: 512, pad: 2, rounded: true },
  // Maskable icons get cropped to a circle or squircle: keep the mark inside the safe zone.
  { file: 'maskable-512.png', size: 512, pad: 7, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, pad: 4, rounded: false },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${mark(icon.size, icon.pad, icon.rounded)}`)
  await page.locator('svg').screenshot({ path: `public/icons/${icon.file}`, omitBackground: true })
}
await browser.close()
