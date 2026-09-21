'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import type { ResumeLine } from '@/lib/parse/types';
import type { Severity } from '@/lib/score/types';
import { cn } from '@/lib/cn';
import { SPRING_LAYOUT, REDUCED } from '@/styles/motion';

export interface LineMark {
  severity: Severity;
  count: number;
  categoryIds: string[];
}

export interface ScanPaneProps {
  lines: ResumeLine[];
  marks: Record<string, LineMark>;
  /** Line the scan line should travel to. */
  scanTo?: string | null;
  activeLineId?: string | null;
  onLineClick?: (line: ResumeLine) => void;
  compact?: boolean;
  scanning?: boolean;
  className?: string;
  /** Called with the container so parents can keep the pane in view. */
  ariaLabel?: string;
}

const SEVERITY_BG: Record<Severity, string> = {
  high: 'rgba(229,101,79,0.14)',
  medium: 'rgba(242,179,61,0.14)',
  low: 'rgba(236,232,225,0.06)',
};
const SEVERITY_RULE: Record<Severity, string> = { high: 'var(--bad)', medium: 'var(--accent)', low: 'var(--fg-2)' };

/**
 * The resume as the engine sees it: numbered lines in human reading order.
 * Findings mark their line the moment they resolve, and a scan line travels to
 * the newest one. Virtualized past 50 lines; the scan line is positioned from
 * the virtualizer's measurements so it lands on offscreen rows too.
 */
export function ScanPane({ lines, marks, scanTo, activeLineId, onLineClick, compact, scanning, className, ariaLabel }: ScanPaneProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // The pane is monospace, so row heights are computed, not measured: TanStack
  // skips measuring while a smooth scroll is in flight and rows would overlap.
  const lineH = compact ? 16 : 20;
  const padY = compact ? 6 : 8;
  const charW = compact ? 6.9 : 7.8;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const rowsFor = (line: ResumeLine): number => {
    const gutter = (compact ? 28 : 36) + 12 * 2 + 12 + 48; // id column, gaps, padding, badge
    // Word wrapping breaks early, so undercount the characters per row; a spare row is harmless, a clipped one is not.
    const chars = Math.max(12, Math.floor(((width - gutter) / charW) * 0.9));
    const text = (line.bullet ? line.bullet.length + 1 : 0) + line.text.length;
    return Math.max(1, Math.ceil(text / chars));
  };
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => rowsFor(lines[i]) * lineH + padY,
    overscan: 16,
  });
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, lines]);
  const y = useMotionValue(0);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const prevMarks = useRef<Record<string, LineMark>>({});
  const userScrolledAt = useRef(0);
  const indexOf = useMemo(() => new Map(lines.map((l, i) => [l.id, i])), [lines]);

  // Flash newly marked lines, then settle.
  useEffect(() => {
    const fresh: Record<string, number> = {};
    for (const id of Object.keys(marks)) if (!prevMarks.current[id] || prevMarks.current[id].count !== marks[id].count) fresh[id] = Date.now();
    prevMarks.current = marks;
    if (Object.keys(fresh).length) {
      setFlash((f) => ({ ...f, ...fresh }));
      const t = setTimeout(() => setFlash((f) => Object.fromEntries(Object.entries(f).filter(([, at]) => Date.now() - at < 700))), 750);
      return () => clearTimeout(t);
    }
  }, [marks]);

  // Move the scan line to the newest finding and keep it in view.
  useEffect(() => {
    if (!scanTo) return;
    const idx = indexOf.get(scanTo);
    if (idx === undefined) return;
    const item = virtualizer.measurementsCache[idx];
    const target = item ? item.start + item.size / 2 : idx * (lineH + padY) + lineH / 2;
    const controls = animate(y, target, reduced ? REDUCED : SPRING_LAYOUT);
    if (Date.now() - userScrolledAt.current > 1500) virtualizer.scrollToIndex(idx, { align: 'center', behavior: reduced ? 'auto' : 'smooth' });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTo, indexOf, reduced]);

  useEffect(() => {
    if (!activeLineId) return;
    const idx = indexOf.get(activeLineId);
    if (idx !== undefined) virtualizer.scrollToIndex(idx, { align: 'center', behavior: reduced ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLineId, indexOf, reduced]);

  const items = virtualizer.getVirtualItems();
  return (
    <div
      ref={parentRef}
      onWheel={() => (userScrolledAt.current = Date.now())}
      onTouchMove={() => (userScrolledAt.current = Date.now())}
      className={cn('grid-paper relative overflow-y-auto overscroll-contain rounded-r2 border border-line bg-bg-1', className)}
      role="list"
      aria-label={ariaLabel ?? 'Resume lines'}
      tabIndex={0}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {items.map((vi) => {
          const line = lines[vi.index];
          const mark = marks[line.id];
          const isActive = activeLineId === line.id;
          const flashing = flash[line.id] !== undefined;
          const dropped = line.source === 'header' || line.source === 'footer' || line.source === 'textbox';
          return (
            <div
              key={line.id}
              data-index={vi.index}
              role="listitem"
              className={cn('doc-line absolute left-0 top-0 flex w-full items-start gap-3 overflow-hidden px-3', onLineClick && 'cursor-pointer hover:bg-bg-2', compact ? 'py-[3px] text-[11.5px] leading-[16px]' : 'py-1 text-[13px] leading-5', isActive && 'ring-1 ring-inset ring-accent')}
              style={{
                transform: `translateY(${vi.start}px)`,
                height: vi.size,
                background: mark ? (flashing ? SEVERITY_BG[mark.severity].replace(/[\d.]+\)$/, '0.32)') : SEVERITY_BG[mark.severity]) : undefined,
                boxShadow: mark ? `inset 2px 0 0 ${SEVERITY_RULE[mark.severity]}` : undefined,
              }}
              onClick={onLineClick ? () => onLineClick(line) : undefined}
              onKeyDown={onLineClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onLineClick(line) : undefined}
              tabIndex={onLineClick ? 0 : -1}
            >
              <span className={cn('num w-9 shrink-0 select-none text-right text-fg-3', compact && 'w-7')}>{line.id}</span>
              <span className={cn('num min-w-0 flex-1 whitespace-pre-wrap break-words font-[var(--font-mono)]', dropped ? 'text-fg-2 line-through decoration-fg-3' : line.kind === 'heading' ? 'font-semibold text-fg' : line.kind === 'name' ? 'font-semibold text-fg' : 'text-fg-1')}>
                {line.bullet ? <span className="text-fg-3">{line.bullet} </span> : null}
                {line.text}
              </span>
              {dropped ? (
                <span className="num shrink-0 rounded-r0 border border-line px-1 text-[10px] uppercase tracking-wider text-fg-3" title={`In the page ${line.source}: most parsers never read this`}>
                  {line.source}
                </span>
              ) : mark ? (
                <span className="num shrink-0 text-[10px] text-fg-2" aria-label={`${mark.count} finding${mark.count === 1 ? '' : 's'}`}>
                  {mark.count > 1 ? `×${mark.count}` : ''}
                </span>
              ) : null}
            </div>
          );
        })}
        {scanning ? (
          <motion.div aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 h-px" style={{ y, background: 'linear-gradient(90deg, transparent, var(--accent) 12%, var(--accent) 88%, transparent)', boxShadow: '0 0 12px 2px var(--accent-glow), 0 0 2px var(--accent)' }}>
            <span className="absolute -left-0 -top-[3px] h-[7px] w-[7px] rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
