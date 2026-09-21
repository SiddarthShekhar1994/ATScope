'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ParsedResume } from '@/lib/parse/types';
import type { AnalysisEvent, Analysis } from '@/lib/schema/analysis';
import { reduceEvent, emptyAnalysis } from '@/lib/analysis/pipeline';
import { CATEGORY_META, type CategoryId } from '@/lib/score/types';
import { AtsView } from '@/components/report/ats-view';
import { EngineReadouts } from '@/components/report/engine-readouts';
import { FindingCard } from '@/components/report/finding-card';
import { ScoreRing } from '@/components/report/score-ring';
import { IconChevron } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { pick, SPRING_LAYOUT } from '@/styles/motion';

interface Demo {
  doc: ParsedResume;
  target: Analysis['target'];
  events: AnalysisEvent[];
}

function useDemo(): { demo: Demo | null; analysis: Analysis | null } {
  const [demo, setDemo] = useState<Demo | null>(null);
  useEffect(() => {
    let alive = true;
    import('@/lib/demo/sample.json').then((m) => alive && setDemo(m.default as unknown as Demo));
    return () => {
      alive = false;
    };
  }, []);
  const analysis = demo ? demo.events.reduce((s, e) => reduceEvent(s, e), emptyAnalysis(demo.doc, demo.target)) : null;
  return { demo, analysis };
}

/** Interactive before/after scrubber over the sample: the persuasive screen. */
export function AtsScrubberSection() {
  const { demo, analysis } = useDemo();
  return (
    <section className="container-x py-16 sm:py-24" aria-labelledby="ats-heading">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="t-label">The ATS view</p>
          <h2 id="ats-heading" className="t-display mt-3 text-2xl text-fg sm:text-3xl">
            Most people have never seen what the machine reads.
          </h2>
          <p className="mt-4 text-fg-1">Drag the divider. Left is the page as designed. Right is the same file after a position-sorting parser linearises it: two columns read straight across, the contact line in the header gone, the skill bars silent.</p>
          {analysis?.parseReport ? (
            <dl className="mt-6 grid grid-cols-3 gap-2">
              <Stat label="lines lost" value={String(demo?.doc.lines.filter((l) => l.source !== 'body' && l.source !== 'table').length ?? 0)} tone="bad" />
              <Stat label="scrambled" value={String(analysis.parseReport.atsLines.filter((a) => a.mangled).length)} tone="accent" />
              <Stat label="columns" value={String(analysis.parseReport.layout.columns)} />
            </dl>
          ) : null}
        </div>
        <div className="lg:col-span-8">{demo && analysis?.parseReport ? <AtsView doc={demo.doc} report={analysis.parseReport} mode="scrub" compact /> : <Skeleton className="aspect-[8.5/11] w-full" />}</div>
      </div>
    </section>
  );
}

const CATEGORY_BLURB: Record<CategoryId, string> = {
  parse: 'Does the text survive extraction? Columns, tables, headers, text boxes and icon glyphs each lose or scramble lines.',
  keywords: 'Weighted coverage of the terms the target role or pasted description asks for. Missing terms cost their exact share.',
  impact: 'Every role bullet scored verb + number + outcome out of three. A bullet with none of them costs its full share.',
  structure: 'Standard headings a parser can map, dated roles, sane order and length.',
  writing: 'Weak openers, filler, first person, passive voice, and the generic phrasing screening tools now flag as machine-written.',
  contact: 'Can the ATS build a contact record, and does it survive the layout?',
};

