import {
  addDays,
  addMonths,
  daysBetween,
  formatShort,
  formatWhen,
  formatWithDay,
  plural,
  previousWeekday,
} from './dates'

describe('day arithmetic', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-08-29', 7)).toBe('2026-09-05')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('clamps months to the last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15')
  })

  it('counts whole days between dates', () => {
    expect(daysBetween('2026-09-26', '2026-09-28')).toBe(2)
    expect(daysBetween('2026-09-28', '2026-09-26')).toBe(-2)
  })

  it('finds the last Saturday on or before a day', () => {
    expect(previousWeekday('2026-10-11', 6)).toBe('2026-10-10')
    expect(previousWeekday('2026-10-10', 6)).toBe('2026-10-10')
    expect(previousWeekday('2026-10-09', 6)).toBe('2026-10-03')
  })
})

describe('formatting', () => {
  it('writes dates the way people say them', () => {
    expect(formatShort('2026-10-10')).toBe('10 Oct')
    expect(formatWithDay('2026-10-10')).toBe('Sat 10 Oct')
  })

  it('keeps recent timestamps short', () => {
    const now = new Date(2026, 9, 11, 9, 0)
    expect(formatWhen(new Date(2026, 9, 11, 8, 14).toISOString(), now)).toBe('08:14')
    expect(formatWhen(new Date(2026, 9, 10, 17, 42).toISOString(), now)).toBe('Sat 17:42')
    expect(formatWhen(new Date(2026, 8, 20, 17, 42).toISOString(), now)).toBe('20 Sep 17:42')
  })

  it('pluralises', () => {
    expect(plural(1, 'change')).toBe('1 change')
    expect(plural(3, 'change')).toBe('3 changes')
  })
})
