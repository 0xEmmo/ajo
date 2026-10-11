import { A, type Doc } from './automerge'
import { cellKey, parseCellKey, type Circle, type Member, type Payment, type Payout } from '../domain/types'

export type CircleDoc = Doc<Circle>

/** Automerge refuses `undefined`, and optional fields are everywhere in a form. */
function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

export interface Edit {
  doc: CircleDoc
  /** Hash of the change we just made, so the sync queue can tell when it has reached the relay. */
  hash: string
}

function edit(doc: CircleDoc, message: string, fn: (d: Circle) => void, time?: number): Edit {
  const next = A.change(doc, { message, time }, fn)
  const heads = A.getHeads(next)
  return { doc: next, hash: heads[heads.length - 1]! }
}

export function createCircleDoc(circle: Circle, actor?: string): CircleDoc {
  const doc = A.init<Circle>(actor ? { actor } : undefined)
  return A.change(doc, 'Create circle', (d) => {
    Object.assign(d, structuredClone(circle))
  })
}

export function recordPayment(doc: CircleDoc, memberId: string, round: number, payment: Payment): Edit {
  return edit(doc, 'Record payment', (d) => {
    d.payments[cellKey(memberId, round)] = clean(payment)
  })
}

export function clearPayment(doc: CircleDoc, memberId: string, round: number): Edit {
  return edit(doc, 'Clear payment', (d) => {
    delete d.payments[cellKey(memberId, round)]
  })
}

export function recordPayout(doc: CircleDoc, round: number, payout: Payout): Edit {
  return edit(doc, 'Record payout', (d) => {
    d.payouts[String(round)] = clean(payout)
  })
}

export function undoPayout(doc: CircleDoc, round: number): Edit {
  return edit(doc, 'Undo payout', (d) => {
    delete d.payouts[String(round)]
  })
}

export function addMember(doc: CircleDoc, member: Member): Edit {
  return edit(doc, 'Add member', (d) => {
    d.members[member.id] = clean(member)
    d.order.push(member.id)
  })
}

export function updateMember(doc: CircleDoc, id: string, patch: Partial<Omit<Member, 'id'>>): Edit {
  return edit(doc, 'Update member', (d) => {
    const m = d.members[id]
    if (!m) return
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') delete (m as unknown as Record<string, unknown>)[k]
      else (m as unknown as Record<string, unknown>)[k] = v
    }
  })
}

export function hasPayments(circle: Circle, memberId: string): boolean {
  return Object.keys(circle.payments).some((k) => parseCellKey(k).memberId === memberId)
}

export function removeMember(doc: CircleDoc, id: string): Edit | null {
  if (hasPayments(doc, id)) return null
  return edit(doc, 'Remove member', (d) => {
    delete d.members[id]
    const i = d.order.indexOf(id)
    if (i >= 0) d.order.splice(i, 1)
  })
}

/** Moves with list operations rather than replacing the array, so a member added on another phone survives. */
export function moveMember(doc: CircleDoc, from: number, to: number): Edit {
  return edit(doc, 'Change rotation', (d) => {
    const id = d.order[from]
    if (id === undefined) return
    d.order.splice(from, 1)
    d.order.splice(to, 0, id)
  })
}

export function renameCircle(doc: CircleDoc, name: string): Edit {
  return edit(doc, 'Rename circle', (d) => {
    d.name = name
  })
}

/**
 * Concurrent list edits can leave the rotation with a duplicate (two phones
 * moved the same person) or missing someone (added while the list was being
 * rebuilt). Reading through this keeps the ledger sane either way.
 */
export function normaliseOrder(circle: Circle): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const id of circle.order) {
    if (circle.members[id] && !seen.has(id)) {
      seen.add(id)
      order.push(id)
    }
  }
  const missing = Object.values(circle.members)
    .filter((m) => !seen.has(m.id))
    .sort((a, b) => a.joinedOn.localeCompare(b.joinedOn) || a.id.localeCompare(b.id))
  return [...order, ...missing.map((m) => m.id)]
}

/** A plain, normalised snapshot for rendering. */
export function snapshot(doc: CircleDoc): Circle {
  const plain = A.toJS(doc) as Circle
  return { ...plain, order: normaliseOrder(plain) }
}
