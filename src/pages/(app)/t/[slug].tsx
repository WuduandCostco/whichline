/**
 * /t/<slug> — the public page for one test.
 *
 * Lives under (app)/ but outside (protected)/: it can read live data, and it
 * does not require sign-in. Before voting a visitor sees the ballot; after
 * voting (or once the test is closed) the same page shows the live count.
 */

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useMutations, useQuery, type RecordData } from 'deepspace'
import { ChoiceDot } from '@/components/ChoiceDot'
import { TallyMarks } from '@/components/TallyMarks'
import { Button, Textarea, cn } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { MIN_VOTES_FOR_TEST, describeReading, readResult } from '@/lib/stats'
import {
  LINE_IDS,
  MAX_REASON_LENGTH,
  getVoterKey,
  hasVoted,
  rememberVoted,
  shuffled,
  tally,
  type CloseResult,
  type LineId,
  type TestData,
  type VoteData,
} from '@/lib/whichline'

export default function TestPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  // Look the test up by its slug column. Drafts are not readable by other
  // people, so a private test simply comes back as "not found".
  const { records, status, error } = useQuery<TestData>('tests', { where: { slug } })
  const test = records[0]

  if (status === 'loading') {
    return <PageMessage title="Loading…" />
  }
  if (status === 'error') {
    return <PageMessage title="Something went wrong" detail={error ?? 'Please reload the page.'} />
  }
  if (!test) {
    return (
      <PageMessage
        title="Test not found"
        detail="The link may be wrong, or the test has not been published."
      />
    )
  }
  return <TestView test={test} />
}

function TestView({ test }: { test: RecordData<TestData> }) {
  const { userId } = useAuth()
  const isOwner = userId !== null && userId === test.data.ownerId
  const [voted, setVoted] = useState(() => hasVoted(test.recordId))
  const closed = test.data.status === 'closed'

  // The owner sees the count without voting on their own test.
  const showResults = voted || closed || isOwner

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-[13px] text-muted-foreground">{test.data.title}</p>
        <h1 className="mt-2 text-[2.1rem] font-light leading-[1.1] tracking-[-0.02em]">
          Which line makes it clearest what this product is?
        </h1>

        {isOwner && <OwnerPanel test={test} />}

        {showResults ? (
          <Results test={test} />
        ) : (
          <Ballot test={test} onVoted={() => setVoted(true)} />
        )}
      </div>
    </div>
  )
}

