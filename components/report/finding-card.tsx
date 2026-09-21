'use client';

import type { AnalysisFinding } from '@/lib/schema/analysis';
import { Severity } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

/**
 * One finding: the exact quote, where it is, what it costs, why, and the fix.
 * Clicking scrolls the resume pane to the line.
 */
export function FindingCard({ finding, active, onSelect, compact }: { finding: AnalysisFinding; active?: boolean; onSelect?: (f: AnalysisFinding) => void; compact?: boolean }) {
  const f = finding;
  return (
    <article className={cn('panel-2 transition-colors', active ? 'border-accent bg-bg-3' : 'hover:border-line-strong', compact ? 'p-3' : 'p-4')} aria-current={active ? 'true' : undefined} id={`finding-${f.id}`}>
      <button type="button" onClick={() => onSelect?.(f)} className="flex w-full flex-wrap items-center gap-2 text-left" aria-label={`Show line ${f.lineRef} in the resume`}>
        <Severity level={f.severity} />
        <span className="num text-xs text-fg-2">{f.lineRef}</span>
        {f.relatedLineRefs?.length ? <span className="num text-[10px] text-fg-3">+{f.relatedLineRefs.length} more</span> : null}
        <span className="num ml-auto text-sm text-bad" title="Points this costs inside its category">
          −{f.pointCost}
        </span>
      </button>
      <blockquote className="num mt-2 border-l-2 border-line-strong pl-3 text-sm text-fg" onClick={() => onSelect?.(f)}>
        “{f.quote}”
      </blockquote>
      <p className="mt-2 text-sm text-fg-1">{f.explanation}</p>
      <div className="mt-3 rounded-r1 border border-line bg-bg-1 p-2.5">
        <p className="t-label mb-1 flex items-center gap-2">
          Fix
          {f.fixByModel ? <span className="rounded-r0 border border-[rgba(242,179,61,0.3)] bg-accent-dim px-1 text-[9px] text-accent">model-written</span> : null}
        </p>
        <p className={cn('text-sm text-fg', f.fixKind === 'rewrite-line' && f.fixByModel && 'num')}>{f.fix}</p>
      </div>
    </article>
  );
}
