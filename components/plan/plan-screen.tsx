'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';
import { useTransitionRouter } from 'next-view-transitions';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import type { ParsedResume } from '@/lib/parse/types';
import type { Analysis, PlanItem } from '@/lib/schema/analysis';
import type { Rewrite, RewriteEvent } from '@/lib/schema/rewrite';
import { projectScore } from '@/lib/rewrite/planner';
import { startRewrite } from '@/app/actions/analysis';
import { usePaletteCommands } from '@/components/palette/registry';
import { FlowNav } from '@/components/report/flow-nav';
import { ScanPane, type LineMark } from '@/components/analyze/scan-pane';
import { Count } from '@/components/ui/count';
import { Button, ButtonLink } from '@/components/ui/button';
import { Checkbox, Readout } from '@/components/ui/primitives';
import { IconAlert, IconArrowRight, IconCheck, IconLock } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { pick, SPRING_LAYOUT, fadeUp } from '@/styles/motion';
import { formatMs } from '@/components/analyze/stage-strip';

const KIND_LABEL: Record<PlanItem['kind'], string> = {
  layout: 'Layout',
  contact: 'Contact',
  heading: 'Headings',
  bullets: 'Bullets',
  summary: 'Summary',
  keywords: 'Keywords',
  structure: 'Structure',
  writing: 'Writing',
};

/**
 * The plan: every intended change with its projected gain, a running total
 * that recomputes on each toggle, and the button that runs only what survives.
 */
