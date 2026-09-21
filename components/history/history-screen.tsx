'use client';

import { useMemo, useState } from 'react';
import { Link } from 'next-view-transitions';
import type { HistoryEntry } from '@/lib/store/analyses';
import type { Analysis } from '@/lib/schema/analysis';
import { CATEGORY_META, type CategoryId } from '@/lib/score/types';
import { Checkbox, Readout } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { Count } from '@/components/ui/count';
import { cn } from '@/lib/cn';

/**
 * Every run in this session (and saved ones when signed in). Pick two to see
 * the score delta per category and per engine.
 */
export function HistoryScreen({ entries, analyses }: { entries: HistoryEntry[]; analyses: Record<string, Analysis | null> }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  const [a, b] = picked.map((id) => analyses[id]).filter(Boolean) as Analysis[];
  const cats = useMemo(() => (Object.keys(CATEGORY_META) as CategoryId[]).sort((x, y) => CATEGORY_META[x].order - CATEGORY_META[y].order), []);

  if (entries.length === 0) {
    return (
      <div className="container-x flex min-h-[60dvh] flex-col items-start justify-center gap-4 py-16">
        <p className="t-label">History</p>
        <h1 className="t-display text-3xl text-fg">No runs yet.</h1>
        <p className="max-w-md text-fg-1">Every scan you run in this browser shows up here for seven days. Sign in on the export screen to keep versions longer.</p>
        <ButtonLink href="/upload" variant="primary">
          Scan a resume
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="container-x grid grid-cols-1 gap-8 py-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="t-label">History</p>
        <h1 className="t-display mt-2 text-2xl text-fg sm:text-3xl">Runs and versions</h1>
        <p className="mt-2 text-sm text-fg-1">Tick two to compare. Scores come from the engine; nothing is re-estimated.</p>
        <ol className="mt-5 flex flex-col gap-2" aria-label="Analysis runs">
          {entries.map((e) => {
            const selected = picked.includes(e.id);
            return (
              <li key={e.id} className={cn('panel flex items-center gap-3 p-3', selected && 'border-accent')}>
                <label className="flex cursor-pointer items-center">
                  <Checkbox checked={selected} onChange={() => toggle(e.id)} aria-label={`Select ${e.fileName} for comparison`} />
                </label>
                <div className="min-w-0 flex-1">
                  <Link href={`/report/${e.id}`} className="hit block truncate rounded-r1 font-medium text-fg hover:underline">
                    {e.fileName}
                  </Link>
                  <p className="num mt-0.5 text-xs text-fg-2">
                    {new Date(e.createdAt).toLocaleString()} {e.targetLabel ? `· ${e.targetLabel}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Readout label="score" value={e.score ?? '—'} tone={e.score === undefined ? 'muted' : e.score >= 85 ? 'good' : e.score >= 60 ? 'accent' : 'bad'} />
                  <Readout label="rewrite" value={e.rewriteScore ?? '—'} tone={e.rewriteScore ? 'good' : 'muted'} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="lg:col-span-5">
        <div className="panel sticky top-[72px] p-5">
          <p className="t-label">Compare</p>
          {a && b ? (
            <>
              <div className="mt-3 grid grid-cols-3 items-end gap-2">
                <div>
                  <p className="truncate text-xs text-fg-2" title={a.fileName}>
                    {a.fileName}
                  </p>
                  <p className="num text-2xl text-fg">{a.overallScore}</p>
                </div>
                <div className="text-center">
                  <p className="t-label">delta</p>
                  <p className={cn('num text-2xl', (b.overallScore ?? 0) - (a.overallScore ?? 0) >= 0 ? 'text-good' : 'text-bad')}>
                    <Count value={(b.overallScore ?? 0) - (a.overallScore ?? 0)} prefix={(b.overallScore ?? 0) - (a.overallScore ?? 0) >= 0 ? '+' : ''} />
                  </p>
                </div>
                <div className="text-right">
                  <p className="truncate text-xs text-fg-2" title={b.fileName}>
                    {b.fileName}
                  </p>
                  <p className="num text-2xl text-fg">{b.overallScore}</p>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-1.5">
                {cats.map((id) => {
                  const ca = a.categories.find((c) => c.id === id)?.score ?? 0;
                  const cb = b.categories.find((c) => c.id === id)?.score ?? 0;
                  return (
                    <li key={id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm">
                      <span className="truncate text-fg-1">{CATEGORY_META[id].label}</span>
                      <span className="num text-fg-2">{ca}</span>
                      <span className={cn('num w-10 text-right', cb - ca > 0 ? 'text-good' : cb - ca < 0 ? 'text-bad' : 'text-fg-3')}>{cb - ca > 0 ? `+${cb - ca}` : cb - ca}</span>
                      <span className="num text-fg">{cb}</span>
                    </li>
                  );
                })}
              </ul>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {(a.perEngineScores ?? []).map((e) => {
                  const other = b.perEngineScores?.find((x) => x.engine === e.engine)?.score ?? 0;
                  return (
                    <li key={e.engine} className="readout">
                      <p className="t-label">{e.label}</p>
                      <p className="num mt-1 text-sm text-fg">
                        {e.score} → {other} <span className={cn('text-xs', other - e.score >= 0 ? 'text-good' : 'text-bad')}>{other - e.score >= 0 ? `+${other - e.score}` : other - e.score}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-fg-2">Select two runs on the left to see per-category and per-engine deltas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
