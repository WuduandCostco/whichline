/**
 * Tunables for the paid parts of the app, in one place.
 *
 * Every integration call here is billed to the app owner, so each one has a
 * small, explicit budget.
 */

/**
 * The model is always named explicitly. The anthropic/chat-completion
 * integration defaults to the most expensive model when `model` is omitted.
 */
export const AI_MODEL = 'claude-haiku-5-5'

/**
 * Output cap for drafting three short lines.
 *
 * The cap covers the model's private reasoning as well as the visible answer.
 * The answer itself is about 200 tokens, but with a real web page as input the
 * model reasoned through a 500-token cap and returned nothing. 3000 leaves room
 * for both; we are billed for what is used, not for the cap.
 */
export const DRAFT_MAX_TOKENS = 3000

/** How much page or description text is sent to the model. */
export const MAX_SOURCE_CHARS = 6000

/** The least text we are willing to draft from. */
export const MIN_SOURCE_CHARS = 40

/** Per signed-in user, per UTC day. */
export const DAILY_LIMITS = {
  draft: 10,
  close: 10,
} as const

export type MeteredAction = keyof typeof DAILY_LIMITS
