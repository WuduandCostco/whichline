/**
 * Shared types and small pure helpers for whichline.
 * No React and no DeepSpace calls in this file, so it is easy to unit test.
 */

export type LineId = 'a' | 'b' | 'c'

/** A test always has exactly three lines. */
export const LINE_IDS: readonly LineId[] = ['a', 'b', 'c']

export interface Line {
  id: LineId
  /** The positioning line voters read. */
  text: string
  /** Who the line was written for. Hidden from voters until they have voted. */
  audience: string
}

/** One row of the `tests` collection (see src/schemas/tests-schema.ts). */
export interface TestData {
  slug: string
  title: string
  sourceUrl: string
  sourceText: string
  lines: Line[]
  status: 'draft' | 'open' | 'closed'
  visibility: 'private' | 'public'
  closedAt: number
  summary: string
  ownerId: string
}

/** What the browser sends when creating a test. The server stamps ownerId. */
export type NewTest = Omit<TestData, 'ownerId'>

/** One row of the `votes` collection (see src/schemas/votes-schema.ts). */
export interface VoteData {
  testId: string
  lineId: LineId
  voterKey: string
  reason: string
  shownOrder: string
}

export const MAX_REASON_LENGTH = 280

// No look-alike characters (l/1, o/0), so a slug is easy to read aloud.
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** A random id made of `length` characters from ID_ALPHABET. */
export function randomId(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let id = ''
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length]
  return id
}

const VOTER_KEY_STORAGE = 'whichline:voterKey'
let fallbackVoterKey: string | null = null

/**
 * A random key that identifies this browser, created on first use.
 * It is what makes "one vote per browser" work: the votes collection refuses
 * a second row with the same (testId, voterKey).
 */
export function getVoterKey(): string {
  try {
    const saved = window.localStorage.getItem(VOTER_KEY_STORAGE)
    if (saved) return saved
    const fresh = randomId(24)
    window.localStorage.setItem(VOTER_KEY_STORAGE, fresh)
    return fresh
  } catch {
    // Storage can be blocked (strict privacy settings). Use a key that lasts
    // until the tab closes rather than failing the vote.
    fallbackVoterKey ??= randomId(24)
    return fallbackVoterKey
  }
}

const votedStorageKey = (testId: string) => `whichline:voted:${testId}`

/** Remember that this browser has voted on a test, so the page shows results. */
export function rememberVoted(testId: string): void {
  try {
    window.localStorage.setItem(votedStorageKey(testId), '1')
  } catch {
    // Not being able to remember only means the ballot is shown again; the
    // server still refuses a second vote.
  }
}

export function hasVoted(testId: string): boolean {
  try {
    return window.localStorage.getItem(votedStorageKey(testId)) === '1'
  } catch {
    return false
  }
}

/** A shuffled copy (Fisher-Yates). The input is not changed. */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export type Tally = Record<LineId, number>

/** Count votes per line. A vote for an unknown line id is ignored. */
export function tally(votes: readonly { data: VoteData }[]): Tally {
  const counts: Tally = { a: 0, b: 0, c: 0 }
  for (const vote of votes) {
    if (Object.hasOwn(counts, vote.data.lineId)) counts[vote.data.lineId] += 1
  }
  return counts
}
