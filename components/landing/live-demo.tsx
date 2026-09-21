'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';
import type { ParsedResume } from '@/lib/parse/types';
import type { AnalysisEvent, Analysis } from '@/lib/schema/analysis';
import { useAnalysisFeed, emptyAnalysis } from '@/lib/analysis/client';
import { AnalyzeScreen } from '@/components/analyze/analyze-screen';
import { Skeleton } from '@/components/ui/primitives';

interface Demo {
  doc: ParsedResume;
  target: Analysis['target'];
  events: AnalysisEvent[];
}

/**
 * The real analyzing screen replaying a real run over the sample resume.
 * Same parser output, same findings, same scores; the only thing not real is
 * the cadence, which is paced so a person can read it, and the caption says so.
 */
export function LiveDemo() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  useEffect(() => {
    let alive = true;
    import('@/lib/demo/sample.json').then((m) => alive && setDemo(m.default as unknown as Demo));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div ref={ref} className="panel p-4 sm:p-5" aria-label="Live demo of the analyzer on a sample resume">
      {demo ? <Replay demo={demo} playing={inView} /> : <DemoSkeleton />}
    </div>
  );
}

function Replay({ demo, playing }: { demo: Demo; playing: boolean }) {
  const seed = emptyAnalysis(demo.doc, demo.target);
  const { state, push, reset } = useAnalysisFeed(seed);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const run = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const start = () => {
      const id = ++run.current;
      reset(emptyAnalysis(demo.doc, demo.target));
      timers.current.forEach(clearTimeout);
      timers.current = [];
      // Pace: categories ~420ms apart so findings can be read as they dock; stages ride along.
      let t = 300;
      for (const ev of demo.events) {
        if (ev.type === 'category') t += 420;
        else if (ev.type === 'aggregate') t += 500;
        else if (ev.type === 'plan' || ev.type === 'done') t += 350;
        else t += 40;
        const at = t;
        timers.current.push(setTimeout(() => run.current === id && push(ev), at));
      }
      timers.current.push(setTimeout(() => run.current === id && start(), t + 5200));
    };
    start();
    const pending = timers.current;
    const counter = run;
    return () => {
      counter.current++;
      pending.forEach(clearTimeout);
      pending.length = 0;
    };
  }, [playing, demo, push, reset]);

  return (
    <AnalyzeScreen
      doc={demo.doc}
      state={state}
      compact
      caption={
        <p className="text-[11px] text-fg-2">
          Replay of a real analysis of a sample two-column resume, paced for reading. Every finding, quote and point cost came from the engine.
          {state.done ? ' Restarting shortly.' : ''}
        </p>
      }
    />
  );
}

function DemoSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16" />
        ))}
      </div>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Skeleton className="h-[360px]" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-[210px]" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </div>
  );
}
