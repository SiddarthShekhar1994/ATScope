'use client';

import { type ReactNode, type HTMLAttributes, forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { IconCheck, IconLock } from './icons';

/** Instrument readout: mono label above a mono value. */
export function Readout({ label, value, unit, tone = 'default', className, hint }: { label: string; value: ReactNode; unit?: string; tone?: 'default' | 'accent' | 'good' | 'bad' | 'muted'; className?: string; hint?: string }) {
  const toneCls = tone === 'accent' ? 'text-accent' : tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'muted' ? 'text-fg-2' : 'text-fg';
  return (
    <div className={cn('readout flex min-w-0 flex-col gap-1', className)} title={hint}>
      <span className="t-label leading-tight">{label}</span>
      <span className={cn('num text-md leading-none', toneCls)}>
        {value}
        {unit ? <span className="ml-0.5 text-xs text-fg-2">{unit}</span> : null}
      </span>
    </div>
  );
}

/** Keyword / status chip. Status is conveyed with an icon or glyph plus text, never colour alone. */
export function Chip({ children, state = 'neutral', className, onClick, title, count }: { children: ReactNode; state?: 'neutral' | 'present' | 'missing' | 'overused' | 'accent'; className?: string; onClick?: () => void; title?: string; count?: number }) {
  const styles: Record<string, string> = {
    neutral: 'border-line text-fg-1 bg-bg-2',
    present: 'border-[rgba(155,207,106,0.3)] text-good bg-good-dim',
    missing: 'border-line-strong text-fg-1 bg-transparent [border-style:dashed]',
    overused: 'border-[rgba(229,101,79,0.3)] text-bad bg-bad-dim',
    accent: 'border-[rgba(242,179,61,0.35)] text-accent bg-accent-dim',
  };
  const glyph = state === 'present' ? '✓' : state === 'missing' ? '–' : state === 'overused' ? '×' : '';
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={cn('num inline-flex h-7 items-center gap-1.5 rounded-r1 border px-2 text-xs leading-none transition-colors', styles[state], onClick && 'cursor-pointer hover:border-line-strong hover:text-fg', className)}
    >
      {glyph ? <span aria-hidden>{glyph}</span> : null}
      <span className="sr-only">{state === 'present' ? 'present: ' : state === 'missing' ? 'missing: ' : state === 'overused' ? 'overused: ' : ''}</span>
      {children}
      {count !== undefined ? <span className="text-fg-2">×{count}</span> : null}
    </Comp>
  );
}

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="num inline-flex h-5 min-w-5 items-center justify-center rounded-r0 border border-line-strong bg-bg-3 px-1 text-[11px] text-fg-1 shadow-[0_1px_0_rgba(0,0,0,.5)]">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** Custom checkbox with a visible focus ring; the lock state shows why an item cannot change. */
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { locked?: boolean }>(function Checkbox({ className, locked, checked, ...rest }, ref) {
  return (
    <span className={cn('relative inline-flex h-6 w-6 shrink-0 items-center justify-center', className)}>
      <input ref={ref} type="checkbox" checked={checked} className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-r1 border border-line-strong bg-bg-2 transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-70" {...rest} />
      <span className="pointer-events-none relative text-accent-ink opacity-0 transition-opacity peer-checked:opacity-100">{locked ? <IconLock size={12} /> : <IconCheck size={12} strokeWidth={2.2} />}</span>
    </span>
  );
});

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line', className)} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('t-label', className)}>{children}</p>;
}

/** Severity badge, colour + glyph + word. */
export function Severity({ level }: { level: 'high' | 'medium' | 'low' }) {
  const map = {
    high: { cls: 'text-bad border-[rgba(229,101,79,0.35)] bg-bad-dim', glyph: '▲', word: 'high' },
    medium: { cls: 'text-accent border-[rgba(242,179,61,0.35)] bg-accent-dim', glyph: '■', word: 'medium' },
    low: { cls: 'text-fg-1 border-line-strong bg-bg-2', glyph: '●', word: 'low' },
  }[level];
  return (
    <span className={cn('num inline-flex h-5 items-center gap-1 rounded-r0 border px-1.5 text-[10px] uppercase tracking-wider', map.cls)}>
      <span aria-hidden className="text-[8px]">
        {map.glyph}
      </span>
      {map.word}
    </span>
  );
}
