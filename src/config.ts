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

/** Output cap for summarizing voters' reasons. Same reasoning allowance as drafting. */
export const SUMMARY_MAX_TOKENS = 3000

/** Votes are read from the server in pages of this size when a test is closed. */
export const VOTE_PAGE_SIZE = 200

/** A test with more votes than this is summarized from its first votes only. */
export const MAX_VOTES_READ = 2000

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

/**
 * The always-open demo test linked from the landing page. It asks about
 * whichline's own positioning lines. The slug exists in production only; on a
 * local dev server the link shows "Test not found".
 */
export const DEMO_TEST_SLUG = 'g34b4yhd'

export const SOURCE_URL = 'https://github.com/WuduandCostco/whichline'
