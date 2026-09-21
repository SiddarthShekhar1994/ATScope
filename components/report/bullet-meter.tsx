'use client';

import type { BulletStrength as BulletStrengthT } from '@/lib/score/types';

type BulletStrength = Omit<BulletStrengthT, 'verb' | 'metric' | 'outcome'> & { verb: number; metric: number; outcome: number };
import { cn } from '@/lib/cn';
import { IconCheck, IconX } from '@/components/ui/icons';

/**
 * Per-bullet strength meter: verb · number · outcome. Three cells, each either
 * lit or not, with the word next to it so the state never relies on colour.
 */
export function BulletMeter({ bullets, onSelect, activeLineRef }: { bullets: BulletStrength[]; onSelect?: (lineRef: string) => void; activeLineRef?: string | null }) {
  if (!bullets.length) return <p className="rounded-r2 border border-dashed border-line p-6 text-center text-sm text-fg-2">No role bullets were found to measure.</p>;
  const avg = bullets.reduce((n, b) => n + b.score, 0) / bullets.length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-1">
        Mean strength <span className="num text-fg">{avg.toFixed(1)}</span> / 3 across <span className="num text-fg">{bullets.length}</span> bullets. A 3 has all three: an action verb, a number, and a stated result.
      </p>
      <ol className="flex flex-col gap-1.5">
        {bullets.map((b) => (
          <li key={b.lineRef}>
            <button type="button" onClick={() => onSelect?.(b.lineRef)} className={cn('panel-2 flex w-full flex-col gap-2 p-3 text-left transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:gap-4', activeLineRef === b.lineRef && 'border-accent')} aria-label={`Line ${b.lineRef}: strength ${b.score} of 3`}>
              <span className="num w-9 shrink-0 text-xs text-fg-3">{b.lineRef}</span>
              <span className="num min-w-0 flex-1 truncate text-xs text-fg-1" title={b.text}>
                {b.text}
              </span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                <Cell on={!!b.verb} label="verb" />
                <Cell on={!!b.metric} label="number" />
                <Cell on={!!b.outcome} label="outcome" />
              </span>
              <span className={cn('num w-8 shrink-0 text-right text-sm', b.score === 3 ? 'text-good' : b.score >= 2 ? 'text-fg' : 'text-bad')}>{b.score}/3</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Cell({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn('num inline-flex h-6 items-center gap-1 rounded-r0 border px-1.5 text-[10px] uppercase tracking-wider', on ? 'border-[rgba(155,207,106,0.35)] bg-good-dim text-good' : 'border-line text-fg-3')}>
      {on ? <IconCheck size={10} strokeWidth={2.4} /> : <IconX size={10} />}
      {label}
    </span>
  );
}
