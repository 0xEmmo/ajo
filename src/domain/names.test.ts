import { firstName, initials, slugId } from './names'

describe('names', () => {
  it('makes initials', () => {
    expect(initials('Funke Adeyemi')).toBe('FA')
    expect(initials('Iya Sade')).toBe('IS')
    expect(initials('Tolu')).toBe('TO')
    expect(initials('  ')).toBe('?')
  })

  it('keeps titles with first names', () => {
    expect(firstName('Funke Adeyemi')).toBe('Funke')
    expect(firstName('Mama Bisi')).toBe('Mama Bisi')
    expect(firstName('Iya Sade Akinola')).toBe('Iya Sade')
  })

  it('builds readable ids', () => {
    expect(slugId('Ọ̀jà Ọba Thrift', () => 0.5)).toMatch(/^oja-oba-thrift-[0-9a-z]{4}$/)
    expect(slugId('!!!', () => 0)).toBe('circle-0000')
  })
})
