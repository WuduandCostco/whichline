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
import { Button, Textarea, cn } from '@/components/ui'
import {
  LINE_IDS,
  MAX_REASON_LENGTH,
  getVoterKey,
  hasVoted,
  rememberVoted,
  shuffled,
  tally,
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
        <p className="text-sm text-muted-foreground">{test.data.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Which line makes it clearest what this product is?
        </h1>

        {isOwner && <ShareBox slug={test.data.slug} />}

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
              'w-full rounded-lg border p-4 text-left text-base transition-colors',
              choice === id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50',
            )}
          >
            {textOf(id)}
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
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your reason is shown publicly with the results. No sign-in needed.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        className="mt-6"
        data-testid="ballot-submit"
        disabled={!ready || !choice}
        loading={sending}
        onClick={submit}
      >
        Submit my vote
      </Button>
    </div>
  )
}

function Results({ test }: { test: RecordData<TestData> }) {
  // This subscription only opens once the ballot is gone, so the count is not
  // loaded into the page before a visitor votes.
  const { records, status } = useQuery<VoteData>('votes', { where: { testId: test.recordId } })
  const counts = tally(records)
  const total = counts.a + counts.b + counts.c
  const voterKey = useMemo(() => getVoterKey(), [])
  const mine = records.find((vote) => vote.data.voterKey === voterKey)?.data.lineId

  return (
    <div className="mt-8" data-testid="results">
      <p className="text-sm text-muted-foreground" data-testid="results-total">
        {status === 'loading' ? 'Loading votes…' : `${total} ${total === 1 ? 'vote' : 'votes'} so far`}
        {test.data.status === 'closed' && ' · This test is closed.'}
      </p>

      <ul className="mt-4 space-y-3">
        {LINE_IDS.map((id) => {
          const line = test.data.lines.find((candidate) => candidate.id === id)
          const count = counts[id]
          const share = total === 0 ? 0 : Math.round((count / total) * 100)
          return (
            <li
              key={id}
              data-testid={`results-line-${id}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-base">{line?.text}</p>
              {line?.audience && (
                <p className="mt-1 text-xs text-muted-foreground">Written for: {line.audience}</p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {count} {count === 1 ? 'vote' : 'votes'} · {share}%
                {mine === id && ' · your pick'}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        This is a small-sample check, not an A/B test. The people who voted are the people who
        got the link.
      </p>
    </div>
  )
}

function ShareBox({ slug }: { slug: string }) {
  const link = `${window.location.origin}/t/${slug}`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4" data-testid="share-box">
      <p className="text-sm font-medium">This is your test. Share this link to collect votes:</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-sm">{link}</code>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

function PageMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-20 text-center text-foreground">
      <h1 className="text-xl font-semibold">{title}</h1>
      {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      <Link to="/home" className="mt-4 text-sm text-muted-foreground underline underline-offset-4">
        Back to whichline
      </Link>
    </div>
  )
}
