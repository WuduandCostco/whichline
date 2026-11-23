/**
 * usage — one row each time a signed-in user triggers a paid action.
 *
 * Only server actions write or read this collection (they bypass RBAC), so
 * every client role is denied. It backs the per-user daily limits in
 * src/config.ts.
 */

import type { CollectionSchema } from 'deepspace/schema'

const DENIED = { read: false, create: false, update: false, delete: false } as const

export const usageSchema: CollectionSchema = {
  name: 'usage',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    // UTC day, 'YYYY-MM-DD'.
    { name: 'day', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'action',
      storage: 'text',
      interpretation: { kind: 'select', options: ['draft', 'close'] },
      required: true,
      immutable: true,
    },
  ],
  permissions: {
    viewer: DENIED,
    member: DENIED,
    admin: { read: true, create: false, update: false, delete: true },
  },
}
