/**
 * whichline's own end-to-end checks: the rules the server has to enforce even
 * when someone works around the page.
 *
 *   1. Paid actions refuse a caller who is not signed in.
 *   2. One browser gets one vote per test, however many times it submits.
 *   3. Only the person who created a test can close it.
 *
 * These run against the local dev server and its local data, never against
 * production. None of them reaches a paid integration: the refusals under
 * test all happen before any AI, scrape or email call.
 *
 * Tests 2 and 3 sign in with test accounts. Create two once per machine:
 *   npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length

const VOTED_KEY_PREFIX = 'whichline:voted:'

/** Publish a test by filling the form by hand (no AI draft, so no cost). Returns its path. */
async function publishTest(page: Page): Promise<string> {
  await page.goto('/new')
  await page.getByTestId('new-test-title').fill('Spec run')
  for (const id of ['a', 'b', 'c']) {
    await page.getByTestId(`new-test-line-${id}`).fill(`Line ${id} for the spec run.`)
    await page.getByTestId(`new-test-audience-${id}`).fill(`Audience ${id}`)
  }
  await page.getByTestId('new-test-publish').click()
  await page.waitForURL(/\/t\/[a-z0-9]+$/, { timeout: 15_000 })
  await expect(page.getByTestId('owner-panel')).toBeVisible({ timeout: 15_000 })
  return new URL(page.url()).pathname
}

/** Pick a line and submit, then wait for the results to replace the ballot. */
async function vote(page: Page, lineId: 'a' | 'b' | 'c') {
  await expect(page.getByTestId('ballot')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId(`ballot-option-${lineId}`).click()
  await page.getByTestId('ballot-submit').click()
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 })
}

/** Make this browser forget that it voted, while keeping the same voter key. */
async function forgetVoted(page: Page) {
  await page.evaluate((prefix) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key)
    }
  }, VOTED_KEY_PREFIX)
}

test('paid actions refuse a caller who is not signed in', async ({ request }) => {
  // Empty bodies on purpose: even if the sign-in check were missing, neither
  // call could get as far as spending anything.
  const draft = await request.post('/api/actions/draftLines', { data: {} })
  expect(draft.status()).toBe(401)

  const close = await request.post('/api/actions/closeTest', { data: {} })
  expect(close.status()).toBe(401)
})

test.describe('with test accounts', () => {
  test.skip(
    usableTestAccounts < 2,
    `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
      '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin`.',
  )

  test('the server refuses a second vote from the same browser', async ({ users, browser, baseURL }) => {
    const [owner] = await users(1)
    const path = await publishTest(owner.page)

    // A visitor who is not signed in, in a browser of their own.
    const visitorContext = await browser.newContext({ baseURL })
    const visitor = await visitorContext.newPage()
    try {
      await visitor.goto(path)
      // Blind until you vote: the ballot is there, the count is not.
      await expect(visitor.getByTestId('ballot')).toBeVisible({ timeout: 15_000 })
      await expect(visitor.getByTestId('results')).toHaveCount(0)

      await vote(visitor, 'a')
      await expect(visitor.getByTestId('results-total')).toHaveText('1 vote so far.')

      // Work around the page: the ballot comes back, the voter key is the same.
      await forgetVoted(visitor)
      await visitor.reload()
      await vote(visitor, 'b')

      // The second vote was refused: still one vote, still on line a.
      await visitor.waitForTimeout(1_000)
      await expect(visitor.getByTestId('results-total')).toHaveText('1 vote so far.')
      await expect(visitor.getByTestId('results-line-a')).toContainText('vote, 100%')
      await expect(visitor.getByTestId('results-line-b')).toContainText('votes, 0%')

      // The owner's live count agrees.
      await expect(owner.page.getByTestId('results-total')).toHaveText('1 vote so far.')
    } finally {
      await visitorContext.close()
    }
  })

  test('only the person who created a test can close it', async ({ users }) => {
    const [owner, other] = await users(2)
    const path = await publishTest(owner.page)

    // The other account sees a ballot and no owner controls.
    await other.page.goto(path)
    await expect(other.page.getByTestId('ballot')).toBeVisible({ timeout: 15_000 })
    await expect(other.page.getByTestId('owner-panel')).toHaveCount(0)

    // Voting stores "voted:<test id>" in this browser. That is how the spec
    // learns the test's record id, the same id the close action expects.
    await forgetVoted(other.page)
    await other.page.reload()
    await vote(other.page, 'a')
    const testId = await other.page.evaluate((prefix) => {
      const key = Object.keys(window.localStorage).find((name) => name.startsWith(prefix))
      return key ? key.slice(prefix.length) : ''
    }, VOTED_KEY_PREFIX)
    expect(testId).not.toBe('')

    // Skip the page and call the action directly, signed in as the other
    // account. These are the same two requests src/lib/actions.ts makes.
    const reply = await other.page.evaluate(async (id) => {
      const tokenResponse = await fetch('/api/auth/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const { token } = (await tokenResponse.json()) as { token?: string }
      const response = await fetch('/api/actions/closeTest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testId: id }),
      })
      return (await response.json()) as { success?: boolean; error?: string }
    }, testId)

    expect(reply.success).toBe(false)
    expect(reply.error).toContain('Only the person who created this test can close it.')

    // And the test really is still open for its owner.
    await owner.page.reload()
    await expect(owner.page.getByTestId('close-test')).toBeVisible({ timeout: 15_000 })
    await expect(owner.page.getByTestId('results-total')).toHaveText('1 vote so far.')
  })
})
