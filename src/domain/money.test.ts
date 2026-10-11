import { formatCompact, formatNaira, parseNaira } from './money'

describe('formatNaira', () => {
  it('uses the naira sign and thousands separators', () => {
    expect(formatNaira(160000)).toBe('₦160,000')
    expect(formatNaira(0)).toBe('₦0')
  })

  it('rounds away kobo', () => {
    expect(formatNaira(19999.6)).toBe('₦20,000')
  })
})

describe('formatCompact', () => {
  it.each([
    [20000, '20k'],
    [7500, '7.5k'],
    [900, '900'],
    [1_200_000, '1.2m'],
    [40000, '40k'],
  ])('%d -> %s', (input, expected) => {
    expect(formatCompact(input)).toBe(expected)
  })
})

describe('parseNaira', () => {
  it.each([
    ['20000', 20000],
    ['20,000', 20000],
    ['₦20,000', 20000],
    ['20k', 20000],
    [' 7.5K ', 7500],
    ['1.5m', 1_500_000],
    ['NGN 5000', 5000],
  ])('reads %s', (input, expected) => {
    expect(parseNaira(input)).toBe(expected)
  })

  it.each(['', 'abc', '-200', '0', '20 000 naira', '1.2.3'])('rejects %s', (input) => {
    expect(parseNaira(input)).toBeNull()
  })
})
