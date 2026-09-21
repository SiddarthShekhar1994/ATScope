'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import type { ParsedResume, ResumeLine } from '@/lib/parse/types';
import type { ParseReport } from '@/lib/schema/analysis';
import { cn } from '@/lib/cn';
import { IconColumns, IconAlert } from '@/components/ui/icons';

/**
 * What you see vs what the machine reads.
 *
 * Left: a facsimile of the uploaded page rebuilt from line geometry (every
 * line placed at its measured box). Right: the ATS view — the same document
 * as a position-sorting parser linearises it, columns merged, header gone.
 * In scrub mode the machine view slides over the facsimile.
 */
export function AtsView({ doc, report, mode = 'split', highlightLineIds, onLineClick, className, compact }: { doc: Pick<ParsedResume, 'lines' | 'layout' | 'fileType'>; report: Pick<ParseReport, 'atsLines' | 'droppedElements' | 'readingOrderIssues'>; mode?: 'split' | 'scrub'; highlightLineIds?: Set<string>; onLineClick?: (line: ResumeLine) => void; className?: string; compact?: boolean }) {
  const [lostFocus, setLostFocus] = useState(false);
  const lost = useMemo(() => new Set(doc.lines.filter((l) => l.source !== 'body' && l.source !== 'table').map((l) => l.id)), [doc.lines]);
  const scrambled = useMemo(() => new Set(report.atsLines.filter((a) => a.mangled).flatMap((a) => a.fromLineIds)), [report.atsLines]);
  const pages = Math.max(1, ...doc.lines.map((l) => l.page));
  const stats = { lost: lost.size, scrambled: report.atsLines.filter((a) => a.mangled).length, dropped: report.droppedElements.length };

  const legend = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" onClick={() => setLostFocus((v) => !v)} aria-pressed={lostFocus} className={cn('num inline-flex h-7 items-center gap-1.5 rounded-r1 border px-2', lostFocus ? 'border-bad text-bad bg-bad-dim' : 'border-line text-fg-1 hover:border-line-strong')}>
        <span aria-hidden className="inline-block h-2 w-2 rounded-sm bg-bad" /> {stats.lost} line{stats.lost === 1 ? '' : 's'} never read
      </button>
      <span className="num inline-flex h-7 items-center gap-1.5 rounded-r1 border border-line px-2 text-fg-1">
        <span aria-hidden className="inline-block h-2 w-2 rounded-sm bg-accent" /> {stats.scrambled} scrambled
      </span>
      <span className="num inline-flex h-7 items-center gap-1.5 rounded-r1 border border-line px-2 text-fg-1">
        <IconColumns size={12} /> {doc.layout.columns} column{doc.layout.columns === 1 ? '' : 's'}
      </span>
    </div>
  );

  if (mode === 'scrub') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {legend}
        <Scrubber doc={doc} report={report} lost={lost} scrambled={scrambled} lostFocus={lostFocus} compact={compact} pages={pages} />
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {legend}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="t-label mb-2">What you see</p>
          <Facsimile lines={doc.lines} lost={lost} scrambled={scrambled} lostFocus={lostFocus} pages={pages} onLineClick={onLineClick} highlightLineIds={highlightLineIds} />
        </div>
        <div>
          <p className="t-label mb-2">What the parser reads</p>
          <MachineText report={report} lost={lost} highlightLineIds={highlightLineIds} className="max-h-[720px]" />
        </div>
      </div>
      {report.droppedElements.length ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Dropped elements">
          {report.droppedElements.map((d) => (
            <li key={d.id} className="panel-2 flex items-start gap-2 p-3 text-sm">
              <span className={cn('mt-0.5 shrink-0', d.severity === 'high' ? 'text-bad' : d.severity === 'medium' ? 'text-accent' : 'text-fg-2')} aria-hidden>
                <IconAlert size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-fg">
                  <span className="t-label mr-2">{d.kind}</span>
                  {d.description}
                </p>
                {d.text ? <p className="num mt-1 truncate text-xs text-fg-2">“{d.text}”</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The page rebuilt from geometry: light paper, every line at its measured box. */
export function Facsimile({ lines, lost, scrambled, lostFocus, pages, onLineClick, highlightLineIds, className, compact }: { lines: ResumeLine[]; lost: Set<string>; scrambled: Set<string>; lostFocus: boolean; pages: number; onLineClick?: (l: ResumeLine) => void; highlightLineIds?: Set<string>; className?: string; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 612));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: pages }).map((_, p) => (
        <div key={p} className="relative w-full overflow-hidden rounded-r1 bg-[#f6f3ec] text-[#1d1b17] shadow-2" style={{ aspectRatio: '8.5 / 11' }} role="img" aria-label={`Page ${p + 1} as laid out`}>
          {lines
            .filter((l) => l.page === p + 1 && l.bbox)
            .map((l) => {
              const b = l.bbox!;
              const isLost = lost.has(l.id);
              const isScr = scrambled.has(l.id);
              const size = Math.max(4.5, (l.font?.size ?? 10) * scale * 0.98);
              const hi = highlightLineIds?.has(l.id);
              return (
                <div
                  key={l.id}
                  onClick={onLineClick ? () => onLineClick(l) : undefined}
                  title={isLost ? `In the page ${l.source}: parsers skip this` : isScr ? 'Merged with the other column by parsers' : l.id}
                  className={cn('absolute whitespace-nowrap overflow-hidden leading-none transition-[background-color,box-shadow] duration-200', onLineClick && 'cursor-pointer', l.font?.bold && 'font-semibold', hi && 'bg-[rgba(242,179,61,0.45)] ring-1 ring-[#c98a12]', isLost && lostFocus && 'bg-[rgba(229,101,79,0.35)] line-through ring-1 ring-bad', !hi && !lostFocus && isLost && 'bg-[rgba(229,101,79,0.14)]', !hi && isScr && !isLost && 'bg-[rgba(242,179,61,0.16)]')}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${Math.max(b.w, 0.02) * 100}%`, height: `${Math.max(b.h, 0.012) * 100}%`, fontSize: size, fontFamily: /mono|courier/i.test(l.font?.name ?? '') ? 'ui-monospace, monospace' : /serif|times|georgia|garamond/i.test(l.font?.name ?? '') && !/sans/i.test(l.font?.name ?? '') ? 'Georgia, serif' : 'Arial, Helvetica, sans-serif' }}
                >
                  {l.raw}
                </div>
              );
            })}
          {compact ? null : <span className="num absolute bottom-1 right-2 text-[9px] text-[#8a8478]">p{p + 1}</span>}
        </div>
      ))}
    </div>
  );
}

/** The linearised text a parser receives. Scrambled rows flagged; lost lines simply absent. */
export function MachineText({ report, lost, highlightLineIds, className, compact }: { report: Pick<ParseReport, 'atsLines'>; lost: Set<string>; highlightLineIds?: Set<string>; className?: string; compact?: boolean }) {
  return (
    <div className={cn('grid-paper overflow-auto rounded-r1 border border-line bg-bg-1 p-3', className)} role="region" aria-label="Text as the parser reads it">
      <ol className={cn('num text-fg-1', compact ? 'text-[10px] leading-[15px]' : 'text-xs leading-5')}>
        {report.atsLines.map((a, i) => {
          const hi = highlightLineIds && a.fromLineIds.some((id) => highlightLineIds.has(id));
          return (
            <li key={i} className={cn('flex gap-3 rounded-r0 px-1', a.mangled && 'bg-accent-dim text-fg', hi && 'ring-1 ring-accent')} title={a.note}>
              <span className="w-6 shrink-0 select-none text-right text-fg-3">{i + 1}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{a.text}</span>
              {a.mangled ? (
                <span className="shrink-0 text-[9px] uppercase tracking-wider text-accent" aria-label={a.note}>
                  merged
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {lost.size ? (
        <p className="mt-3 border-t border-line pt-2 text-[11px] text-fg-2">
          {lost.size} line{lost.size === 1 ? '' : 's'} from headers, footers or text boxes do not appear above. They were on the page; the parser never saw them.
        </p>
      ) : null}
    </div>
  );
}

function Scrubber({ doc, report, lost, scrambled, lostFocus, compact, pages }: { doc: Pick<ParsedResume, 'lines'>; report: Pick<ParseReport, 'atsLines'>; lost: Set<string>; scrambled: Set<string>; lostFocus: boolean; compact?: boolean; pages: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.56);
  const clip = useTransform(x, (v) => `inset(0 0 0 ${v * 100}%)`);
  const left = useTransform(x, (v) => `${v * 100}%`);
  const dragging = useRef(false);
  const setFromEvent = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width)));
  };
  return (
    <div
      ref={ref}
      className="relative select-none overflow-hidden rounded-r2 border border-line shadow-2"
      style={{ aspectRatio: pages > 1 ? '8.5 / 12.4' : '8.5 / 11' }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setFromEvent(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromEvent(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <div className="absolute inset-0 overflow-hidden">
        <Facsimile lines={doc.lines} lost={lost} scrambled={scrambled} lostFocus={lostFocus} pages={1} compact={compact} className="[&>div]:rounded-none [&>div]:shadow-none" />
      </div>
      <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
        <MachineText report={report} lost={lost} className="h-full rounded-none border-0" compact={compact} />
      </motion.div>
      <motion.div
        role="slider"
        aria-label="Reveal the parser view"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(x.get() * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') x.set(Math.max(0.03, x.get() - 0.04));
          if (e.key === 'ArrowRight') x.set(Math.min(0.97, x.get() + 0.04));
        }}
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 cursor-ew-resize bg-accent shadow-[0_0_10px_var(--accent-glow)] focus-visible:outline-none"
        style={{ left }}
      >
        <span className="num absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-r1 border border-accent bg-bg px-2 py-1 text-[10px] uppercase tracking-wider text-accent shadow-2">
          ◂ you · parser ▸
        </span>
      </motion.div>
    </div>
  );
}
