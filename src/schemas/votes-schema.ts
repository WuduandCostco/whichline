/**
 * votes — one row per vote on a test.
 *
 * Voting needs no sign-in, so the signed-out role ("viewer") may create a row.
 * Nobody may change or delete a vote afterwards, which keeps the count honest.
 *
 * Votes are readable by everyone. That is a deliberate tradeoff: the page hides
 * the count until you have voted, but the server does not enforce it. See the
 * README, "Main tradeoff".
 *
 * One vote per browser: a signed-out visitor gets a new anonymous id on every
 * connection, so the server-side identity cannot dedupe them. The page stores a
 * random voterKey in the browser instead, and `uniqueOn` refuses a second row
 * with the same (testId, voterKey).
 */

import type { CollectionSchema } from 'deepspace/schema'

// The only columns a caller may send. Anything else in the payload is refused.
const VOTE_FIELDS = ['testId', 'lineId', 'voterKey', 'reason', 'shownOrder']

export const votesSchema: CollectionSchema = {
  name: 'votes',
  uniqueOn: ['testId', 'voterKey'],
  columns: [
    { name: 'testId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    // 'a' | 'b' | 'c' — matches the id of a line on the test.
    { name: 'lineId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'voterKey', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'reason', storage: 'text', interpretation: 'plain', default: '', maxLength: 280 },
    // The order this visitor saw the lines in, e.g. "b,c,a". Lets us check
    // later whether the first position gets more votes.
    { name: 'shownOrder', storage: 'text', interpretation: 'plain', default: '', maxLength: 20 },
  ],
  permissions: {
    viewer: { read: true, create: true, update: false, delete: false, writableFields: VOTE_FIELDS },
    member: { read: true, create: true, update: false, delete: false, writableFields: VOTE_FIELDS },
    admin: { read: true, create: true, update: false, delete: true, writableFields: VOTE_FIELDS },
  },
}
