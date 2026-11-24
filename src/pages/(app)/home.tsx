/**
 * /home — the signed-in user's own tests, newest first.
 *
 * The page is public (it sits under (app)/, not (protected)/) so a signed-out
 * visitor gets an explanation instead of a blank gate.
 */

import { Link } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Badge, buttonVariants } from '@/components/ui'
import type { TestData } from '@/lib/whichline'

export default function HomePage() {
  const { isSignedIn, userId } = useAuth()

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-[2.1rem] font-light leading-[1.1] tracking-[-0.02em]">Your tests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Write three lines for one product, share a link, and see which line people pick.
        </p>

        {isSignedIn && userId ? (
          <MyTests userId={userId} />
        ) : (
          <p className="mt-8 rounded-xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
            Sign in (top right) to create a test. Voting on someone else&apos;s test needs no
            sign-in.
          </p>
        )}
      </div>
    </div>
  )
}

function MyTests({ userId }: { userId: string }) {
  const { records, status, error } = useQuery<TestData>('tests', {
    where: { ownerId: userId },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  return (
    <div className="mt-8">
      <Link to="/new" data-testid="home-new-test" className={buttonVariants()}>
        New test
      </Link>

      {status === 'loading' && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {status === 'error' && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {error ?? 'Could not load your tests.'}
        </p>
      )}
      {status === 'ready' && records.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No tests yet. Create your first one.
        </p>
      )}

      <ul className="mt-6 space-y-3" data-testid="home-test-list">
        {records.map((test) => (
          <li key={test.recordId}>
            <Link
              to={`/t/${test.data.slug}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 p-4 transition-colors hover:border-primary/60"
            >
              <span className="min-w-0 truncate font-medium">{test.data.title}</span>
              <Badge variant={test.data.status === 'open' ? 'outline' : 'secondary'}>
                {test.data.status === 'open' ? 'Open' : 'Closed'}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
