'use client';

import type { FeedState } from '@/lib/analysis/client';
import { STAGE_LABEL, STAGE_SEQUENCE } from '@/lib/analysis/client';
import type { Stage } from '@/lib/schema/analysis';
import { cn } from '@/lib/cn';
import { IconCheck } from '@/components/ui/icons';

/**
 * Stage readouts with real elapsed times. A stage shows its duration once the
 * next one starts; the current one counts up from the moment it began.
 */
export function StageStrip({ state, compact, modelAvailable }: { state: FeedState; compact?: boolean; modelAvailable?: boolean }) {
  const current = state.analysis.stage;
  const sequence = STAGE_SEQUENCE.filter((s) => s !== 'fixes' || modelAvailable || state.stageStarted.fixes !== undefined);
  const nowRef = state.startedAt !== null ? state.startedAt + state.elapsedMs : Date.now();
  const order = (s: Stage) => sequence.indexOf(s);
  const currentIdx = order(current);
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-1 gap-y-1', compact ? 'text-[10px]' : 'text-xs')} aria-label="Analysis stages">
      {sequence.map((s, i) => {
        const started = state.stageStarted[s];
        const nextStarted = sequence.slice(i + 1).map((n) => state.stageStarted[n]).find((t) => t !== undefined);
        const isDone = started !== undefined && (nextStarted !== undefined || state.done);
        const isCurrent = !state.done && s === current;
        const ms = started === undefined ? null : isDone ? (nextStarted ?? (state.lastEventAt ?? nowRef)) - started : nowRef - started;
        return (
          <li key={s} className={cn('num inline-flex items-center gap-1.5 rounded-r1 border px-2 py-1 leading-none transition-colors', isDone ? 'border-line text-fg-1' : isCurrent ? 'border-accent text-accent' : 'border-line-faint text-fg-3', i > currentIdx && !isDone && 'opacity-70')}>
            <span aria-hidden className="inline-flex h-3 w-3 items-center justify-center">
              {isDone ? <IconCheck size={10} strokeWidth={2.4} /> : isCurrent ? <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> : <span className="block h-1 w-1 rounded-full bg-fg-3" />}
            </span>
            <span className={cn(compact && 'hidden sm:inline')}>{STAGE_LABEL[s]}</span>
            {ms !== null ? (
              <span className="text-fg-2">{formatMs(ms)}</span>
            ) : (
              <span className="sr-only">pending</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
}
