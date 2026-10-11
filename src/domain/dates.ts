/**
 * Dates in a circle are calendar days ("2026-10-10"), not instants. Contribution
 * day is the same day for everyone in the circle wherever their phone thinks it is,
 * so we keep them as ISO date strings and only do day arithmetic on them.
 */
export type ISODate = string

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12)
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Adds calendar months, clamping 31 Jan + 1 month to 28/29 Feb. */
export function addMonths(iso: ISODate, months: number): ISODate {
  const d = fromISODate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toISODate(d)
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime()
  return Math.round(ms / 86_400_000)
}

/** The most recent given weekday on or before `iso`. 0 is Sunday, 6 is Saturday. */
export function previousWeekday(iso: ISODate, weekday: number): ISODate {
  const d = fromISODate(iso)
  const diff = (d.getDay() - weekday + 7) % 7
  return addDays(iso, -diff)
}

const short = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const withDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const long = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

/** "10 Oct" */
export const formatShort = (iso: ISODate) => short.format(fromISODate(iso))
/** "Sat 10 Oct" */
export const formatWithDay = (iso: ISODate) => withDay.format(fromISODate(iso)).replace(',', '')
/** "Saturday 10 October" */
export const formatLong = (iso: ISODate) => long.format(fromISODate(iso)).replace(',', '')
/** "08:14" from a full timestamp */
export const formatClock = (timestamp: string) => clock.format(new Date(timestamp))

/** "08:14" today, "Sat 17:42" this week, "3 Oct 17:42" otherwise. */
export function formatWhen(timestamp: string, now: Date = new Date()): string {
  const t = new Date(timestamp)
  const sameDay = toISODate(t) === toISODate(now)
  if (sameDay) return formatClock(timestamp)
  const age = daysBetween(toISODate(t), toISODate(now))
  if (age > 0 && age < 7) {
    return `${new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(t)} ${formatClock(timestamp)}`
  }
  return `${formatShort(toISODate(t))} ${formatClock(timestamp)}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
