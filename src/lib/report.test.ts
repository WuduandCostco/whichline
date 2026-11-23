import { describe, expect, it } from 'vitest'
import { buildReportEmail, buildSummaryPrompt, cleanSummary } from './report'
import type { Line } from './whichline'

const lines: Line[] = [
  { id: 'a', text: 'Turn your notes into quizzes.', audience: 'First-year students' },
  { id: 'b', text: 'See which topics you are weak on.', audience: 'Pre-med students' },
  { id: 'c', text: 'Get a study plan from your own notes.', audience: 'Note takers' },
]

describe('buildSummaryPrompt', () => {
  it('returns null when nobody wrote a reason, so no AI call is made', () => {
    expect(buildSummaryPrompt(lines, { a: 2, b: 1, c: 0 }, [])).toBeNull()
    expect(buildSummaryPrompt(lines, { a: 1, b: 0, c: 0 }, [{ lineId: 'a', reason: '   ' }])).toBeNull()
  })

  it('lists the lines with counts and wraps the reasons in <reasons> tags', () => {
    const prompt = buildSummaryPrompt(lines, { a: 2, b: 1, c: 0 }, [
      { lineId: 'a', reason: 'Clear and short' },
      { lineId: 'b', reason: '' },
    ])
    expect(prompt).toContain('Line 1 (2 votes): Turn your notes into quizzes.')
    expect(prompt).toContain('<reasons>\n- Chose line 1: Clear and short\n</reasons>')
    expect(prompt).not.toContain('Chose line 2')
  })
})

describe('cleanSummary', () => {
  it('trims and caps the length', () => {
    expect(cleanSummary('  ok  ')).toBe('ok')
    expect(cleanSummary('x'.repeat(2000))).toHaveLength(800)
  })
})

describe('buildReportEmail', () => {
  it('says there are too few votes rather than naming a winner', () => {
    const { subject, text } = buildReportEmail({
      title: 'StudyMate headline',
      lines,
      counts: { a: 6, b: 4, c: 2 },
      summary: 'People liked the short one.',
      link: 'https://whichline.app.space/t/abc',
    })
    expect(subject).toBe('whichline results: StudyMate headline')
    expect(text).toContain('12 of 30 votes. Too few to tell the lines apart yet.')
    expect(text).toContain('6 votes (50%)  <- most votes')
    expect(text).toContain('People liked the short one.')
    expect(text).toContain('https://whichline.app.space/t/abc')
  })

  it('labels a tie as a tie', () => {
    const { text } = buildReportEmail({
      title: 'Tie',
      lines,
      counts: { a: 1, b: 1, c: 0 },
      summary: '',
      link: 'https://whichline.app.space/t/abc',
    })
    expect(text).toContain('1 vote (50%)  <- tied for most')
    expect(text).not.toContain('<- most votes')
  })

  it('handles a test with no votes and no summary', () => {
    const { text } = buildReportEmail({
      title: 'Empty',
      lines,
      counts: { a: 0, b: 0, c: 0 },
      summary: '',
      link: 'https://whichline.app.space/t/abc',
    })
    expect(text).toContain('No votes yet.')
    expect(text).toContain('0 votes (0%)')
    expect(text).not.toContain('most votes')
    expect(text).toContain('No reasons were written')
  })
})