export function PlanScreen({ doc, analysis, rewrite }: { doc: ParsedResume; analysis: Analysis; rewrite: Rewrite | null }) {
  const plan = useMemo(() => analysis.improvementPlan ?? [], [analysis.improvementPlan]);
  const baseline = analysis.rawTotal ?? analysis.overallScore ?? 0;
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.map((p) => [p.id, rewrite ? rewrite.enabledPlanItemIds.includes(p.id) || !!p.locked : p.enabled])));
  const [focus, setFocus] = useState<string | null>(null);
  const items = useMemo(() => plan.map((p) => ({ ...p, enabled: p.locked ? true : enabled[p.id] ?? p.enabled })), [plan, enabled]);
  const projected = useMemo(() => projectScore(baseline, items), [baseline, items]);
  const enabledCount = items.filter((p) => p.enabled && p.projectedGain > 0).length;
  const router = useTransitionRouter();
  const reduced = useReducedMotion();

  const [run, setRun] = useState<{ status: string[]; iterations: { iteration: number; score: number; note: string }[]; sections: string[]; startedAt: number; done: boolean; error: string | null } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!run || run.done) return;
    const t = setInterval(() => setElapsed(Date.now() - run.startedAt), 100);
    return () => clearInterval(t);
  }, [run]);

  const running = useRef(false);
  const start = async () => {
    if (running.current) return;
    running.current = true;
    const ids = items.filter((p) => p.enabled).map((p) => p.id);
    setRun({ status: [], iterations: [], sections: [], startedAt: Date.now(), done: false, error: null });
    const res = await startRewrite(analysis.id, ids);
    if ('error' in res) {
      setRun((r) => (r ? { ...r, done: true, error: res.error ?? 'Could not start the rewrite.' } : r));
      running.current = false;
      return;
    }
    try {
      for await (const ev of readStreamableValue(res.stream)) {
        if (!ev) continue;
        const e = ev as RewriteEvent;
        setRun((r) => {
          if (!r) return r;
          if (e.type === 'status') return { ...r, status: [...r.status, e.message] };
          if (e.type === 'iteration') return { ...r, iterations: [...r.iterations, { iteration: e.iteration, score: e.score, note: e.note }] };
          if (e.type === 'section') return { ...r, sections: [...r.sections, e.section.title] };
          if (e.type === 'error') return { ...r, done: true, error: e.message };
          if (e.type === 'complete') return { ...r, done: true };
          return r;
        });
        if (e.type === 'complete') {
          setTimeout(() => router.push(`/report/${analysis.id}/diff`), 500);
        }
      }
    } catch (err) {
      setRun((r) => (r ? { ...r, done: true, error: (err as Error).message } : r));
    } finally {
      running.current = false;
    }
  };

  usePaletteCommands(
    'plan',
    [
      { id: 'run-rewrite', label: 'Rewrite with the selected changes', group: 'Plan', shortcut: 'R', run: start },
      { id: 'enable-all', label: 'Enable every change', group: 'Plan', run: () => setEnabled(Object.fromEntries(plan.map((p) => [p.id, true]))) },
      { id: 'disable-optional', label: 'Disable every optional change', group: 'Plan', run: () => setEnabled(Object.fromEntries(plan.map((p) => [p.id, !!p.locked]))) },
    ],
    [plan, items],
  );

  const focused = items.find((p) => p.id === focus);
  const marks = useMemo(() => {
    const m: Record<string, LineMark> = {};
    for (const id of focused?.lineRefs ?? []) m[id] = { severity: 'medium', count: 1, categoryIds: [focused!.kind] };
    return m;
  }, [focused]);

  let running_total = baseline;
  return (
    <div className="flex flex-col">
      <FlowNav id={analysis.id} current="plan" hasRewrite={!!rewrite} fileName={doc.fileName} score={analysis.overallScore} projected={rewrite?.projected?.overallScore} />
      <div className="container-x grid grid-cols-1 gap-8 py-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="t-label">The plan</p>
              <h1 className="t-display mt-2 text-2xl text-fg sm:text-3xl">Before anything changes, here is what would.</h1>
              <p className="mt-2 max-w-xl text-sm text-fg-1">Each row resolves specific findings; its gain is their point cost, weighted. Uncheck anything you would rather keep. Layout and contact placement are inherent to a single-column rewrite and stay on.</p>
            </div>
          </div>
          <ol className="flex flex-col gap-2" aria-label="Intended changes">
            {items.map((p, i) => {
              const before = running_total;
              if (p.enabled) running_total = Math.min(99, running_total + p.projectedGain);
              const after = running_total;
              const informational = p.data?.informational === true;
              return (
                <motion.li key={p.id} layout transition={pick(reduced, SPRING_LAYOUT)} className={cn('panel flex items-start gap-3 p-3 sm:p-4', !p.enabled && 'opacity-70', focus === p.id && 'border-line-strong')} onMouseEnter={() => setFocus(p.id)} onFocus={() => setFocus(p.id)}>
                  <label className="flex cursor-pointer items-start gap-3 pt-0.5">
                    <Checkbox checked={p.enabled} locked={p.locked} disabled={p.locked || informational} onChange={(e) => setEnabled((s) => ({ ...s, [p.id]: e.target.checked }))} aria-label={`${p.enabled ? 'Disable' : 'Enable'}: ${p.change}`} />
                    <span className="sr-only">{p.change}</span>
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[10px] text-fg-3">{String(i + 1).padStart(2, '0')}</span>
                      <span className="t-label">{KIND_LABEL[p.kind]}</span>
                      <span className="num text-[10px] text-fg-3">→ {p.targetSection}</span>
                      {p.locked ? (
                        <span className="num inline-flex items-center gap-1 rounded-r0 border border-line px-1 text-[10px] text-fg-2">
                          <IconLock size={10} /> always
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-fg">{p.change}</p>
                    {p.detail ? <p className="mt-1 text-xs text-fg-2">{p.detail}</p> : null}
                    <p className="num mt-1.5 text-[11px] text-fg-3">
                      resolves {p.findingIds.length} finding{p.findingIds.length === 1 ? '' : 's'}
                      {p.lineRefs.length ? ` · lines ${p.lineRefs.slice(0, 5).join(', ')}${p.lineRefs.length > 5 ? '…' : ''}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('num text-md leading-none', p.projectedGain > 0 ? (p.enabled ? 'text-good' : 'text-fg-3') : 'text-fg-3')}>{p.projectedGain > 0 ? `+${p.projectedGain}` : '±0'}</p>
                    <p className="num mt-1 text-[11px] text-fg-2" title="Running total after this change">
                      {p.enabled && p.projectedGain > 0 ? `${before.toFixed(1)} → ${after.toFixed(1)}` : '—'}
                    </p>
                  </div>
                </motion.li>
              );
            })}
            {items.length === 0 ? <li className="panel p-6 text-center text-sm text-fg-2">Nothing to change. The document already scores as high as the engine can take it honestly.</li> : null}
          </ol>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <section className="panel sticky top-[calc(56px+48px+16px)] flex flex-col gap-4 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="t-label">Projected score</p>
                <p className="num mt-1 text-4xl leading-none text-fg">
                  <Count value={projected} spring="tick" />
                </p>
                <p className="num mt-1 text-xs text-fg-2">
                  from {Math.round(baseline)} · {enabledCount} change{enabledCount === 1 ? '' : 's'} on
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Readout label="target" value="89–99" tone="accent" />
                <Readout label="gap" value={projected >= 89 ? 'closed' : `${(89 - projected).toFixed(1)}`} tone={projected >= 89 ? 'good' : 'bad'} hint="Points still needed to reach 89" />
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-r0 bg-bg-3" aria-hidden>
              <motion.div className="h-full origin-left bg-good" initial={false} animate={{ scaleX: Math.min(1, projected / 99) }} transition={pick(reduced, SPRING_LAYOUT)} style={{ width: '100%' }} />
            </div>
            {projected < 89 ? (
              <p className="flex items-start gap-2 text-xs text-fg-1">
                <IconAlert size={14} className="mt-0.5 shrink-0 text-accent" />
                <span>The projection stops short of 89. The rewrite will still run and iterate; whatever gap remains will be named exactly — usually keyword coverage the document cannot claim truthfully.</span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-xs text-fg-1">
                <IconCheck size={14} className="mt-0.5 shrink-0 text-good" />
                <span>Projection clears the bar. The rewrite is verified against the original and re-scored before you see it.</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="lg" onClick={start} disabled={!!run && !run.done}>
                {rewrite ? 'Rewrite again' : 'Rewrite'} with {items.filter((p) => p.enabled).length} changes <IconArrowRight />
              </Button>
              {rewrite ? (
                <ButtonLink href={`/report/${analysis.id}/diff`} variant="ghost" size="lg">
                  Open existing rewrite ({rewrite.projected?.overallScore})
                </ButtonLink>
              ) : null}
            </div>
            <AnimatePresence>
              {run ? (
                <motion.div key="run" {...fadeUp} transition={pick(reduced, SPRING_LAYOUT)} className="rounded-r2 border border-line bg-bg-2 p-3" role="status" aria-live="polite">
                  <div className="flex items-center justify-between">
                    <p className="t-label">{run.done ? (run.error ? 'Failed' : 'Complete') : 'Rewriting'}</p>
                    <span className="num text-xs text-fg-2">{formatMs(run.done ? elapsed : elapsed)}</span>
                  </div>
                  <ul className="num mt-2 flex flex-col gap-1 text-xs text-fg-1">
                    {run.status.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-fg-3">›</span>
                        <span>{s}</span>
                      </li>
                    ))}
                    {run.iterations.map((it) => (
                      <li key={it.iteration} className="flex gap-2 text-fg">
                        <span className="text-accent">#{it.iteration}</span>
                        <span>
                          {it.note} <span className="text-fg-2">({it.score}/99)</span>
                        </span>
                      </li>
                    ))}
                    {run.sections.length ? (
                      <li className="flex gap-2 text-good">
                        <span>✓</span>
                        <span>{run.sections.join(' · ')}</span>
                      </li>
                    ) : null}
                    {run.error ? (
                      <li className="flex gap-2 text-bad">
                        <span>×</span>
                        <span>{run.error}</span>
                      </li>
                    ) : null}
                  </ul>
                  {run.done && !run.error ? <p className="mt-2 text-xs text-fg-2">Opening the diff…</p> : null}
                  {run.error ? (
                    <Button size="sm" className="mt-2" onClick={start}>
                      Try again
                    </Button>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
          <div>
            <p className="t-label mb-2">{focused ? `Lines touched by: ${focused.change}` : 'Hover a change to see the lines it touches'}</p>
            <ScanPane lines={doc.lines} marks={marks} activeLineId={focused?.lineRefs[0] ?? null} scanning={false} compact className="h-[360px]" ariaLabel="Lines affected by the highlighted change" />
          </div>
        </div>
      </div>
    </div>
  );
}
