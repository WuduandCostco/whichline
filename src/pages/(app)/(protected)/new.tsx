/**
 * /new — create a test by typing three lines, then publish it.
 *
 * Lives under (protected)/, so only signed-in users reach it. AI drafting of
 * the lines is added later; this page is the manual path.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Button, Input, Textarea } from '@/components/ui'
import { LINE_IDS, randomId, type Line, type LineId, type NewTest } from '@/lib/whichline'

type LineDraft = { text: string; audience: string }

const emptyDrafts: Record<LineId, LineDraft> = {
  a: { text: '', audience: '' },
  b: { text: '', audience: '' },
  c: { text: '', audience: '' },
}

export default function NewTestPage() {
  const navigate = useNavigate()
  const { ready, createConfirmed } = useMutations<NewTest>('tests')

  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState(emptyDrafts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // All seven fields are required: the title, and a text and an audience for
  // each of the three lines.
  const complete =
    title.trim() !== '' &&
    LINE_IDS.every((id) => drafts[id].text.trim() !== '' && drafts[id].audience.trim() !== '')

  function updateDraft(id: LineId, patch: Partial<LineDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
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
        sourceUrl: '',
        sourceText: '',
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
          Write three lines that describe the same product for different people. Voters see
          only the lines, in a random order.
        </p>

        <div className="mt-8 space-y-2">
          <label htmlFor="test-title" className="text-sm font-medium">
            What are you testing?
          </label>
          <Input
            id="test-title"
            data-testid="new-test-title"
            value={title}
            maxLength={120}
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
                maxLength={200}
                rows={2}
                placeholder="One sentence a stranger would understand"
                onChange={(event) => updateDraft(id, { text: event.target.value })}
              />
              <Input
                aria-label={`Line ${index + 1} audience`}
                className="mt-3"
                value={drafts[id].audience}
                maxLength={80}
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
          {!complete && (
            <span className="text-sm text-muted-foreground">
              Fill in the title, all three lines, and who each line is for.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