function Ballot({ test, onVoted }: { test: RecordData<TestData>; onVoted: () => void }) {
  const { ready, createConfirmed } = useMutations<VoteData>('votes')
  // One random order per page load, so no line always benefits from being first.
  const order = useMemo(() => shuffled(LINE_IDS), [])
  const [choice, setChoice] = useState<LineId | null>(null)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const textOf = (id: LineId) => test.data.lines.find((line) => line.id === id)?.text ?? ''

  async function submit() {
    if (!choice) return
    setError(null)
    setSending(true)
    try {
      await createConfirmed({
        testId: test.recordId,
        lineId: choice,
        voterKey: getVoterKey(),
        reason: reason.trim(),
        shownOrder: order.join(','),
      })
      rememberVoted(test.recordId)
      onVoted()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      if (message.includes('Duplicate')) {
        // The server already has a vote from this browser for this test.
        rememberVoted(test.recordId)
        onVoted()
        return
      }
      setError(message)
      setSending(false)
    }
  }

  return (
    <div className="mt-8" data-testid="ballot">
      <div role="radiogroup" aria-label="Positioning lines" className="space-y-3">
        {order.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={choice === id}
            data-testid={`ballot-option-${id}`}
            onClick={() => setChoice(id)}
            className={cn(
              'flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-card/70 px-5 py-5 text-left transition-colors',
              'focus-visible:border-primary focus-visible:outline-none',
              choice === id
                ? 'border-primary shadow-[0_0_0_4px_rgba(167,139,250,0.08)]'
                : 'border-border hover:border-primary/50',
            )}
          >
            <ChoiceDot chosen={choice === id} className="mt-1" />
            <span className="text-[17px] leading-relaxed">{textOf(id)}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <label htmlFor="vote-reason" className="text-sm font-medium">
          Why that one? (optional)
        </label>
        <Textarea
          id="vote-reason"
          data-testid="ballot-reason"
          className="rounded-xl bg-card/70"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Your reason is shown publicly with the results. No sign-in needed.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button
          data-testid="ballot-submit"
          disabled={!ready || !choice}
          loading={sending}
          onClick={submit}
        >
          Submit my vote
        </Button>
        {!choice && <span className="text-sm text-muted-foreground">Pick one line first.</span>}
      </div>
    </div>
  )
}

function Results({ test }: { test: RecordData<TestData> }) {
  // This subscription only opens once the ballot is gone, so the count is not
  // loaded into the page before a visitor votes.
  const { records, status } = useQuery<VoteData>('votes', { where: { testId: test.recordId } })
  const closed = test.data.status === 'closed'
  const counts = tally(records, test.data.closedAt)
  const reading = readResult(counts)
  const total = reading.total
  // Hand tally while the count is too small to test; bars once it is not.
  const byHand = total < MIN_VOTES_FOR_TEST
  const voterKey = useMemo(() => getVoterKey(), [])
  const mine = records.find((vote) => vote.data.voterKey === voterKey)?.data.lineId
  const reasons = records.filter((vote) => vote.data.reason.trim() !== '')

  return (
    <div className="mt-8" data-testid="results">
      <p className="text-sm text-muted-foreground" data-testid="results-total">
        {status === 'loading'
          ? 'Loading votes…'
          : `${total} ${total === 1 ? 'vote' : 'votes'}${closed ? '. This test is closed.' : ' so far.'}`}
      </p>

      <ul className="mt-4 space-y-3">
        {LINE_IDS.map((id) => {
          const line = test.data.lines.find((candidate) => candidate.id === id)
          const count = counts[id]
          const share = total === 0 ? 0 : Math.round((count / total) * 100)
          const leads = total > 0 && reading.leaders.includes(id)
          return (
            <li
              key={id}
              data-testid={`results-line-${id}`}
              className={cn(
                'rounded-xl border bg-card/70 px-5 py-5',
                mine === id ? 'border-primary/60' : 'border-border',
              )}
            >
              <div className="flex items-start gap-3">
                <ChoiceDot chosen={mine === id} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] leading-relaxed">{line?.text}</p>
                  {line?.audience && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Written for {line.audience}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-3xl font-light tabular-nums leading-none">
                    {count}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {count === 1 ? 'vote' : 'votes'}, {share}%
                  </span>
                </p>
              </div>

              {/* With a hand tally, a line with no votes has nothing to draw. */}
              <div
                className={cn(
                  'mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 pl-[30px]',
                  byHand && count === 0 && 'hidden',
                )}
              >
                {byHand ? (
                  <span className="text-primary">
                    <TallyMarks count={count} />
                  </span>
                ) : (
                  <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#6e86ff]"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                )}
                {leads && (
                  // Two or three lines can share the lead; say so instead of
                  // labelling each of them "Most votes".
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                    {reading.leaders.length === 1 ? 'Most votes' : 'Tied for most'}
                  </span>
                )}
                {mine === id && (
                  <span className="rounded-full border border-primary/50 px-2.5 py-0.5 text-xs text-stamp">
                    Your pick
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 rounded-xl border border-border bg-card/70 p-5" data-testid="results-reading">
        <h2 className="text-sm font-semibold">How to read this</h2>
        <p className="mt-1 text-[15px]">{describeReading(reading)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a small-sample check, not an A/B test. The people who voted are the people who
          got the link.
        </p>
      </div>

      {closed && test.data.summary !== '' && (
        <div className="mt-6 rounded-xl border border-border bg-card/70 p-5" data-testid="results-summary">
          <h2 className="text-sm font-semibold">What voters said</h2>
          <p className="mt-1 text-[15px] leading-relaxed">{test.data.summary}</p>
          <p className="mt-2 text-sm text-muted-foreground">Summarized by AI from the reasons below.</p>
        </div>
      )}

      {reasons.length > 0 && (
        <div className="mt-8" data-testid="results-reasons">
          <h2 className="text-sm font-semibold">
            {reasons.length} {reasons.length === 1 ? 'reason' : 'reasons'}, in the voters&apos; words
          </h2>
          <ul className="mt-3 space-y-3">
            {reasons.slice(0, 50).map((vote) => (
              <li key={vote.recordId} className="border-l-2 border-primary/50 pl-3">
                <p className="text-[15px]">{vote.data.reason}</p>
                <p className="text-sm text-muted-foreground">
                  Picked line {LINE_IDS.indexOf(vote.data.lineId) + 1}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Shown only to the test's owner: the share link, and the control to close the test. */
function OwnerPanel({ test }: { test: RecordData<TestData> }) {
  const link = `${window.location.origin}/t/${test.data.slug}`
  const closed = test.data.status === 'closed'
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function closeTest() {
    setError(null)
    setClosing(true)
    const reply = await callAction<CloseResult>('closeTest', { testId: test.recordId })
    setClosing(false)
    setConfirming(false)
    if (!reply.success) {
      setError(reply.error)
      return
    }
    setNotice(
      reply.data.emailed
        ? 'Closed. The results were emailed to you.'
        : 'Closed. The email could not be sent, but the results are on this page.',
    )
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card/70 p-5" data-testid="owner-panel">
      <p className="text-sm font-semibold">
        {closed ? 'This is your test. It is closed.' : 'This is your test. Share this link to collect votes.'}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-[13px] text-muted-foreground">
          {link}
        </span>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>

      {!closed && !confirming && (
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          data-testid="close-test"
          onClick={() => setConfirming(true)}
        >
          Close test and email me the results
        </Button>
      )}

      {!closed && confirming && (
        <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
          <p className="text-sm">
            Closing stops the count and cannot be undone. The reasons are summarized by AI and the
            results are emailed to your sign-in address.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" data-testid="close-test-confirm" loading={closing} onClick={closeTest}>
              {closing ? 'Closing…' : 'Close the test'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={closing}
              onClick={() => setConfirming(false)}
            >
              Keep it open
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <p role="status" data-testid="close-notice" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function PageMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-20 text-center text-foreground">
      <h1 className="text-xl font-semibold">{title}</h1>
      {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      <Link to="/" className="mt-4 text-sm underline underline-offset-4">
        Back to whichline
      </Link>
    </div>
  )
}
