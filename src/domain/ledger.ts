import { addDays, addMonths, daysBetween, type ISODate } from './dates'
import { cellKey, type Circle, type Payment } from './types'

export type CellState = 'paid' | 'late' | 'part' | 'missed' | 'due' | 'upcoming'

export interface Cell {
  memberId: string
  round: number
  date: ISODate
  state: CellState
  payment?: Payment
  /** Days after contribution day, for late payments. */
  daysLate?: number
}

export function roundCount(circle: Circle): number {
  return circle.order.length
}

export function roundDate(circle: Pick<Circle, 'startDate' | 'frequency'>, round: number): ISODate {
  return circle.frequency === 'weekly'
    ? addDays(circle.startDate, (round - 1) * 7)
    : addMonths(circle.startDate, round - 1)
}

/**
 * Which round today falls in. 0 before the circle starts; capped at the last
 * round once the circle is over (so the ledger stays on the final week).
 */
export function currentRound(circle: Circle, on: ISODate): number {
  if (daysBetween(circle.startDate, on) < 0) return 0
  const total = roundCount(circle)
  for (let r = total; r >= 1; r--) {
    if (daysBetween(roundDate(circle, r), on) >= 0) return r
  }
  return 0
}

export function isFinished(circle: Circle, on: ISODate): boolean {
  const total = roundCount(circle)
  if (total === 0) return false
  const after = circle.frequency === 'weekly' ? addDays(roundDate(circle, total), 7) : addMonths(roundDate(circle, total), 1)
  return daysBetween(after, on) >= 0
}

export function cellFor(circle: Circle, memberId: string, round: number, on: ISODate): Cell {
  const date = roundDate(circle, round)
  const payment = circle.payments[cellKey(memberId, round)]
  if (payment) {
    if (payment.amount < circle.amount) return { memberId, round, date, state: 'part', payment }
    const daysLate = daysBetween(date, payment.paidOn)
    if (daysLate > 0) return { memberId, round, date, state: 'late', payment, daysLate }
    return { memberId, round, date, state: 'paid', payment }
  }
  const now = currentRound(circle, on)
  if (round > now) return { memberId, round, date, state: 'upcoming' }
  if (round === now && !isFinished(circle, on)) return { memberId, round, date, state: 'due' }
  return { memberId, round, date, state: 'missed' }
}

export interface MemberSummary {
  memberId: string
  paid: number
  expected: number
  /** Never negative: paying ahead shows as credit instead. */
  owed: number
  credit: number
  missedRounds: number[]
  lateRounds: number[]
  partRounds: number[]
}

/**
 * Totals are by money, not by square. If Rukayat missed week 2 and paid ₦40,000
 * in week 3, week 2 still shows missed (that's the history) but she owes nothing.
 */
export function summariseMember(circle: Circle, memberId: string, on: ISODate): MemberSummary {
  const upTo = currentRound(circle, on)
  let paid = 0
  const missedRounds: number[] = []
  const lateRounds: number[] = []
  const partRounds: number[] = []
  for (let r = 1; r <= roundCount(circle); r++) {
    const cell = cellFor(circle, memberId, r, on)
    if (cell.payment) paid += cell.payment.amount
    if (r > upTo) continue
    if (cell.state === 'missed') missedRounds.push(r)
    if (cell.state === 'late') lateRounds.push(r)
    if (cell.state === 'part') partRounds.push(r)
  }
  const expected = upTo * circle.amount
  return {
    memberId,
    paid,
    expected,
    owed: Math.max(0, expected - paid),
    credit: Math.max(0, paid - expected),
    missedRounds,
    lateRounds,
    partRounds,
  }
}

export interface CircleSummary {
  pot: number
  round: number
  rounds: number
  owed: number
  collectedThisRound: number
  paidThisRound: number
  finished: boolean
}

export function summariseCircle(circle: Circle, on: ISODate): CircleSummary {
  const round = currentRound(circle, on)
  let owed = 0
  let collectedThisRound = 0
  let paidThisRound = 0
  for (const id of circle.order) {
    owed += summariseMember(circle, id, on).owed
    const payment = circle.payments[cellKey(id, round)]
    if (payment) {
      collectedThisRound += payment.amount
      if (payment.amount >= circle.amount) paidThisRound++
    }
  }
  return {
    pot: circle.amount * circle.order.length,
    round,
    rounds: roundCount(circle),
    owed,
    collectedThisRound,
    paidThisRound,
    finished: isFinished(circle, on),
  }
}

/** One-line status for a member row on the phone layout. */
export function describeMember(s: MemberSummary, fmt: (n: number) => string, roundLabel: string): string {
  if (s.owed > 0) return `Owes ${fmt(s.owed)}`
  const join = (rs: number[]) =>
    rs.length === 1 ? `${roundLabel} ${rs[0]}` : `${roundLabel} ${rs.slice(0, -1).join(', ')} and ${rs.at(-1)}`
  if (s.missedRounds.length > 0) return `Missed ${join(s.missedRounds)}, caught up`
  if (s.credit > 0) return `${fmt(s.credit)} ahead`
  if (s.lateRounds.length > 0) return `Paid late in ${join(s.lateRounds)}`
  return s.expected === 0 ? 'Nothing due yet' : 'All paid'
}
