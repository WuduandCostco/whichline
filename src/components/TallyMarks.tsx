/**
 * Votes drawn as hand tally marks, in groups of five.
 *
 * Used while a test has fewer votes than the statistical test needs: the count
 * is still small enough to keep by hand, and it should look that way. Once
 * there are enough votes the results switch to bars (see the results page).
 *
 * Decorative: the number is always written next to it.
 */

const GROUP_SIZE = 5
const STROKE_GAP = 7
/** A slight lean per stroke, so the marks read as drawn rather than printed. */
const LEAN = [0.7, -0.5, 0.6, -0.8]

export function TallyMarks({ count }: { count: number }) {
  if (count <= 0) return null
  const fullGroups = Math.floor(count / GROUP_SIZE)
  const rest = count % GROUP_SIZE
  return (
    <span aria-hidden="true" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {Array.from({ length: fullGroups }, (_, index) => (
        <TallyGroup key={index} strokes={GROUP_SIZE} />
      ))}
      {rest > 0 && <TallyGroup strokes={rest} />}
    </span>
  )
}

function TallyGroup({ strokes }: { strokes: number }) {
  const upright = Math.min(strokes, GROUP_SIZE - 1)
  const crossed = strokes === GROUP_SIZE
  const width = crossed ? 32 : upright * STROKE_GAP + 4
  return (
    <svg
      width={width}
      height={22}
      viewBox={`0 0 ${width} 22`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      {Array.from({ length: upright }, (_, index) => {
        const x = 5 + index * STROKE_GAP
        return <line key={index} x1={x + LEAN[index]} y1={3} x2={x - LEAN[index]} y2={19} />
      })}
      {crossed && <line x1={1} y1={16} x2={31} y2={6} />}
    </svg>
  )
}
