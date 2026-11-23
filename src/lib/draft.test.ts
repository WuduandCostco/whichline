import { describe, expect, it } from 'vitest'
import { cleanHttpUrl, parseDraftLines } from './draft'

const three = [
  { audience: 'First-year students', line: 'Turn your notes into quizzes.' },
  { audience: 'Pre-med students', line: 'See which topics you are weak on.' },
  { audience: 'Note takers', line: 'Get a study plan from your own notes.' },
]

describe('parseDraftLines', () => {
  it('reads a plain JSON array and assigns ids a, b, c in order', () => {
    const lines = parseDraftLines(JSON.stringify(three))
    expect(lines).toEqual([
      { id: 'a', text: 'Turn your notes into quizzes.', audience: 'First-year students' },
      { id: 'b', text: 'See which topics you are weak on.', audience: 'Pre-med students' },
      { id: 'c', text: 'Get a study plan from your own notes.', audience: 'Note takers' },
    ])
  })

  it('reads JSON wrapped in a ```json code fence (what the model really returns)', () => {
    const reply = '```json\n' + JSON.stringify(three, null, 2) + '\n```'
    expect(parseDraftLines(reply)?.map((line) => line.id)).toEqual(['a', 'b', 'c'])
  })

  it('reads JSON with a sentence before and after it', () => {
    const reply = `Here are the lines:\n${JSON.stringify(three)}\nHope this helps.`
    expect(parseDraftLines(reply)).toHaveLength(3)
  })

  it('refuses two items or four items', () => {
    expect(parseDraftLines(JSON.stringify(three.slice(0, 2)))).toBeNull()
    expect(parseDraftLines(JSON.stringify([...three, three[0]]))).toBeNull()
  })

  it('refuses an item with a missing or empty field', () => {
    expect(parseDraftLines(JSON.stringify([three[0], three[1], { audience: 'X' }]))).toBeNull()
    expect(parseDraftLines(JSON.stringify([three[0], three[1], { audience: ' ', line: 'Y' }]))).toBeNull()
  })

  it('refuses a reply with no JSON array, or broken JSON', () => {
    expect(parseDraftLines('Sorry, I cannot help with that.')).toBeNull()
    expect(parseDraftLines('[{"audience": "A", "line": ')).toBeNull()
  })

  it('cuts over-long text to the form limits', () => {
    const long = [{ audience: 'A'.repeat(300), line: 'L'.repeat(900) }, three[1], three[2]]
    const lines = parseDraftLines(JSON.stringify(long))
    expect(lines?.[0].text).toHaveLength(200)
    expect(lines?.[0].audience).toHaveLength(80)
  })
})

describe('cleanHttpUrl', () => {
  it('accepts http and https', () => {
    expect(cleanHttpUrl(' https://example.com ', 500)).toBe('https://example.com/')
    expect(cleanHttpUrl('http://example.com/a?b=1', 500)).toBe('http://example.com/a?b=1')
  })

  it('refuses other schemes, non-URLs, and over-long input', () => {
    expect(cleanHttpUrl('javascript:alert(1)', 500)).toBeNull()
    expect(cleanHttpUrl('file:///etc/passwd', 500)).toBeNull()
    expect(cleanHttpUrl('example.com', 500)).toBeNull()
    expect(cleanHttpUrl('', 500)).toBeNull()
    expect(cleanHttpUrl('https://example.com/' + 'a'.repeat(600), 500)).toBeNull()
  })
})
