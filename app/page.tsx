import { ButtonLink } from '@/components/ui/button';
import { LiveDemo } from '@/components/landing/live-demo';
import { AtsScrubberSection, ScoreAnatomySection, EnginesSection } from '@/components/landing/sections';
import { CATEGORY_META, type CategoryId } from '@/lib/score/types';
import { IconArrowRight } from '@/components/ui/icons';

const weights = (Object.keys(CATEGORY_META) as CategoryId[]).sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order);

export default function LandingPage() {
  return (
    <>
      <section className="container-x grid grid-cols-1 items-start gap-10 pb-12 pt-10 lg:grid-cols-12 lg:pt-16" aria-labelledby="hero-heading">
        <div className="lg:col-span-5 lg:pt-6">
          <p className="t-label">Applicant tracking system simulator</p>
          <h1 id="hero-heading" className="t-display mt-4 text-3xl text-fg sm:text-4xl">
            See your resume the way the machine reads it.
          </h1>
          <p className="mt-5 max-w-md text-md text-fg-1">
            Drop a PDF or DOCX. Get an honest score, a line-by-line teardown that quotes your own words with exact point costs, and a rewrite that only uses facts you already wrote — landing between 89 and 99.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink href="/upload" variant="primary" size="lg">
              Scan a resume <IconArrowRight />
            </ButtonLink>
            <a href="#anatomy-heading" className="hit rounded-r1 text-sm text-fg-1 underline-offset-4 hover:text-fg hover:underline">
              How the score is built
            </a>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3" aria-label="Category weights">
            {weights.map((id) => (
              <div key={id} className="readout">
                <dt className="t-label truncate">{CATEGORY_META[id].label}</dt>
                <dd className="num mt-1 text-md leading-none text-fg">
                  {CATEGORY_META[id].weight}
                  <span className="ml-0.5 text-xs text-fg-2">pts</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-fg-2">No signup. Nothing kept past seven days unless you save a version.</p>
        </div>
        <div className="lg:col-span-7">
          <LiveDemo />
        </div>
      </section>
      <AtsScrubberSection />
      <ScoreAnatomySection />
      <EnginesSection />
      <footer className="border-t border-line">
        <div className="container-x flex flex-col gap-3 py-8 text-xs text-fg-2 sm:flex-row sm:items-center sm:justify-between">
          <p>ATScope · deterministic scoring, truthful rewrites. Files are parsed in memory and expire after seven days.</p>
          <p className="num">Parse 25 · Keywords 25 · Impact 20 · Structure 15 · Writing 10 · Contact 5</p>
        </div>
      </footer>
    </>
  );
}
