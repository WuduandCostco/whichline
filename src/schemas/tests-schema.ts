/**
 * tests — one message test: a product, three positioning lines, and its state.
 *
 * Who can do what:
 * - Signed-out visitors (role "viewer") can read a test only once it is public.
 * - Signed-in users ("member") can create tests and change or delete their own.
 * - Drafts stay private to their owner: `read: 'published'` means
 *   "the owner, or anyone when visibility === 'public'".
 */

import type { CollectionSchema } from 'deepspace/schema'

export const testsSchema: CollectionSchema = {
  name: 'tests',
  // The DO stamps ownerId with the verified caller, so a client cannot
  // create a test in someone else's name.
  ownerField: 'ownerId',
  // String form: a record is public when this column equals 'public'.
  visibilityField: 'visibility',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: 120 },
    { name: 'sourceUrl', storage: 'text', interpretation: 'plain', default: '', maxLength: 500 },
    { name: 'sourceText', storage: 'text', interpretation: 'plain', default: '', maxLength: 4000 },
    // Exactly three items: { id: 'a' | 'b' | 'c', text: string, audience: string }
    { name: 'lines', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['draft', 'open', 'closed'] },
      default: 'draft',
    },
    {
      name: 'visibility',
      storage: 'text',
      interpretation: { kind: 'select', options: ['private', 'public'] },
      default: 'private',
    },
    // Epoch milliseconds; 0 while the test is still open. Votes created after
    // this moment are ignored when counting.
    { name: 'closedAt', storage: 'number', interpretation: 'plain', default: 0 },
    // AI summary of the voters' reasons, written when the owner closes the test.
    { name: 'summary', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
  ],
  permissions: {
    viewer: { read: 'published', create: false, update: false, delete: false },
    member: { read: 'published', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: 'own', delete: true },
  },
}
