import { smallCircle, payment } from '../test/fixtures'
import { cellFor, currentRound, describeMember, isFinished, roundDate, summariseCircle, summariseMember } from './ledger'
import { formatNaira } from './money'
import { cellKey } from './types'

describe('rounds', () => {
  const circle = smallCircle()

  it('puts each round a week apart', () => {
    expect(roundDate(circle, 1)).toBe('2026-08-29')
    expect(roundDate(circle, 4)).toBe('2026-09-19')
  })

  it('uses calendar months for monthly circles', () => {
    const monthly = { ...circle, frequency: 'monthly' as const, startDate: '2026-01-31' }
    expect(roundDate(monthly, 2)).toBe('2026-02-28')
    expect(roundDate(monthly, 3)).toBe('2026-03-31')
  })

  it('knows the current round, including before the start and after the end', () => {
    expect(currentRound(circle, '2026-08-28')).toBe(0)
    expect(currentRound(circle, '2026-08-29')).toBe(1)
    expect(currentRound(circle, '2026-09-04')).toBe(1)
    expect(currentRound(circle, '2026-09-05')).toBe(2)
    expect(currentRound(circle, '2027-01-01')).toBe(4)
    expect(isFinished(circle, '2026-09-25')).toBe(false)
    expect(isFinished(circle, '2026-09-26')).toBe(true)
  })
})

describe('cell states', () => {
  const circle = smallCircle()
  const on = '2026-09-06' // round 2

  it('marks on-time full payments as paid', () => {
    expect(cellFor(circle, 'ada', 1, on).state).toBe('paid')
  })

  it('counts days late from contribution day', () => {
    const cell = cellFor(circle, 'bola', 1, on)
    expect(cell.state).toBe('late')
    expect(cell.daysLate).toBe(2)
  })

  it('shows part payments', () => {
    expect(cellFor(circle, 'chi', 1, on).state).toBe('part')
  })

  it('treats unpaid past rounds as missed and this round as due', () => {
    expect(cellFor(circle, 'dayo', 1, on).state).toBe('missed')
    expect(cellFor(circle, 'dayo', 2, on).state).toBe('due')
    expect(cellFor(circle, 'dayo', 3, on).state).toBe('upcoming')
  })

  it('stops calling the last round due once the circle is over', () => {
    expect(cellFor(circle, 'dayo', 4, '2026-09-30').state).toBe('missed')
  })
})

describe('totals', () => {
  it('lets an overpayment cover a missed week', () => {
    const circle = smallCircle()
    circle.payments[cellKey('dayo', 2)] = payment(40000, '2026-09-05')
    const s = summariseMember(circle, 'dayo', '2026-09-06')
    expect(s.missedRounds).toEqual([1])
    expect(s.owed).toBe(0)
    expect(describeMember(s, formatNaira, 'wk')).toBe('Missed wk 1, caught up')
  })

  it('reports credit for paying ahead', () => {
    const s = summariseMember(smallCircle(), 'ada', '2026-08-30')
    expect(s.credit).toBe(40000)
    expect(describeMember(s, formatNaira, 'wk')).toBe('₦40,000 ahead')
  })

  it('adds up what the circle is owed', () => {
    const s = summariseCircle(smallCircle(), '2026-09-06')
    // expected 40k each: ada 60k paid, bola 20k, chi 10k, dayo 0
    expect(s.owed).toBe(0 + 20000 + 30000 + 40000)
    expect(s.pot).toBe(80000)
    expect(s.collectedThisRound).toBe(40000)
    expect(s.paidThisRound).toBe(1)
  })

  it('has nothing owed before the start', () => {
    const s = summariseMember(smallCircle(), 'dayo', '2026-08-01')
    expect(s.owed).toBe(0)
    expect(describeMember({ ...s, credit: 0 }, formatNaira, 'wk')).toBe('Nothing due yet')
  })

  it('describes several missed rounds in plain English', () => {
    const circle = smallCircle()
    circle.payments[cellKey('dayo', 4)] = payment(80000, '2026-09-19')
    const s = summariseMember(circle, 'dayo', '2026-09-20')
    expect(describeMember(s, formatNaira, 'wk')).toBe('Missed wk 1, 2 and 3, caught up')
  })
})
