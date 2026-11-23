/**
 * /new — create a test.
 *
 * Two ways to fill the form: let the AI draft three lines from a web address
 * or a description, or type them by hand. Either way the user can edit every
 * field before publishing. Lives under (protected)/, so only signed-in users
 * reach it.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Button, Input, Textarea } from '@/components/ui'
import { callAction } from '@/lib/actions'
import {
  LINE_IDS,
  MAX_AUDIENCE_LENGTH,
  MAX_LINE_LENGTH,
  MAX_SOURCE_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  randomId,
  type DraftResult,
  type Line,
  type LineId,
  type NewTest,
} from '@/lib/whichline'

type LineDraft = { text: string; audience: string }

const emptyDrafts: Record<LineId, LineDraft> = {
  a: { text: '', audience: '' },
  b: { text: '', audience: '' },
  c: { text: '', audience: '' },
}

export default function NewTestPage() {
  const navigate = useNavigate()
  const { ready, createConfirmed } = useMutations<NewTest>('tests')

  // What the AI drafts from.
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  // Kept so the published test records what its lines were drafted from.
  const [source, setSource] = useState({ url: '', text: '' })

  // The test itself.
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState(emptyDrafts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDraft = url.trim() !== '' || description.trim() !== ''

  // All seven fields are required: the title, and a text and an audience for
  // each of the three lines.
  const complete =
    title.trim() !== '' &&
    LINE_IDS.every((id) => drafts[id].text.trim() !== '' && drafts[id].audience.trim() !== '')

  function updateDraft(id: LineId, patch: Partial<LineDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  async function draftWithAi() {
    setDraftError(null)
    setDrafting(true)
    const reply = await callAction<DraftResult>('draftLines', { url, description })
    setDrafting(false)
    if (!reply.success) {
      setDraftError(reply.error)
      return
    }
    const next = { ...emptyDrafts }
    for (const line of reply.data.lines) {
      next[line.id] = { text: line.text, audience: line.audience }
    }
    setDrafts(next)
    setSource({ url: reply.data.sourceUrl, text: reply.data.sourceText })
    // Keep a title the user already typed.
    if (title.trim() === '' && reply.data.title !== '') setTitle(reply.data.title)
  }

  async function publish() {
    setError(null)
    setSaving(true)
    const slug = randomId(8)
    const lines: Line[] = LINE_IDS.map((id) => ({
      id,
      text: drafts[id].text.trim(),
      audience: drafts[id].audience.trim(),
    }))
    try {
      // Confirmed write: wait for the server before moving to the share page,
      // so we never send someone to a test that was refused.
      await createConfirmed({
        slug,
        title: title.trim(),
        sourceUrl: source.url,
        sourceText: source.text,
        lines,
        status: 'open',
        visibility: 'public',
        closedAt: 0,
        summary: '',
      })
      navigate(`/t/${slug}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish the test.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">New test</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Three lines that describe the same product for different people. Voters see only the
          lines, in a random order.
        </p>

        <section className="mt-8 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Start with a draft (optional)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste the product&apos;s web address, describe it, or both. You can edit everything
            afterwards.
          </p>
          <Input
            aria-label="Product web address"
            data-testid="draft-url"
            className="mt-3"
            type="url"
            value={url}
            maxLength={MAX_URL_LENGTH}
            placeholder="https://example.com"
            onChange={(event) => setUrl(event.target.value)}
          />
          <Textarea
            aria-label="Product description"
            data-testid="draft-description"
            className="mt-3"
            value={description}
            maxLength={MAX_SOURCE_TEXT_LENGTH}
            rows={3}
            placeholder="What the product does and who it is for"
            onChange={(event) => setDescription(event.target.value)}
          />
          {draftError && (
            <p role="alert" data-testid="draft-error" className="mt-3 text-sm text-destructive">
              {draftError}
            </p>
          )}
          <Button
            className="mt-3"
            variant="secondary"
            data-testid="draft-button"
            disabled={!canDraft}
            loading={drafting}
            onClick={draftWithAi}
          >
            {drafting ? 'Drafting…' : 'Draft three lines'}
          </Button>
        </section>

        <div className="mt-8 space-y-2">
          <label htmlFor="test-title" className="text-sm font-medium">
            What are you testing?
          </label>
          <Input
            id="test-title"
            data-testid="new-test-title"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="StudyMate homepage headline"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="mt-8 space-y-6">
          {LINE_IDS.map((id, index) => (
            <fieldset key={id} className="rounded-lg border border-border bg-card p-4">
              <legend className="px-1 text-sm font-medium">Line {index + 1}</legend>
              <Textarea
                aria-label={`Line ${index + 1} text`}
                data-testid={`new-test-line-${id}`}
                value={drafts[id].text}
                maxLength={MAX_LINE_LENGTH}
                rows={2}
                placeholder="One sentence a stranger would understand"
                onChange={(event) => updateDraft(id, { text: event.target.value })}
              />
              <Input
                aria-label={`Line ${index + 1} audience`}
                data-testid={`new-test-audience-${id}`}
                className="mt-3"
                value={drafts[id].audience}
                maxLength={MAX_AUDIENCE_LENGTH}
                placeholder="Who is this line for? (hidden from voters until they vote)"
                onChange={(event) => updateDraft(id, { audience: event.target.value })}
              />
            </fieldset>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-6 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center gap-3">
          <Button
            data-testid="new-test-publish"
            disabled={!ready || !complete}
            loading={saving}
            onClick={publish}
          >
            Publish and get the link
          </Button>
          {/* Say why the button is disabled, so a grey button is never a mystery. */}
          {!complete ? (
            <span className="text-sm text-muted-foreground">
              Fill in the title, all three lines, and who each line is for.
            </span>
          ) : (
            !ready && <span className="text-sm text-muted-foreground">Connecting…</span>
          )}
        </div>
      </div>
    </div>
  )
}
