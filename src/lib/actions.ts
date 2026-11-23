/**
 * Calling a server action from the browser.
 *
 * Actions live in src/actions/index.ts and are served at POST /api/actions/<name>.
 * The platform verifies the Bearer token before the action runs.
 */

import { getAuthToken } from 'deepspace'

export type ActionReply<T> = { success: true; data: T } | { success: false; error: string }

export async function callAction<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionReply<T>> {
  try {
    const token = await getAuthToken()
    if (!token) return { success: false, error: 'Please sign in first.' }

    const response = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    const body: unknown = await response.json().catch(() => null)

    if (typeof body === 'object' && body !== null) {
      const reply = body as { success?: unknown; data?: unknown; error?: unknown }
      if (reply.success === true) return { success: true, data: reply.data as T }
      if (typeof reply.error === 'string') return { success: false, error: reply.error }
    }
    return { success: false, error: `The request failed (${response.status}). Please try again.` }
  } catch {
    return { success: false, error: 'Network error. Check your connection and try again.' }
  }
}
