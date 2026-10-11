const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

/** ₦20,000. Amounts are whole naira; kobo never shows up in a contribution. */
export function formatNaira(amount: number): string {
  return naira.format(Math.round(amount))
}

/** Short form for the grid squares: 20k, 7.5k, 1.2m, 900. */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${trim(amount / 1_000_000)}m`
  if (abs >= 1_000) return `${trim(amount / 1_000)}k`
  return String(Math.round(amount))
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

/**
 * Reads what people actually type: "20000", "20,000", "₦20,000", "20k", "1.5m".
 * Returns null for anything that isn't a positive whole amount.
 */
export function parseNaira(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[₦,\s]/g, '').replace(/^ngn/, '')
  const match = /^(\d+(?:\.\d+)?)([km]?)$/.exec(cleaned)
  if (!match) return null
  const base = Number(match[1])
  const multiplier = match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1
  const value = Math.round(base * multiplier)
  return value > 0 ? value : null
}
