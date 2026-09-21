'use client';

import { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Hunk, RewriteLine, Placeholder } from '@/lib/schema/rewrite';
import type { ResumeLine } from '@/lib/parse/types';
import { PLACEHOLDER_RE } from '@/lib/score/bullet-strength';
import { cn } from '@/lib/cn';
import { IconCheck, IconX } from '@/components/ui/icons';

export interface DiffRowProps {
  hunk: Hunk;
  index: number;
  original: Map<string, ResumeLine>;
  rewrite: Map<string, RewriteLine>;
  placeholders: Placeholder[];
  values: Record<string, string>;
  accepted: boolean;
  isCursor: boolean;
  sweeping: boolean;
  onAccept: () => void;
  onReject: () => void;
  onFocusPlaceholder: (id: string) => void;
  onSelect: () => void;
  gutter: number;
  style?: React.CSSProperties;
  'data-index'?: number;
}

const GUTTER = 44;

/**
 * One hunk: original on the left, rewrite on the right, a bezier in the gutter
 * connecting the two centres. Accept sweeps a highlight across then settles.
 * The connector only needs the two cell heights, measured after layout.
 */
export const DiffRow = forwardRef<HTMLDivElement, DiffRowProps>(function DiffRow({ hunk, index, original, rewrite, placeholders, values, accepted, isCursor, sweeping, onAccept, onReject, onFocusPlaceholder, onSelect, style, ...rest }, ref) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<{ l: number; r: number }>({ l: 0, r: 0 });
  useLayoutEffect(() => {
    const measure = () => setH({ l: leftRef.current?.offsetHeight ?? 0, r: rightRef.current?.offsetHeight ?? 0 });
    measure();
    const ro = new ResizeObserver(measure);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    return () => ro.disconnect();
  }, [hunk.id, accepted]);

  const isChange = hunk.kind !== 'same';
  const lefts = hunk.originalLineIds.map((id) => original.get(id)).filter(Boolean) as ResumeLine[];
  const rights = hunk.rewriteLineIds.map((id) => rewrite.get(id)).filter(Boolean) as RewriteLine[];
  const rowH = Math.max(h.l, h.r, 28);
  const path = isChange && lefts.length && rights.length ? `M0 ${h.l / 2} C ${GUTTER * 0.5} ${h.l / 2}, ${GUTTER * 0.5} ${h.r / 2}, ${GUTTER} ${h.r / 2}` : null;
  const tone = hunk.kind === 'insert' ? 'good' : hunk.kind === 'delete' ? 'bad' : hunk.kind === 'modify' ? 'accent' : 'none';
  const stroke = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--accent)';

  return (
    <div
      ref={ref}
      style={style}
      {...rest}
      className={cn('absolute left-0 top-0 w-full', isChange && 'cursor-pointer')}
      onClick={isChange ? onSelect : undefined}
      role="listitem"
      aria-label={isChange ? `${hunk.kind} in ${hunk.section}${accepted ? ', accepted' : ', rejected'}` : undefined}
      aria-current={isCursor ? 'true' : undefined}
    >
      <div className={cn('sweep grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-start rounded-r2 border transition-colors', isChange ? 'border-line bg-bg-1 my-1' : 'border-transparent', isCursor && 'border-accent bg-bg-2 shadow-[0_0_0_1px_var(--accent-dim)]')} data-sweep={sweeping ? 'on' : 'off'}>
        <div ref={leftRef} className={cn('num min-w-0 p-2 text-[13px] leading-5', hunk.kind === 'delete' && !accepted && 'text-fg', hunk.kind === 'delete' && accepted && 'text-fg-3 line-through decoration-bad/60', hunk.kind === 'modify' && accepted && 'text-fg-2', !isChange && 'text-fg-2')}>
          {lefts.length === 0 ? <span className="text-fg-3">—</span> : lefts.map((l) => <Line key={l.id} id={l.id} text={l.text} bullet={l.bullet} kind={l.kind} />)}
        </div>
        <div className="relative h-full self-stretch" aria-hidden>
          {path ? (
            <svg width={GUTTER} height={rowH} className="absolute left-0 top-0 overflow-visible" style={{ height: rowH }}>
              <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeOpacity={accepted ? 0.9 : 0.35} strokeDasharray={accepted ? undefined : '3 3'} />
              <circle cx={0} cy={h.l / 2} r={2} fill={stroke} fillOpacity={accepted ? 1 : 0.5} />
              <circle cx={GUTTER} cy={h.r / 2} r={2} fill={stroke} fillOpacity={accepted ? 1 : 0.5} />
            </svg>
          ) : isChange ? (
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
          ) : null}
          {isChange ? (
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label={`Accept change ${index + 1}`} aria-pressed={accepted} onClick={onAccept} className={cn('flex h-6 w-6 items-center justify-center rounded-r1 border transition-colors', accepted ? 'border-good bg-good text-accent-ink' : 'border-line bg-bg-2 text-fg-2 hover:border-good hover:text-good')}>
                <IconCheck size={12} strokeWidth={2.2} />
              </button>
              <button type="button" aria-label={`Reject change ${index + 1}`} aria-pressed={!accepted} onClick={onReject} className={cn('flex h-6 w-6 items-center justify-center rounded-r1 border transition-colors', !accepted ? 'border-bad bg-bad text-accent-ink' : 'border-line bg-bg-2 text-fg-2 hover:border-bad hover:text-bad')}>
                <IconX size={12} strokeWidth={2.2} />
              </button>
            </div>
          ) : null}
        </div>
        <div ref={rightRef} className={cn('num min-w-0 p-2 text-[13px] leading-5', hunk.kind === 'insert' && accepted && 'text-good', hunk.kind === 'modify' && accepted && 'text-fg', !accepted && isChange && hunk.kind !== 'delete' && 'text-fg-3 line-through decoration-fg-3', !isChange && 'text-fg-2')}>
          {hunk.kind === 'delete' ? (
            <span className={cn('text-xs', accepted ? 'text-bad' : 'text-fg-3')}>{accepted ? 'removed' : 'kept'}</span>
          ) : rights.length === 0 ? (
            <span className="text-fg-3">—</span>
          ) : (
            rights.map((l) => <Line key={l.id} id={l.id} text={l.text} bullet={l.kind === 'bullet' ? '•' : undefined} kind={l.kind} placeholders={placeholders.filter((p) => p.lineId === l.id)} values={values} onFocusPlaceholder={onFocusPlaceholder} disabled={!accepted} />)
          )}
        </div>
      </div>
      {isChange ? (
        <p className={cn('mb-1 px-2 text-[11px] text-fg-2', !accepted && 'opacity-60')}>
          <span className="num mr-1 text-fg-3">{hunk.kind}</span>
          {hunk.reason}
        </p>
      ) : null}
    </div>
  );
});

