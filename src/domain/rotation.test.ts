import { payment, smallCircle } from '../test/fixtures'
import { drawLots, focusSlot, moveInOrder, payoutCheck, schedule } from './rotation'
import { cellKey } from './types'

describe('schedule', () => {
  it('walks the rotation in order with dates', () => {
    const slots = schedule(smallCircle(), '2026-09-06')
    expect(slots.map((s) => [s.memberId, s.date, s.state])).toEqual([
      ['ada', '2026-08-29', 'overdue'],
      ['bola', '2026-09-05', 'collecting'],
      ['chi', '2026-09-12', 'upcoming'],
      ['dayo', '2026-09-19', 'upcoming'],
    ])
  })

  it('marks rounds with a recorded payout as collected', () => {
    const circle = smallCircle()
    circle.payouts['1'] = { amount: 70000, method: 'transfer', paidOn: '2026-08-30', recordedBy: 'x', recordedAt: '' }
    expect(schedule(circle, '2026-09-06')[0]!.state).toBe('collected')
    expect(focusSlot(circle, '2026-09-06')!.memberId).toBe('bola')
  })

  it('points at an unpaid earlier round when nobody is collecting', () => {
    const circle = smallCircle()
    expect(focusSlot(circle, '2026-12-01')!.memberId).toBe('ada')
  })
})

describe('payoutCheck', () => {
  it('lists who is short for the round', () => {
    const check = payoutCheck(smallCircle(), 1)!
    expect(check.recipientId).toBe('ada')
    expect(check.collected).toBe(50000)
    expect(check.shortfall).toBe(30000)
    expect(check.outstanding).toEqual([
      { memberId: 'chi', missing: 10000 },
      { memberId: 'dayo', missing: 20000 },
    ])
  })

  it('has no shortfall once everyone has paid', () => {
    const circle = smallCircle()
    circle.payments[cellKey('chi', 1)] = payment(20000, '2026-08-29')
    circle.payments[cellKey('dayo', 1)] = payment(20000, '2026-08-29')
    expect(payoutCheck(circle, 1)!.shortfall).toBe(0)
  })

  it('returns null for a round that does not exist', () => {
    expect(payoutCheck(smallCircle(), 9)).toBeNull()
  })
})

describe('reordering', () => {
  it('swaps neighbours', () => {
    expect(moveInOrder(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  })

  it('refuses to move past the ends or into paid-out rounds', () => {
    expect(moveInOrder(['a', 'b'], 0, -1)).toBeNull()
    expect(moveInOrder(['a', 'b', 'c'], 1, -1, 1)).toBeNull()
    expect(moveInOrder(['a', 'b', 'c'], 1, 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('draws lots without losing anyone', () => {
    let seed = 42
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const result = drawLots(['a', 'b', 'c', 'd', 'e'], random)
    expect([...result].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result).not.toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
