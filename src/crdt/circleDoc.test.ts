import { A } from './automerge'
import { addMember, clearPayment, createCircleDoc, moveMember, normaliseOrder, recordPayment, removeMember, snapshot } from './circleDoc'
import { findConflicts, resolveConflict } from './conflicts'
import { payment, smallCircle } from '../test/fixtures'
import { cellKey } from '../domain/types'

const fork = (doc: ReturnType<typeof createCircleDoc>) => A.clone(doc)

describe('circle document', () => {
  it('round-trips a circle through save and load', () => {
    const doc = createCircleDoc(smallCircle())
    const loaded = A.load<typeof doc>(A.save(doc))
    expect(snapshot(loaded)).toEqual(snapshot(doc))
  })

  it('records and clears a payment', () => {
    let doc = createCircleDoc(smallCircle())
    doc = recordPayment(doc, 'dayo', 1, payment(20000, '2026-08-29', { ref: undefined })).doc
    expect(doc.payments[cellKey('dayo', 1)]?.amount).toBe(20000)
    doc = clearPayment(doc, 'dayo', 1).doc
    expect(doc.payments[cellKey('dayo', 1)]).toBeUndefined()
  })

  it('returns the hash of the change it made', () => {
    const doc = createCircleDoc(smallCircle())
    const before = A.clone(doc)
    const { doc: next, hash } = recordPayment(doc, 'dayo', 1, payment(20000, '2026-08-29'))
    expect(A.getHeads(next)).toEqual([hash])
    expect(A.hasHeads(before, [hash])).toBe(false)
  })

  it('will not remove a member who has paid anything', () => {
    const doc = createCircleDoc(smallCircle())
    expect(removeMember(doc, 'ada')).toBeNull()
    const { doc: next } = removeMember(doc, 'dayo')!
    expect(next.order).not.toContain('dayo')
    expect(next.members.dayo).toBeUndefined()
  })
})

describe('merging two phones', () => {
  it('keeps payments recorded on different squares', () => {
    const base = createCircleDoc(smallCircle())
    const a = recordPayment(fork(base), 'dayo', 1, payment(20000, '2026-08-29')).doc
    const b = recordPayment(fork(base), 'chi', 2, payment(20000, '2026-09-05')).doc
    const merged = A.merge(a, b)
    expect(Object.keys(merged.payments)).toEqual(expect.arrayContaining(['dayo:1', 'chi:2']))
    expect(findConflicts(merged)).toEqual([])
  })

  it('surfaces both versions when the same square was edited apart', () => {
    const base = createCircleDoc(smallCircle())
    const mine = recordPayment(fork(base), 'dayo', 1, payment(10000, '2026-08-29', { recordedBy: 'me', recordedAt: '2026-10-11T08:31:00Z' })).doc
    const theirs = recordPayment(fork(base), 'dayo', 1, payment(20000, '2026-08-29', { method: 'transfer', recordedBy: 'them', recordedAt: '2026-10-10T17:30:00Z' })).doc
    const merged = A.merge(mine, theirs)
    const [conflict, ...rest] = findConflicts(merged)
    expect(rest).toHaveLength(0)
    expect(conflict).toMatchObject({ key: 'dayo:1', memberId: 'dayo', round: 1 })
    expect(conflict!.versions.map((v) => v.amount)).toEqual([10000, 20000])
  })

  it('ignores concurrent writes that agree', () => {
    const base = createCircleDoc(smallCircle())
    const p = payment(20000, '2026-08-29')
    const a = recordPayment(fork(base), 'dayo', 1, { ...p, recordedBy: 'a' }).doc
    const b = recordPayment(fork(base), 'dayo', 1, { ...p, recordedBy: 'b' }).doc
    expect(findConflicts(A.merge(a, b))).toEqual([])
  })

  it('clears the conflict on every phone once someone picks a version', () => {
    const base = createCircleDoc(smallCircle())
    const a = recordPayment(fork(base), 'dayo', 1, payment(10000, '2026-08-29')).doc
    const b = recordPayment(fork(base), 'dayo', 1, payment(20000, '2026-08-29')).doc
    const merged = A.merge(a, b)
    const chosen = findConflicts(merged)[0]!.versions.find((v) => v.amount === 20000)!
    const resolved = resolveConflict(merged, 'dayo:1', chosen, 'me', '2026-10-11T09:00:00Z').doc
    expect(findConflicts(resolved)).toEqual([])
    const elsewhere = A.merge(fork(b), resolved)
    expect(findConflicts(elsewhere)).toEqual([])
    expect(elsewhere.payments['dayo:1']?.amount).toBe(20000)
  })

  it('does not lose a member added while someone else reordered', () => {
    const base = createCircleDoc(smallCircle())
    const added = addMember(fork(base), { id: 'efe', name: 'Efe', joinedOn: '2026-10-01' }).doc
    const moved = moveMember(fork(base), 3, 0).doc
    const order = snapshot(A.merge(added, moved)).order
    expect(order).toHaveLength(5)
    expect(order[0]).toBe('dayo')
    expect(order).toContain('efe')
  })
})

describe('normaliseOrder', () => {
  it('drops duplicates and unknown ids and appends anyone missing', () => {
    const circle = smallCircle()
    circle.order = ['bola', 'ghost', 'bola', 'ada']
    expect(normaliseOrder(circle)).toEqual(['bola', 'ada', 'chi', 'dayo'])
  })
})