function Line({ id, text, bullet, kind, placeholders, values, onFocusPlaceholder, disabled }: { id: string; text: string; bullet?: string; kind: string; placeholders?: Placeholder[]; values?: Record<string, string>; onFocusPlaceholder?: (id: string) => void; disabled?: boolean }) {
  const parts: ReactNode[] = [];
  if (placeholders && placeholders.length) {
    let last = 0;
    const re = new RegExp(PLACEHOLDER_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      parts.push(text.slice(last, m.index));
      const ph = placeholders.find((p) => p.token === m![0]);
      const value = ph ? values?.[ph.id] ?? ph.value : undefined;
      parts.push(
        ph ? (
          <button
            key={`${id}-${m.index}`}
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onFocusPlaceholder?.(ph.id);
            }}
            className={cn('num mx-0.5 inline-flex max-w-full items-baseline gap-1 rounded-r0 border px-1 align-baseline text-[12px] leading-[18px]', value ? 'border-[rgba(155,207,106,0.4)] bg-good-dim text-good' : 'border-[rgba(242,179,61,0.5)] bg-accent-dim text-accent [border-style:dashed]')}
            title={value ? `Filled: ${value}` : `Fill in: ${ph.hint}${ph.projectedGain ? ` (+${ph.projectedGain})` : ''}`}
          >
            {value ? value : `[[${ph.hint}]]`}
            {!value && ph.projectedGain ? <span className="text-[10px] opacity-80">+{ph.projectedGain}</span> : null}
          </button>
        ) : (
          <span key={`${id}-${m.index}`}>{m[0]}</span>
        ),
      );
      last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
  } else parts.push(text);
  return (
    <div className={cn('flex gap-2', kind === 'heading' && 'font-semibold', kind === 'name' && 'font-semibold')}>
      {bullet ? <span className="shrink-0 text-fg-3">{bullet}</span> : null}
      <span className="min-w-0 whitespace-pre-wrap break-words">{parts}</span>
    </div>
  );
}
