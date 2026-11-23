import { describe, expect, it } from 'vitest'
import { chiSquareEvenSplit, describeReading, formatPValue, readResult } from './stats'

describe('chiSquareEvenSplit', () => {
  it('is 0 with p = 1 for a perfectly even split', () => {
    const { chiSquare, pValue } = chiSquareEvenSplit({ a: 10, b: 10, c: 10 })
    expect(chiSquare).toBe(0)
    expect(pValue).toBe(1)
  })

  it('matches a hand calculation: 20/5/5 gives chi-square 15', () => {
    // expected 10 each: (10^2 + 5^2 + 5^2) / 10 = 15, p = exp(-7.5)
    const { chiSquare, pValue } = chiSquareEvenSplit({ a: 20, b: 5, c: 5 })
    expect(chiSquare).toBeCloseTo(15, 10)
    expect(pValue).toBeCloseTo(Math.exp(-7.5), 12)
  })

  it('matches a hand calculation: 12/10/8 gives chi-square 0.8', () => {
    const { chiSquare, pValue } = chiSquareEvenSplit({ a: 12, b: 10, c: 8 })
    expect(chiSquare).toBeCloseTo(0.8, 10)
    expect(pValue).toBeCloseTo(Math.exp(-0.4), 12)
  })

  it('handles zero votes without dividing by zero', () => {
    expect(chiSquareEvenSplit({ a: 0, b: 0, c: 0 })).toEqual({ chiSquare: 0, pValue: 1 })
  })
})

describe('readResult', () => {
  it('reports no votes', () => {
    expect(readResult({ a: 0, b: 0, c: 0 })).toEqual({
      total: 0,
      leaders: [],
      kind: 'no-votes',
      pValue: null,
    })
  })

  it('does not run the test below 30 votes, however lopsided', () => {
    const reading = readResult({ a: 29, b: 0, c: 0 })
    expect(reading.kind).toBe('too-few')
    expect(reading.pValue).toBeNull()
    expect(reading.leaders).toEqual(['a'])
  })

  it('calls a close split at 30 votes "could be chance"', () => {
    const reading = readResult({ a: 12, b: 10, c: 8 })
    expect(reading.kind).toBe('could-be-chance')
    expect(reading.leaders).toEqual(['a'])
  })

  it('calls a lopsided split at 30 votes "uneven"', () => {
    const reading = readResult({ a: 5, b: 20, c: 5 })
    expect(reading.kind).toBe('uneven')
    expect(reading.leaders).toEqual(['b'])
  })

  it('lists every line that shares the lead', () => {
    expect(readResult({ a: 3, b: 3, c: 1 }).leaders).toEqual(['a', 'b'])
  })
})

describe('wording', () => {
  it('formats small and ordinary p-values', () => {
    expect(formatPValue(0.0004)).toBe('p < 0.001')
    expect(formatPValue(0.6703)).toBe('p = 0.670')
  })

  it('never claims a winner when there are too few votes', () => {
    const text = describeReading(readResult({ a: 6, b: 4, c: 2 }))
    expect(text).toBe('12 of 30 votes. Too few to tell the lines apart yet.')
  })
})
