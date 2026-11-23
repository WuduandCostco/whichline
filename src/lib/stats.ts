/**
 * Reading a three-way vote count honestly.
 *
 * The question is whether the split could just be chance. We use a chi-square
 * goodness-of-fit test against an even split (each line gets a third).
 *
 * What a small p-value does and does not say: it says the votes are unlikely
 * to be an even three-way split. It does not prove that the leading line beats
 * the runner-up, and it says nothing about people who never got the link.
 */

import { LINE_IDS, type LineId, type Tally } from './whichline'

/** Below this many votes the test is not run. Each line then expects 10. */
export const MIN_VOTES_FOR_TEST = 30

export const SIGNIFICANCE_LEVEL = 0.05

export interface Reading {
  total: number
  /** The line or lines with the most votes. Empty when there are no votes. */
  leaders: LineId[]
  kind: 'no-votes' | 'too-few' | 'could-be-chance' | 'uneven'
  /** Null when the test was not run. */
  pValue: number | null
}

/**
 * Chi-square statistic and p-value for "all three lines are equally likely".
 * With three categories there are 2 degrees of freedom, and for 2 degrees of
 * freedom the p-value has an exact form: p = exp(-chiSquare / 2).
 */
export function chiSquareEvenSplit(counts: Tally): { chiSquare: number; pValue: number } {
  const total = counts.a + counts.b + counts.c
  if (total === 0) return { chiSquare: 0, pValue: 1 }
  const expected = total / LINE_IDS.length
  let chiSquare = 0
  for (const id of LINE_IDS) chiSquare += (counts[id] - expected) ** 2 / expected
  return { chiSquare, pValue: Math.exp(-chiSquare / 2) }
}

export function readResult(counts: Tally): Reading {
  const total = counts.a + counts.b + counts.c
  if (total === 0) return { total, leaders: [], kind: 'no-votes', pValue: null }

  const most = Math.max(counts.a, counts.b, counts.c)
  const leaders = LINE_IDS.filter((id) => counts[id] === most)

  if (total < MIN_VOTES_FOR_TEST) return { total, leaders, kind: 'too-few', pValue: null }

  const { pValue } = chiSquareEvenSplit(counts)
  const kind = pValue < SIGNIFICANCE_LEVEL ? 'uneven' : 'could-be-chance'
  return { total, leaders, kind, pValue }
}

export function formatPValue(pValue: number): string {
  return pValue < 0.001 ? 'p < 0.001' : `p = ${pValue.toFixed(3)}`
}

/** One or two plain sentences for the results page and the email. */
export function describeReading(reading: Reading): string {
  switch (reading.kind) {
    case 'no-votes':
      return 'No votes yet.'
    case 'too-few':
      return `${reading.total} of ${MIN_VOTES_FOR_TEST} votes. Too few to tell the lines apart yet.`
    case 'could-be-chance':
      return `With ${reading.total} votes, a split like this could easily be chance (${formatPValue(reading.pValue ?? 1)}). No line is clearly ahead.`
    case 'uneven':
      return `With ${reading.total} votes, this split is unlikely to be chance (${formatPValue(reading.pValue ?? 0)}). The votes are not spread evenly across the three lines.`
  }
}
