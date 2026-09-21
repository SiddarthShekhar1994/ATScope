'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useReducedMotion } from 'motion/react';
import type { Arrival } from '@/lib/analysis/client';
import { CATEGORY_META } from '@/lib/score/types';
import { Severity } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { STAGGER } from '@/styles/motion';

/**
 * Findings dock into the sidebar in arrival order. Rows have fixed heights so
 * the list virtualizes past 50 items without measurement; each new row plays a
 * transform/opacity enter animation, staggered 40ms within a burst that arrived
 * together. The list follows the newest item unless the user has scrolled.
 */
export function FindingsDock({ arrivals, onSelect, activeId, compact, className, maxItems }: { arrivals: Arrival[]; onSelect?: (findingId: string, lineRef: string) => void; activeId?: string | null; compact?: boolean; className?: string; maxItems?: number }) {
  const reduced = useReducedMotion();
  const parentRef = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(0);
  const list = useMemo(() => (maxItems ? arrivals.slice(-maxItems) : arrivals), [arrivals, maxItems]);
  const rowH = compact ? 60 : 108;
  const gap = 6;
  const virtualizer = useVirtualizer({ count: list.length, getScrollElement: () => parentRef.current, estimateSize: () => rowH + gap, overscan: 8 });

  // Items from the same burst share an arrival time; stagger within the burst.
  const burstIndex = useMemo(() => {
    const m = new Map<string, number>();
    let lastAt = -1;
    let k = 0;
    for (const a of list) {
      k = a.at === lastAt ? k + 1 : 0;
      lastAt = a.at;
      m.set(a.finding.id, k);
    }
    return m;
  }, [list]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el || list.length === 0 || Date.now() - userScrolledAt.current < 1500) return;
    // The inner height is already the new total size. Instant, like a chat log: the
    // rows' own enter animation carries the motion and it cannot stall when frames are throttled.
    el.scrollTop = el.scrollHeight;
  }, [list.length]);

  return (
    <div ref={parentRef} onWheel={() => (userScrolledAt.current = Date.now())} onTouchMove={() => (userScrolledAt.current = Date.now())} className={cn('relative overflow-y-auto overscroll-contain pr-1', className)} role="log" aria-live="polite" aria-relevant="additions" aria-label="Findings">
      {list.length === 0 ? (
        <div className={cn('panel-2 flex flex-col items-center justify-center gap-1 text-center text-fg-2', compact ? 'p-4 text-xs' : 'p-8 text-sm')}>
          <span className="t-label">Waiting for the first check</span>
          <span>Findings dock here as each one resolves.</span>
        </div>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const a = list[vi.index];
            const f = a.finding;
            const meta = CATEGORY_META[f.categoryId];
            const delay = reduced ? 0 : Math.min(400, (burstIndex.get(f.id) ?? 0) * STAGGER * 1000);
            // Only rows that just arrived animate in; rows scrolled back into view render settled.
            const fresh = Date.now() - a.at < 1000;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect?.(f.id, f.lineRef)}
                className={cn(fresh && 'dock-enter', 'panel-2 absolute left-0 top-0 flex w-full flex-col overflow-hidden text-left transition-colors hover:border-line-strong hover:bg-bg-3', compact ? 'p-2' : 'p-3', activeId === f.id && 'border-accent')}
                style={{ '--dock-y': `${vi.start}px`, transform: 'translateY(var(--dock-y))', height: rowH, animationDelay: `${delay}ms`, animationDuration: reduced ? '120ms' : '360ms' } as React.CSSProperties}
                aria-current={activeId === f.id ? 'true' : undefined}
              >
                <div className="flex items-center gap-2">
                  <Severity level={f.severity} />
                  <span className="t-label truncate">{meta.label}</span>
                  <span className="num ml-auto shrink-0 text-xs text-bad">−{f.pointCost}</span>
                  <span className="num shrink-0 text-[10px] text-fg-3">{f.lineRef}</span>
                </div>
                <p className={cn('num mt-1.5 truncate text-fg-1', compact ? 'text-[11px]' : 'text-xs')} title={f.quote}>
                  “{f.quote}”
                </p>
                {!compact ? <p className="mt-1 line-clamp-2 text-xs text-fg-2">{f.explanation}</p> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
