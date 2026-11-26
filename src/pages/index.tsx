/**
 * Landing page — a static page (no auth call, no realtime connection), so it
 * is prerendered to plain HTML at build. Keep it renderable without a browser:
 * no window/document during render. `<Seo>` comes first and reads src/seo.ts.
 *
 * Its job: say what whichline does in one screen, and let a visitor vote on a
 * live test without signing in.
 */

import { Link } from 'react-router-dom'
import { ChoiceDot } from '../components/ChoiceDot'
import { Seo } from '../components/Seo'
import { buttonVariants } from '../components/ui/Button'
import { DEMO_TEST_SLUG, SOURCE_URL } from '../config'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

/** The three lines on the live demo test. They describe whichline itself. */
const DEMO_LINES = [
  "Paste your product's link, get three ways to describe it, and let real people pick the clearest one.",
  'Find out which one-line pitch people actually understand before you put it on your homepage.',
  'A five-minute blind vote that shows which description of your product makes sense to strangers.',
]

const STEPS = [
  {
    title: 'Describe your product, or paste its link',
    body: 'AI drafts three one-line descriptions from your description or from the page, each written for a different kind of person. Edit them however you like.',
  },
  {
    title: 'Share one link',
    body: 'Voters see only the three lines, in a random order. They pick one and can say why. Voting needs no account.',
  },
  {
    title: 'Read the result, with its limits',
    body: 'Votes are counted live. Under 30 votes you are told it is too early to call. When you close the test, the reasons are summarized and emailed to you.',
  },
]

export default function Landing() {
  const demoPath = `/t/${DEMO_TEST_SLUG}`

  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="mx-auto max-w-6xl px-6 pb-24">
        <header className="flex items-center justify-between py-6">
          <span className="text-[15px] font-medium tracking-tight">{APP_NAME}</span>
          <nav className="flex items-center gap-1 text-[13px] font-medium">
            <Link to="/home" className="rounded-lg px-3 py-1.5 text-white/60 hover:text-white">
              Your tests
            </Link>
            <a href={SOURCE_URL} className="rounded-lg px-3 py-1.5 text-white/60 hover:text-white">
              GitHub
            </a>
          </nav>
        </header>

        <main>
          <div className="grid items-start gap-12 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16">
            <div>
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <span aria-hidden="true" className="h-px w-8 bg-primary/60" />
                Blind message test
              </p>
              <h1 className="mt-5 text-[2.6rem] font-light leading-[1.03] tracking-[-0.025em] sm:text-[3.9rem]">
                Find out which sentence{' '}
                <span className="text-accent-gradient font-normal">explains your product.</span>
              </h1>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
                You know what you built. A stranger has one line to work it out. whichline drafts
                three versions of that line and lets people vote blind on the one they understand.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to={demoPath} data-testid="landing-demo" className={buttonVariants({ size: 'lg' })}>
                  Vote on the live ballot
                </Link>
                <Link
                  to="/new"
                  data-testid="landing-create"
                  className={buttonVariants({ variant: 'secondary', size: 'lg' })}
                >
                  Create a test
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-muted-foreground">
                Voting needs no sign-in. Creating a test does, because drafting uses paid AI calls.
              </p>
            </div>

            <section
              aria-labelledby="demo-heading"
              className="rounded-2xl border border-border bg-card/70 p-2 backdrop-blur"
            >
              <div className="px-4 pb-3 pt-4">
                <h2 id="demo-heading" className="text-[15px] font-semibold">
                  A live ballot about whichline itself
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Which line makes it clearest what this product is?
                </p>
              </div>
              <ul className="space-y-2">
                {DEMO_LINES.map((line) => (
                  <li key={line}>
                    <Link
                      to={demoPath}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-background/60 px-4 py-4 transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
                    >
                      <ChoiceDot chosen={false} className="mt-0.5 group-hover:border-primary" />
                      <span className="text-[15px] leading-relaxed">{line}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="px-4 pb-3 pt-4 text-[13px] text-muted-foreground">
                Pick a line to open the ballot. You see the count after you vote.
              </p>
            </section>
          </div>

          <section aria-labelledby="how-heading" className="mt-28 max-w-2xl">
            <h2 id="how-heading" className="text-3xl font-light tracking-tight">
              How it works
            </h2>
            <ol className="mt-8">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-5 pb-8 last:pb-0">
                  {/* The line that joins one step to the next. */}
                  {index < STEPS.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[17px] top-9 h-full w-px bg-border" />
                  )}
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-muted text-[15px] font-bold shadow-[0_0_0_4px_rgba(167,139,250,0.07)]">
                    {index + 1}
                  </span>
                  <div className="pt-1.5">
                    <h3 className="text-[15px] font-semibold">{step.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="limits-heading" className="mt-20 max-w-2xl">
            <h2 id="limits-heading" className="text-3xl font-light tracking-tight">
              What it will not tell you
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              This is a quick check, not an A/B test. The people who vote are the people you sent the
              link to, so the result says nothing about everyone else. And a lopsided count means the
              votes are not spread evenly across the three lines. It does not prove the leading line
              beats the runner-up.
            </p>
          </section>
        </main>

        <footer className="mt-24 border-t border-border pt-6 text-[13px] text-muted-foreground">
          Built on{' '}
          <a href="https://deep.space" className="text-foreground underline-offset-4 hover:underline">
            DeepSpace
          </a>
          . The code is on{' '}
          <a href={SOURCE_URL} className="text-foreground underline-offset-4 hover:underline">
            GitHub
          </a>
          .
        </footer>
      </div>
    </>
  )
}
