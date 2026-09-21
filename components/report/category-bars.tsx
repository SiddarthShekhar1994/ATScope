'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { AnalysisCategory, AnalysisFinding } from '@/lib/schema/analysis';
import { CATEGORY_META } from '@/lib/score/types';
import { FindingCard } from './finding-card';
import { IconChevron } from '@/components/ui/icons';
import { Count } from '@/components/ui/count';
import { cn } from '@/lib/cn';
import { pick, SPRING_LAYOUT, SPRING_SCORE, STAGGER, REDUCED } from '@/styles/motion';

/**
 * Six category rows. The fill animates with scaleX, the row expands with a
 * layout animation (transform-driven, never height), and findings inside
 * stagger in at 40ms. Contribution = score × weight / 100, shown on each row so
 * the total is visibly the sum of the parts.
 */
export function CategoryBars({ categories, expanded, onToggle, activeFindingId, onSelectFinding, showAll, onShowAll }: { categories: AnalysisCategory[]; expanded: string | null; onToggle: (id: string) => void; activeFindingId?: string | null; onSelectFinding: (f: AnalysisFinding) => void; showAll: Record<string, boolean>; onShowAll: (id: string) => void }) {
  const reduced = useReducedMotion();
  const ordered = [...categories].sort((a, b) => CATEGORY_META[a.id].order - CATEGORY_META[b.id].order);
  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Score categories">
      {ordered.map((c) => {
        const open = expanded === c.id;
        const contribution = Math.round(((c.score * c.weight) / 100) * 10) / 10;
        const tone = c.score >= 85 ? 'var(--good)' : c.score >= 60 ? 'var(--accent)' : 'var(--bad)';
        const shown = showAll[c.id] ? c.findings : c.findings.slice(0, 4);
        return (
          <motion.section key={c.id} layout transition={pick(reduced, SPRING_LAYOUT)} role="listitem" className={cn('panel overflow-hidden', open && 'border-line-strong')}>
            <button type="button" onClick={() => onToggle(c.id)} aria-expanded={open} aria-controls={`cat-${c.id}`} className="flex w-full items-center gap-3 p-3 text-left sm:p-4">
              <span className={cn('text-fg-2 transition-transform', open && 'rotate-90')} aria-hidden>
                <IconChevron />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium text-fg">{c.label}</span>
                  <span className="num shrink-0 text-xs text-fg-2">
                    weight <span className="text-fg-1">{c.weight}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-r0 bg-bg-3" aria-hidden>
                  <motion.div className="h-full w-full origin-left rounded-r0" style={{ background: tone }} initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.005, c.score / 100) }} transition={reduced ? REDUCED : SPRING_SCORE} />
                </div>
              </div>
              <div className="w-20 shrink-0 text-right sm:w-24">
                <span className="num block text-md leading-none text-fg" aria-label={`${c.score} out of 100`}>
                  <Count value={c.score} />
                </span>
                <span className="num mt-1 block text-[10px] text-fg-2" title="Points this category adds to the total">
                  +{contribution} of {c.weight}
                </span>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div id={`cat-${c.id}`} key="body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.1 : 0.18 }} className="border-t border-line px-3 pb-3 sm:px-4 sm:pb-4">
                  <p className="py-3 text-sm text-fg-1">{c.summary}</p>
                  {c.facts.length ? (
                    <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {c.facts.map((f) => (
                        <div key={f.label} className="readout">
                          <dt className="t-label truncate">{f.label}</dt>
                          <dd className="num mt-1 truncate text-sm text-fg" title={f.value}>
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {c.findings.length === 0 ? (
                    <p className="rounded-r2 border border-dashed border-line p-4 text-center text-sm text-fg-2">Nothing cost points here.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {shown.map((f, i) => (
                        <motion.li key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...pick(reduced, SPRING_LAYOUT), delay: reduced ? 0 : Math.min(0.32, i * STAGGER) }}>
                          <FindingCard finding={f} active={activeFindingId === f.id} onSelect={onSelectFinding} />
                        </motion.li>
                      ))}
                    </ul>
                  )}
                  {c.findings.length > 4 ? (
                    <button type="button" onClick={() => onShowAll(c.id)} className="hit mt-3 rounded-r1 text-xs text-fg-1 underline-offset-4 hover:text-fg hover:underline">
                      {showAll[c.id] ? 'Show the top four' : `Show all ${c.findings.length} findings (${c.findings.slice(4).reduce((n, f) => n + f.pointCost, 0).toFixed(1)} more points)`}
                    </button>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        );
      })}
    </div>
  );
}

export function CategorySkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel flex items-center gap-3 p-4">
          <div className="skeleton h-4 w-4" />
          <div className="flex-1">
            <div className="skeleton h-3.5 w-40" />
            <div className="skeleton mt-3 h-1.5 w-full" />
          </div>
          <div className="skeleton h-6 w-12" />
        </div>
      ))}
    </div>
  );
}
