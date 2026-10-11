import { A } from './automerge'
import { buildDemo } from './seed'
import { findConflicts } from './conflicts'
import { snapshot } from './circleDoc'
import { summariseCircle, summariseMember } from '../domain/ledger'
import { toISODate } from '../domain/dates'

describe('demo circle', () => {
  const now = new Date(2026, 9, 11, 8, 54)
  const demo = buildDemo(now)
  const on = toISODate(now)

  it('starts on a Saturday six weeks back', () => {
    expect(snapshot(demo.kemi).startDate).toBe('2026-08-29')
  })

  it("matches the numbers in Kemi's offline ledger", () => {
    const s = summariseCircle(snapshot(demo.kemi), on)
    expect(s).toMatchObject({ pot: 160000, round: 7, rounds: 8, collectedThisRound: 140000, paidThisRound: 7 })
    expect(s.owed).toBe(70000)
    expect(summariseMember(snapshot(demo.kemi), 'rukayat', on).owed).toBe(0)
  })

  it('has no conflict until Kemi syncs, then exactly one', () => {
    expect(findConflicts(demo.kemi)).toHaveLength(0)
    expect(findConflicts(demo.relay)).toHaveLength(0)
    const merged = A.merge(A.clone(demo.kemi), demo.relay)
    const conflicts = findConflicts(merged)
    expect(conflicts.map((c) => c.key)).toEqual(['funke:5'])
    expect(conflicts[0]!.versions.map((v) => v.amount).sort()).toEqual([10000, 20000])
  })

  it('queues three edits that the relay does not have yet', () => {
    expect(demo.kemiQueue).toHaveLength(3)
    for (const q of demo.kemiQueue) {
      expect(A.hasHeads(demo.kemi, [q.hash])).toBe(true)
      expect(A.hasHeads(demo.relay, [q.hash])).toBe(false)
    }
  })
})
