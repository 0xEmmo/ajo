import type { ISODate } from './dates'

export type Frequency = 'weekly' | 'monthly'
export type PaymentMethod = 'cash' | 'transfer' | 'pos'

export interface Member {
  id: string
  name: string
  /** Asset path or a small data URL captured on the phone that added them. */
  photo?: string
  phone?: string
  joinedOn: ISODate
}

export interface Payment {
  amount: number
  method: PaymentMethod
  paidOn: ISODate
  ref?: string
  note?: string
  /** Device that recorded it, e.g. "kemi". */
  recordedBy: string
  /** Full timestamp; used to show "edited 08:31" when versions disagree. */
  recordedAt: string
}

export interface Payout {
  amount: number
  method: PaymentMethod
  paidOn: ISODate
  recordedBy: string
  recordedAt: string
}

/**
 * One savings circle. This is the shape of the Automerge document, so every
 * field must be plain JSON. Payments are keyed "memberId:week" so two phones
 * writing the same square land on the same key and Automerge can tell us they
 * disagree.
 */
export interface Circle {
  id: string
  name: string
  amount: number
  frequency: Frequency
  startDate: ISODate
  coordinatorId: string
  createdAt: string
  members: Record<string, Member>
  /** Rotation order. The member at index i collects in round i + 1. */
  order: string[]
  payments: Record<string, Payment>
  payouts: Record<string, Payout>
}

export type CellKey = `${string}:${number}`

export const cellKey = (memberId: string, round: number): CellKey => `${memberId}:${round}`

export function parseCellKey(key: string): { memberId: string; round: number } {
  const i = key.lastIndexOf(':')
  return { memberId: key.slice(0, i), round: Number(key.slice(i + 1)) }
}
