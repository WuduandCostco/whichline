# whichline

Find out which sentence explains your product.

You write three one-line descriptions of the same product (or let AI draft
them from a description or a web address). You share one link. People vote
blind on the line that makes the product clearest to them, and can say why.
You see the count live, and when you close the test the reasons are summarized
and emailed to you.

- Live app: https://whichline.app.space
- A live ballot about whichline itself: https://whichline.app.space/t/g34b4yhd

Built on [DeepSpace](https://deep.space) as a five-day build exercise.

## How it works

1. **Create a test** (sign-in required). Type three lines and who each one is
   written for, or paste a description or a web address and let AI draft them.
   Everything stays editable.
2. **Share the link.** Voters need no account. They see only the three lines,
   in a random order, pick one, and can add a reason.
3. **Read the result.** The count updates live. Voters see it after they vote;
   the owner sees it all along. Closing the test stops the count, summarizes
   the reasons with AI, and emails the results to the owner.

## What it will not tell you

This is a quick check, not an A/B test, and the app says so on every result.

- Under 30 votes it reports "too few to tell the lines apart" and runs no test.
- From 30 votes it runs a chi-square goodness-of-fit test against an even
  three-way split. A small p-value only means the votes are not spread evenly.
  It does not prove the leading line beats the runner-up.
- The voters are whoever received the link, so the result says nothing about
  anyone else.
- The app never calls a line the winner. Labels say "Most votes" or "Tied for
  most".

## DeepSpace pieces used

| Piece | Where | Why |
| --- | --- | --- |
| Records with role-based permissions | `src/schemas/` | Three collections: `tests`, `votes`, `usage`. Ownership, public or private visibility, and "one vote per browser per test" (`uniqueOn`) are declared in the schema instead of being re-implemented. |
| Live queries | `src/pages/(app)/t/[slug].tsx` | The count updates on every open page without a reload. |
| Auth | `(app)/(protected)/` routes | Creating a test needs sign-in. Voting does not. |
| Server actions | `src/actions/index.ts` | The two paid flows (`draftLines`, `closeTest`) run on the server, behind sign-in. |
| Integration: `anthropic/chat-completion` | `draftLines`, `closeTest` | Drafts the three lines and summarizes voters' reasons. |
| Integration: `firecrawl/scrape` | `draftLines` | Reads the product page when a web address is given. |
| Integration: `email/send` | `closeTest` | Sends the owner the results. |

Not used, on purpose: Yjs documents, canvas, presence, cron, jobs, messaging.
None of them makes a three-line vote better. The scaffold's bindings for them
are still in `worker.ts` and `wrangler.toml`, untouched.

## The main tradeoff

**The vote is blind at the page level, not enforced by the server.**

Voters should not see the count before they vote. But voting is anonymous, and
an anonymous visitor gets a new throwaway identity on every connection, so the
server cannot tell who has already voted. To let people see the count after
voting, votes are readable by everyone, and the page simply does not load them
until the ballot is gone. Someone who reads the network traffic could see the
count early.

For a quick message check among people you sent a link to, that is an
acceptable price for voting with no account. The next step would be to make
votes readable by the owner only, and have the public page read a running
total that the server maintains.

## Guard rails around paid calls

Every integration call is billed to the app owner, so:

- Paid calls only happen inside server actions, and actions require sign-in.
- Each signed-in user gets 10 drafts and 10 closes per UTC day. The use is
  recorded before the paid call, so a failing page still counts.
- The model is always named (`claude-haiku-5-5`). The integration's default
  is the most expensive model.
- `closeTest` checks that the caller owns the test. Actions bypass collection
  permissions, so this check is the only thing protecting other people's tests.
- The results email goes to the caller's own sign-in address, never to an
  address taken from the request.
- Page text and voters' reasons are passed to the model as data, with an
  instruction not to follow anything written inside them.

Rough cost: a draft is about 0.6 credit, closing a test about 1.4 credits
(100 credits = $1).

## Known limits

- One vote per browser, not per person. Clearing site data or using a second
  browser gives a second vote.
- Reading a web address depends on the platform's scrape integration. When it
  cannot read the page, the app drafts from your description instead and says
  so. With no description, it asks for one. From November 23 to at least
  November 25, 2026 that integration answered every call with an out-of-credits
  error from its provider, so during that time drafting needed a description.
- The AI summary is instructed not to name a winner, but that is an
  instruction to a model, not a guarantee.
- A test with more than 2,000 votes is summarized from its first 2,000.
- Closing a test cannot be undone from the page. But owners may update their
  own rows, so a test's owner could change their own test record directly, for
  example reopen it or reword a line after votes came in. Nobody else can. I
  read this from the permission rules and have not tested it.
- English only.

## Run it locally

Needs Node 22.15+ or 24, npm 11.6+, and a DeepSpace account.

```sh
npm install
npx deepspace auth login
npx deepspace dev start      # http://localhost:5173
```

Local dev has its own database and its own sign-in, separate from production.
The demo link on the landing page points at a test that exists in production
only, so locally it shows "Test not found". AI, scrape and email calls made
from local dev are real and are billed.

## Tests

```sh
npm run type-check
npm run lint
npm run test:unit                                   # pure logic: parsing, statistics, email text
npx deepspace test run                              # scaffold smoke + API checks
npx deepspace test run tests/whichline.spec.ts      # server-side rules, see below
npx deepspace test run all                          # everything above in one go
```

`tests/whichline.spec.ts` checks the rules the server must enforce even when
someone works around the page: paid actions refuse a caller who is not signed
in, a second vote from the same browser is refused, and only a test's owner
can close it. The last two sign in with DeepSpace test accounts:

```sh
npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin
```

The test runner starts its own server on port 5173, so stop `dev start` first
or pass `--port 5174`.

## Deploy your own copy

`wrangler.toml` carries this app's id, so a copy needs an id of its own. You
need a DeepSpace account with a free app slot. A registered app holds a slot
even before its first deploy.

```sh
git clone https://github.com/WuduandCostco/whichline.git
cd whichline
npm install
npx deepspace auth login
npx deepspace app init --new-id     # registers a separate app with its own data
```

Then change `name` and `APP_NAME` in `wrangler.toml` to a name that is free
(the name becomes the web address), and deploy:

```sh
npx deepspace deploy                # ships to <name>.app.space
```

After the first deploy, create a test to use as the landing page demo, put its
slug in `DEMO_TEST_SLUG` in `src/config.ts`, and deploy again.

**How far this is verified.** I ran these steps from a fresh clone on my own
account. Cloning, installing and changing the name worked. `app init --new-id`
was refused with `app_quota_exceeded`, because my account's app quota was
already taken by the live app. So the deploy step is untested, and so is
running any of this from a different account.

## Where things are

```
src/schemas/            tests, votes, usage: columns and permissions
src/actions/index.ts    draftLines and closeTest (server side, paid)
src/lib/whichline.ts    shared types, voter key, shuffle, tally
src/lib/draft.ts        prompt and parser for the three drafted lines
src/lib/stats.ts        chi-square reading of the count
src/lib/report.ts       summary prompt and results email
src/config.ts           model, token caps, daily limits
src/pages/index.tsx                     landing page (static)
src/pages/(app)/t/[slug].tsx            ballot and results
src/pages/(app)/(protected)/new.tsx     create a test
src/pages/(app)/home.tsx                your tests
tests/whichline.spec.ts                 end-to-end checks of the server rules
```

The rest is the DeepSpace scaffold.
