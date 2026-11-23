/**
 * Server actions — functions that run on the server, at POST /api/actions/<name>.
 *
 * The platform verifies the caller's sign-in before an action runs, so every
 * action here has a real `userId`. Actions bypass the collection permissions
 * (RBAC), so each one must check for itself that the caller is allowed to do
 * what it asks. Paid integration calls are billed to the app owner, which is
 * why each paid action first spends from the caller's daily allowance.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  AI_MODEL,
  DAILY_LIMITS,
  DRAFT_MAX_TOKENS,
  MAX_SOURCE_CHARS,
  MIN_SOURCE_CHARS,
  type MeteredAction,
} from '../config'
import { DRAFT_SYSTEM_PROMPT, buildDraftPrompt, cleanHttpUrl, parseDraftLines } from '../lib/draft'
import {
  MAX_SOURCE_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  type DraftResult,
} from '../lib/whichline'

/** The parts of the firecrawl/scrape response this app reads. */
interface ScrapeResponse {
  data?: { markdown?: unknown; metadata?: { title?: unknown } }
}

/** The parts of the anthropic/chat-completion response this app reads. */
interface ChatResponse {
  content?: { type?: unknown; text?: unknown }[]
  usage?: {
    input_tokens?: unknown
    output_tokens?: unknown
    output_tokens_details?: { thinking_tokens?: unknown }
  }
  costUsd?: unknown
}

const fail = (error: string): ActionResult => ({ success: false, error })

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Records one use of a paid action for this user today. Returns a failure when
 * the user is already at the limit, and null when they may go ahead.
 */
async function spendDailyAllowance(
  tools: ActionTools,
  userId: string,
  action: MeteredAction,
): Promise<ActionResult | null> {
  const limit = DAILY_LIMITS[action]
  const day = new Date().toISOString().slice(0, 10) // UTC, 'YYYY-MM-DD'

  const used = await tools.query('usage', { where: { userId, day, action }, limit })
  if (!used.success) return fail('Could not check your daily limit. Please try again.')
  if (used.data.records.length >= limit) {
    return fail(`You have reached today's limit of ${limit}. It resets at midnight UTC.`)
  }

  const logged = await tools.create('usage', { userId, day, action })
  if (!logged.success) return fail('Could not record this request. Please try again.')
  return null
}

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Draft three positioning lines from a web address, a description, or both.
   * Nothing is saved here: the lines go back to the form for the user to edit.
   */
  draftLines: async ({ userId, params, tools }) => {
    const description = asText(params.description).trim().slice(0, MAX_SOURCE_TEXT_LENGTH)
    const rawUrl = asText(params.url).trim()

    let url: string | null = null
    if (rawUrl !== '') {
      url = cleanHttpUrl(rawUrl, MAX_URL_LENGTH)
      if (url === null) {
        return fail('That does not look like a web address. It should start with http:// or https://.')
      }
    }
    if (url === null && description.length < MIN_SOURCE_CHARS) {
      return fail(
        `Paste a web address, or describe the product in at least ${MIN_SOURCE_CHARS} characters.`,
      )
    }

    // Spend the allowance before any paid call, so a failing page still counts.
    const overLimit = await spendDailyAllowance(tools, userId, 'draft')
    if (overLimit) return overLimit

    let pageText = ''
    let pageTitle = ''
    if (url !== null) {
      const page = await tools.integration<ScrapeResponse>('firecrawl/scrape', {
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      })
      if (!page.success) {
        return fail(`Could not read that page (${page.error}). You can paste a description instead.`)
      }
      pageText = asText(page.data.data?.markdown)
      pageTitle = asText(page.data.data?.metadata?.title)
    }

    const source = [description, pageText]
      .filter((part) => part !== '')
      .join('\n\n')
      .slice(0, MAX_SOURCE_CHARS)
    if (source.length < MIN_SOURCE_CHARS) {
      return fail('There was not enough text on that page to work with. Paste a description instead.')
    }

    const reply = await tools.integration<ChatResponse>('anthropic/chat-completion', {
      model: AI_MODEL,
      max_tokens: DRAFT_MAX_TOKENS,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildDraftPrompt(source) }],
    })
    if (!reply.success) return fail(`The AI call failed (${reply.error}). Please try again.`)

    // Token counts and cost only, never the page text or the reply: enough to
    // see in the logs what a draft really costs.
    console.info(
      '[draftLines] usage',
      JSON.stringify({
        input: reply.data.usage?.input_tokens,
        output: reply.data.usage?.output_tokens,
        thinking: reply.data.usage?.output_tokens_details?.thinking_tokens,
        costUsd: reply.data.costUsd,
      }),
    )

    const replyText = asText(reply.data.content?.find((block) => block.type === 'text')?.text)
    const lines = parseDraftLines(replyText)
    if (lines === null) {
      return fail('The AI reply was not in the expected format. Please try again.')
    }

    const result: DraftResult = {
      lines,
      title: pageTitle.trim().slice(0, MAX_TITLE_LENGTH),
      sourceUrl: url ?? '',
      sourceText: source.slice(0, MAX_SOURCE_TEXT_LENGTH),
    }
    return { success: true, data: result }
  },
}
