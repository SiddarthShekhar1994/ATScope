'use client';

import type { EngineScore } from '@/lib/score/types';
import { Count } from '@/components/ui/count';
import { cn } from '@/lib/cn';

/** Four instrument readouts, one per parser profile, each with its one-line reason. */
export function EngineReadouts({ engines, compact, compare }: { engines: EngineScore[]; compact?: boolean; compare?: EngineScore[] }) {
  return (
    <ul className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')} aria-label="Per-engine estimates">
      {engines.map((e) => {
        const before = compare?.find((c) => c.engine === e.engine)?.score;
        const tone = e.score >= 85 ? 'text-good' : e.score >= 60 ? 'text-accent' : 'text-bad';
        return (
          <li key={e.engine} className="readout flex flex-col gap-1" title={e.note}>
            <span className="t-label">{e.label}</span>
            <span className={cn('num leading-none', compact ? 'text-md' : 'text-lg', tone)}>
              <Count value={e.score} />
              {before !== undefined && before !== e.score ? <span className="num ml-1.5 text-xs text-fg-2">{before < e.score ? `↑${e.score - before}` : `↓${before - e.score}`}</span> : null}
            </span>
            {!compact ? <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-2">{e.note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