/** How the score is built: six weights, each expandable to a real finding from the sample. */
export function ScoreAnatomySection() {
  const { analysis } = useDemo();
  const [open, setOpen] = useState<CategoryId | null>('impact');
  const reduced = useReducedMotion();
  const cats = (Object.keys(CATEGORY_META) as CategoryId[]).sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order);
  return (
    <section className="border-t border-line bg-bg-1/40 py-16 sm:py-24" aria-labelledby="anatomy-heading">
      <div className="container-x grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="t-label">How the score is built</p>
          <h2 id="anatomy-heading" className="t-display mt-3 text-2xl text-fg sm:text-3xl">
            Six weighted categories. Every point traces to a line.
          </h2>
          <p className="mt-4 text-fg-1">The engine is deterministic: the same file gets the same score every time, and each finding quotes the text that cost the points. A model is only used to write better prose, never to grade.</p>
          <div className="mt-6 flex items-center gap-4">
            <ScoreRing score={analysis?.overallScore} size={112} stroke={8} label="sample" />
            <p className="text-sm text-fg-1">
              The sample scores <span className="num text-fg">{analysis?.overallScore ?? '—'}</span>. Its rewrite, with no model at all, scores <span className="num text-fg">82</span>; the gap left is keyword coverage the document cannot honestly claim.
            </p>
          </div>
        </div>
        <div className="lg:col-span-8">
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-r1 border border-line bg-bg-2" aria-hidden>
            {cats.map((id) => (
              <button key={id} type="button" onClick={() => setOpen(id)} className={cn('h-full border-r border-bg transition-colors last:border-r-0', open === id ? 'bg-accent' : 'bg-bg-4 hover:bg-fg-3')} style={{ width: `${CATEGORY_META[id].weight}%` }} tabIndex={-1} />
            ))}
          </div>
          <ul className="flex flex-col gap-2" role="list">
            {cats.map((id) => {
              const meta = CATEGORY_META[id];
              const cat = analysis?.categories.find((c) => c.id === id);
              const isOpen = open === id;
              return (
                <motion.li key={id} layout transition={pick(reduced, SPRING_LAYOUT)} className={cn('panel overflow-hidden', isOpen && 'border-line-strong')}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left">
                    <span className={cn('text-fg-2 transition-transform', isOpen && 'rotate-90')} aria-hidden>
                      <IconChevron />
                    </span>
                    <span className="num w-8 text-md text-accent">{meta.weight}</span>
                    <span className="flex-1 font-medium text-fg">{meta.label}</span>
                    {cat ? (
                      <span className="num text-sm text-fg-1">
                        sample <span className={cat.score < 50 ? 'text-bad' : cat.score < 85 ? 'text-accent' : 'text-good'}>{cat.score}</span>
                      </span>
                    ) : null}
                  </button>
                  {isOpen ? (
                    <div className="border-t border-line p-4">
                      <p className="text-sm text-fg-1">{CATEGORY_BLURB[id]}</p>
                      {cat?.findings[0] ? (
                        <div className="mt-3">
                          <FindingCard finding={cat.findings[0]} compact />
                        </div>
                      ) : cat ? (
                        <p className="mt-3 text-sm text-fg-2">Nothing cost points here in the sample.</p>
                      ) : (
                        <Skeleton className="mt-3 h-24" />
                      )}
                    </div>
                  ) : null}
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function EnginesSection() {
  const { analysis } = useDemo();
  return (
    <section className="container-x py-16 sm:py-24" aria-labelledby="engines-heading">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="t-label">Four parsers</p>
          <h2 id="engines-heading" className="t-display mt-3 text-2xl text-fg sm:text-3xl">
            Workday, Greenhouse, Lever and Taleo do not read the same way.
          </h2>
          <p className="mt-4 text-fg-1">Each estimate reweights the six categories the way that system does and applies its layout penalties. Single-column documents score highest on all four, which is why the rewrite is always single-column.</p>
        </div>
        <div className="lg:col-span-8">{analysis?.perEngineScores ? <EngineReadouts engines={analysis.perEngineScores} /> : <Skeleton className="h-28 w-full" />}</div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'accent' }) {
  return (
    <div className="readout">
      <dt className="t-label">{label}</dt>
      <dd className={cn('num mt-1 text-lg leading-none', tone === 'bad' ? 'text-bad' : tone === 'accent' ? 'text-accent' : 'text-fg')}>{value}</dd>
    </div>
  );
}
