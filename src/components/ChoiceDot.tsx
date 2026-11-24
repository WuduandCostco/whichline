import { cn } from '@/lib/utils'

/**
 * The round mark in front of a line: empty until the line is chosen.
 * Decorative: the surrounding control carries the accessible state.
 */
export function ChoiceDot({ chosen, className }: { chosen: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
        chosen ? 'border-primary shadow-[0_0_0_4px_rgba(167,139,250,0.12)]' : 'border-white/30',
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', chosen ? 'bg-primary' : 'bg-transparent')} />
    </span>
  )
}
