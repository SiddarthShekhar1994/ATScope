'use client';

import type { Hunk } from '@/lib/schema/rewrite';
import { cn } from '@/lib/cn';
import { IconCheck, IconX } from '@/components/ui/icons';

/**
 * "What changed and why": one sentence per change, grouped by section, with
 * its accept state. Clicking jumps the diff cursor to that change.
 */
export function ChangeLog({ hunks, accepted, onJump }: { hunks: Hunk[]; accepted: Record<string, boolean>; onJump: (id: string) => void }) {
  const sections = [...new Set(hunks.map((h) => h.section))];
  return (
    <div className="flex flex-col gap-3">
      {sections.map((s) => {
        const list = hunks.filter((h) => h.section === s);
        return (
          <section key={s} className="panel-2 p-3">
            <h3 className="t-label mb-2">
              {s} <span className="text-fg-3">· {list.length}</span>
            </h3>
            <ol className="flex flex-col gap-1.5">
              {list.map((h) => {
                const on = accepted[h.id] ?? h.accepted;
                return (
                  <li key={h.id}>
                    <button type="button" onClick={() => onJump(h.id)} className="flex w-full items-start gap-2 rounded-r1 text-left text-xs hover:bg-bg-3">
                      <span className={cn('mt-0.5 shrink-0', on ? 'text-good' : 'text-fg-3')} aria-label={on ? 'accepted' : 'rejected'}>
                        {on ? <IconCheck size={12} /> : <IconX size={12} />}
                      </span>
                      <span className={cn('min-w-0', on ? 'text-fg-1' : 'text-fg-3 line-through')}>
                        <span className="num mr-1 text-fg-3">{h.kind}</span>
                        {h.reason}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
