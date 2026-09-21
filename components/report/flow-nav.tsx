'use client';

import { Link } from 'next-view-transitions';
import { cn } from '@/lib/cn';
import { IconChevron, IconLock } from '@/components/ui/icons';

export type FlowStep = 'report' | 'plan' | 'diff' | 'export';

/**
 * The four-step strip across the top of the report pages. Steps unlock in
 * order; locked steps say why.
 */
export function FlowNav({ id, current, hasRewrite, fileName, score, projected }: { id: string; current: FlowStep; hasRewrite: boolean; fileName: string; score?: number; projected?: number }) {
  const steps: { id: FlowStep; label: string; href: string; locked?: string }[] = [
    { id: 'report', label: 'Report', href: `/report/${id}` },
    { id: 'plan', label: 'Plan', href: `/report/${id}/plan` },
    { id: 'diff', label: 'Rewrite', href: `/report/${id}/diff`, locked: hasRewrite ? undefined : 'Run the plan first' },
    { id: 'export', label: 'Export', href: `/report/${id}/export`, locked: hasRewrite ? undefined : 'Run the plan first' },
  ];
  return (
    <div className="border-b border-line bg-bg">
      <div className="container-x flex h-12 items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <span className="num truncate text-xs text-fg-2" title={fileName}>
            {fileName}
          </span>
          {score !== undefined ? (
            <span className="num hidden text-xs text-fg-1 sm:inline">
              {score}
              {projected !== undefined ? <span className="text-fg-2"> → {projected}</span> : null}
            </span>
          ) : null}
        </div>
        <nav aria-label="Steps">
          <ol className="flex items-center gap-1">
            {steps.map((s, i) => {
              const active = s.id === current;
              const inner = (
                <>
                  <span className="num text-[10px] text-fg-3">{i + 1}</span>
                  <span>{s.label}</span>
                  {s.locked ? <IconLock size={11} className="text-fg-3" /> : null}
                </>
              );
              return (
                <li key={s.id} className="flex items-center">
                  {i > 0 ? <IconChevron size={12} className="mx-0.5 text-fg-3" aria-hidden /> : null}
                  {s.locked ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-r1 px-2 text-xs text-fg-3" title={s.locked} aria-disabled="true">
                      {inner}
                    </span>
                  ) : (
                    <Link href={s.href} aria-current={active ? 'step' : undefined} className={cn('hit inline-flex h-8 items-center gap-1.5 rounded-r1 px-2 text-xs', active ? 'bg-bg-2 text-fg' : 'text-fg-1 hover:bg-bg-2 hover:text-fg')}>
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
