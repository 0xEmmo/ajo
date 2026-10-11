import { cellFor } from '../domain/ledger'
import { cellKey } from '../domain/types'
import { payment, smallCircle } from '../test/fixtures'
import { cellLabel, cellText } from './labels'

describe('square labels', () => {
  const circle = smallCircle()
  const on = '2026-09-06'

  it('prints short text inside squares', () => {
    expect(cellText(cellFor(circle, 'ada', 1, on), 20000)).toBe('20k')
    expect(cellText(cellFor(circle, 'bola', 1, on), 20000)).toBe('+2 days')
    expect(cellText(cellFor(circle, 'chi', 1, on), 20000)).toBe('10k of 20k')
    expect(cellText(cellFor(circle, 'dayo', 1, on), 20000)).toBe('missed')
    expect(cellText(cellFor(circle, 'dayo', 2, on), 20000)).toBe('due')
  })

  it('gives screen readers the whole story', () => {
    const c = { ...circle, payments: { ...circle.payments, [cellKey('chi', 2)]: payment(5000, '2026-09-05') } }
    expect(cellLabel(cellFor(c, 'chi', 2, on), 'Chi', c, { unsynced: true, conflict: true })).toBe(
      'Chi, week 2, Sat 5 Sep, part paid ₦5,000, two versions to check, not synced yet',
    )
    expect(cellLabel(cellFor(c, 'bola', 1, on), 'Bola', c)).toBe('Bola, week 1, Sat 29 Aug, paid late ₦20,000, 2 days late')
    expect(cellLabel(cellFor(c, 'dayo', 3, on), 'Dayo', c)).toBe('Dayo, week 3, Sat 12 Sep, not yet due')
  })
})
