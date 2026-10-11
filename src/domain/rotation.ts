import { currentRound, isFinished, roundDate, summariseCircle } from './ledger'
import type { ISODate } from './dates'
import { cellKey, type Circle, type Payout } from './types'

export type SlotState = 'collected' | 'collecting' | 'overdue' | 'upcoming'

export interface Slot {
  round: number
  memberId: string
  date: ISODate
  state: SlotState
  payout?: Payout
}

/**
 * Whose turn it is. A past round whose payout was never recorded stays
 * "overdue" rather than quietly turning into collected; the coordinator
 * needs to see that someone hasn't been paid.
 */
export function schedule(circle: Circle, on: ISODate): Slot[] {
  const now = currentRound(circle, on)
  const over = isFinished(circle, on)
  return circle.order.map((memberId, i) => {
    const round = i + 1
    const payout = circle.payouts[String(round)]
    const date = roundDate(circle, round)
    let state: SlotState
    if (payout) state = 'collected'
    else if (round === now && !over) state = 'collecting'
    else if (round <= now) state = 'overdue'
    else state = 'upcoming'
    return { round, memberId, date, state, payout }
  })
}

export interface PayoutCheck {
  round: number
  recipientId: string
  pot: number
  collected: number
  shortfall: number
  /** Members who haven't paid in full for this round, with what's missing. */
  outstanding: { memberId: string; missing: number }[]
}

export function payoutCheck(circle: Circle, round: number): PayoutCheck | null {
  const recipientId = circle.order[round - 1]
  if (!recipientId) return null
  let collected = 0
  const outstanding: PayoutCheck['outstanding'] = []
  for (const id of circle.order) {
    const paid = circle.payments[cellKey(id, round)]?.amount ?? 0
    collected += paid
    if (paid < circle.amount) outstanding.push({ memberId: id, missing: circle.amount - paid })
  }
  const pot = circle.amount * circle.order.length
  return { round, recipientId, pot, collected, shortfall: Math.max(0, pot - collected), outstanding }
}

/** The slot to put in front of people: whoever is collecting now, else the first one still owed. */
export function focusSlot(circle: Circle, on: ISODate): Slot | undefined {
  const slots = schedule(circle, on)
  return (
    slots.find((s) => s.state === 'collecting') ??
    slots.find((s) => s.state === 'overdue') ??
    slots.find((s) => s.state === 'upcoming') ??
    (summariseCircle(circle, on).finished ? slots.at(-1) : undefined)
  )
}

/** Moves a member one place up or down the rotation. Rounds already paid out are locked. */
export function moveInOrder(order: string[], index: number, delta: -1 | 1, lockedUpTo = 0): string[] | null {
  const target = index + delta
  if (target < 0 || target >= order.length) return null
  if (index < lockedUpTo || target < lockedUpTo) return null
  const next = [...order]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

/** "Draw lots" for a new circle: a fair shuffle that can be seeded in tests. */
export function drawLots<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
