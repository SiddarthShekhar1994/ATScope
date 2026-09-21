'use client';

import { useEffect, useRef } from 'react';
import type { Rewrite } from '@/lib/schema/rewrite';
import { cn } from '@/lib/cn';
import { IconCheck } from '@/components/ui/icons';

/**
 * Every [[placeholder]] in the accepted rewrite, with the projected gain the
 * engine computed for filling it. Unfilled ones block export.
 */
export function PlaceholderPanel({ rewrite, values, accepted, onChange, focusId, onFocused }: { rewrite: Rewrite; values: Record<string, string>; accepted: Record<string, boolean>; onChange: (id: string, value: string) => void; focusId: string | null; onFocused: () => void }) {
  const refs = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    if (!focusId) return;
    const el = refs.current.get(focusId);
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    onFocused();
  }, [focusId, onFocused]);

  const acceptedLineIds = new Set(rewrite.diffs.filter((h) => accepted[h.id] ?? h.accepted).flatMap((h) => h.rewriteLineIds));
  const lineText = new Map(rewrite.lines.map((l) => [l.id, l]));
  const list = rewrite.placeholders.filter((p) => acceptedLineIds.has(p.lineId));
  const unfilled = list.filter((p) => !(values[p.id] ?? p.value)?.trim());
  const totalGain = unfilled.reduce((n, p) => n + p.projectedGain, 0);

  if (list.length === 0) {
    return (
      <div className="panel-2 p-4 text-sm text-fg-1">
        <p className="flex items-center gap-2 text-fg">
          <IconCheck className="text-good" /> No fill-in fields in the accepted changes.
        </p>
        <p className="mt-1 text-xs text-fg-2">Every number in the rewrite came from your original document.</p>
      </div>
    );
  }
  return (
    <div id="placeholder-panel" className="flex flex-col gap-3">
      <div className="panel-2 p-3 text-sm">
        <p className="text-fg">
          <span className="num">{unfilled.length}</span> of <span className="num">{list.length}</span> fields still empty
          {totalGain > 0 ? (
            <>
              {' '}
              · worth <span className="num text-good">+{Math.round(totalGain * 10) / 10}</span> once filled
            </>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-fg-2">Numbers the engine could not find in your original. Fill in the real ones; guesses are on you, not the tool. Export unlocks when every field has a value.</p>
      </div>
      <ol className="flex flex-col gap-2" aria-label="Fill-in fields">
        {list.map((p) => {
          const value = values[p.id] ?? p.value ?? '';
          const line = lineText.get(p.lineId);
          return (
            <li key={p.id} className={cn('panel-2 p-3', value.trim() ? 'border-[rgba(155,207,106,0.3)]' : '')}>
              <label htmlFor={`ph-${p.id}`} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-fg">{p.hint}</span>
                <span className={cn('num shrink-0 text-xs', value.trim() ? 'text-good' : p.projectedGain ? 'text-accent' : 'text-fg-3')} title="Projected score gain when filled">
                  {value.trim() ? '✓ filled' : p.projectedGain ? `+${p.projectedGain}` : '±0'}
                </span>
              </label>
              <input
                id={`ph-${p.id}`}
                ref={(el) => {
                  if (el) refs.current.set(p.id, el);
                  else refs.current.delete(p.id);
                }}
                value={value}
                onChange={(e) => onChange(p.id, e.target.value)}
                placeholder="Type the real value"
                className="mt-2 h-9 w-full rounded-r1 border border-line bg-bg-1 px-2 text-sm text-fg placeholder:text-fg-3 focus:border-line-strong"
                style={{ fontSize: 16 }}
                autoComplete="off"
              />
              {line ? (
                <p className="num mt-2 line-clamp-2 text-[11px] text-fg-2" title={line.text}>
                  {line.text.replace(p.token, value.trim() ? value : '▁▁▁')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
