import { A } from './automerge'
import { createCircleDoc, recordPayment, type CircleDoc } from './circleDoc'
import { addDays, previousWeekday, type ISODate } from '../domain/dates'
import { cellKey, type Circle, type Member, type Payment } from '../domain/types'

export const DEMO_CIRCLE_ID = 'ikeja-market-women'
export const DEMO_DEVICE = 'kemi'
export const COORDINATOR_DEVICE = 'iya-sade'

const people: [id: string, name: string][] = [
  ['iya-sade', 'Iya Sade'],
  ['ngozi', 'Ngozi Eze'],
  ['halima', 'Halima Bello'],
  ['funke', 'Funke Adeyemi'],
  ['kemi', 'Kemi Ogun'],
  ['rukayat', 'Rukayat Lawal'],
  ['mama-bisi', 'Mama Bisi'],
  ['blessing', 'Blessing Udo'],
]

/** Days late per member per week; null means nothing was paid. Anything not listed was paid on the day. */
const exceptions: Record<string, Record<number, number | null | { amount: number }>> = {
  ngozi: { 3: 2, 7: null },
  halima: { 5: 1 },
  funke: { 5: null, 7: null },
  kemi: { 6: 3 },
  rukayat: { 2: null, 3: { amount: 40000 } },
  'mama-bisi': { 7: null },
  blessing: { 4: null, 5: null },
}

export interface QueuedEdit {
  hash: string
  circleId: string
  label: string
  detail: string
  at: string
  key?: string
}

export interface DemoSeed {
  relay: CircleDoc
  kemi: CircleDoc
  kemiQueue: QueuedEdit[]
  lastSyncedAt: string
}

/**
 * Builds the demo the way it would really have happened: a shared history,
 * then Iya Sade and Kemi each recording things on their own phones while apart.
 * Kemi's three changes are still waiting to sync, and one of them clashes with
 * a square Iya Sade already sent to the relay.
 */
export function buildDemo(now: Date = new Date()): DemoSeed {
  const todayISO = toISO(now)
  const start = addDays(previousWeekday(todayISO, 6), -42)
  const amount = 20000
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()
  const atDay = (iso: ISODate, hh: number, mm = 0) => {
    const [y, mo, d] = iso.split('-').map(Number)
    return new Date(y!, mo! - 1, d!, hh, mm).toISOString()
  }
  const week = (n: number) => addDays(start, (n - 1) * 7)

  const members: Record<string, Member> = {}
  for (const [id, name] of people) {
    members[id] = { id, name, photo: `/photos/${id}.jpg`, joinedOn: addDays(start, -10) }
  }

  const payments: Record<string, Payment> = {}
  for (const [id] of people) {
    for (let w = 1; w <= 7; w++) {
      const rule = exceptions[id]?.[w]
      if (rule === null) continue
      const late = typeof rule === 'number' ? rule : 0
      const paidOn = addDays(week(w), late)
      payments[cellKey(id, w)] = {
        amount: typeof rule === 'object' ? rule.amount : amount,
        method: (w + id.length) % 3 === 0 ? 'transfer' : 'cash',
        paidOn,
        recordedBy: id === 'kemi' || w % 2 === 0 ? 'kemi' : 'iya-sade',
        recordedAt: atDay(paidOn, 9 + (id.length % 8), (w * 7) % 60),
      }
    }
  }

  const payouts: Circle['payouts'] = {}
  for (let w = 1; w <= 6; w++) {
    const collected = people.reduce((sum, [id]) => sum + (payments[cellKey(id, w)]?.amount ?? 0), 0)
    payouts[String(w)] = {
      amount: collected,
      method: 'transfer',
      paidOn: addDays(week(w), 1),
      recordedBy: 'iya-sade',
      recordedAt: atDay(addDays(week(w), 1), 18, 10),
    }
  }

  const circle: Circle = {
    id: DEMO_CIRCLE_ID,
    name: 'Ikeja Market Women Ajo',
    amount,
    frequency: 'weekly',
    startDate: start,
    coordinatorId: 'iya-sade',
    createdAt: atDay(addDays(start, -10), 16),
    members,
    order: people.map(([id]) => id),
    payments,
    payouts,
  }

  const base = createCircleDoc(circle)

  // Iya Sade's phone: she marks Funke's week 5 as a full transfer and it reaches the relay.
  const relay = recordPayment(A.clone(base), 'funke', 5, {
    amount,
    method: 'transfer',
    paidOn: week(5),
    recordedBy: 'iya-sade',
    recordedAt: minutesAgo(60 * 14 + 12),
  }).doc

  // Kemi's phone, offline since last night.
  const queue: QueuedEdit[] = []
  let kemi = A.clone(base)
  const push = (label: string, detail: string, at: string, key: string, run: (d: CircleDoc) => { doc: CircleDoc; hash: string }) => {
    const res = run(kemi)
    kemi = res.doc
    queue.push({ hash: res.hash, circleId: DEMO_CIRCLE_ID, label, detail, at, key })
  }
  const t1 = minutesAgo(40)
  push('Ngozi paid ₦20,000 for week 7', 'Transfer ref 0291', t1, cellKey('ngozi', 7), (d) =>
    recordPayment(d, 'ngozi', 7, { amount, method: 'transfer', ref: '0291', paidOn: week(7), recordedBy: 'kemi', recordedAt: t1 }),
  )
  const t2 = minutesAgo(34)
  push('Mama Bisi paid ₦20,000 for week 7', 'Cash at the stall', t2, cellKey('mama-bisi', 7), (d) =>
    recordPayment(d, 'mama-bisi', 7, { amount, method: 'cash', note: 'At the stall', paidOn: week(7), recordedBy: 'kemi', recordedAt: t2 }),
  )
  const t3 = minutesAgo(23)
  push('Funke week 5 set to ₦10,000', 'Part paid, cash', t3, cellKey('funke', 5), (d) =>
    recordPayment(d, 'funke', 5, { amount: 10000, method: 'cash', paidOn: week(5), recordedBy: 'kemi', recordedAt: t3 }),
  )

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(17, 42, 0, 0)

  return { relay, kemi, kemiQueue: queue, lastSyncedAt: yesterday.toISOString() }
}

function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
