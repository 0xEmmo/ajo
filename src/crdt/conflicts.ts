import { A } from './automerge'
import type { CircleDoc } from './circleDoc'
import { parseCellKey, type Payment } from '../domain/types'

export interface Conflict {
  key: string
  memberId: string
  round: number
  versions: Payment[]
}

/**
 * Automerge never loses a concurrent write: when two phones set the same square
 * while apart, it picks a winner deterministically but keeps the other value
 * around. A money ledger shouldn't silently pick, so we surface both.
 */
export function findConflicts(doc: CircleDoc): Conflict[] {
  const out: Conflict[] = []
  for (const key of Object.keys(doc.payments)) {
    const conflicts = A.getConflicts(doc.payments, key)
    if (!conflicts) continue
    const versions = Object.values(conflicts).map((v) => JSON.parse(JSON.stringify(v)) as Payment)
    if (versions.length < 2) continue
    if (versions.every((v) => samePayment(v, versions[0]!))) continue
    versions.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    out.push({ key, ...parseCellKey(key), versions })
  }
  return out.sort((a, b) => a.round - b.round || a.memberId.localeCompare(b.memberId))
}

function samePayment(a: Payment, b: Payment): boolean {
  return a.amount === b.amount && a.method === b.method && a.paidOn === b.paidOn && (a.ref ?? '') === (b.ref ?? '')
}

/** Writing the chosen version again makes it causally newer than both, which clears the conflict everywhere. */
export function resolveConflict(doc: CircleDoc, key: string, chosen: Payment, by: string, at: string) {
  const next = A.change(doc, 'Resolve conflict', (d) => {
    const entry: Payment = { ...chosen, recordedBy: by, recordedAt: at }
    d.payments[key] = JSON.parse(JSON.stringify(entry))
  })
  const heads = A.getHeads(next)
  return { doc: next, hash: heads[heads.length - 1]! }
}
