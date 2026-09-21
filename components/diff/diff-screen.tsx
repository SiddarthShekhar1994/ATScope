'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTransitionRouter } from 'next-view-transitions';
import type { ParsedResume } from '@/lib/parse/types';
import type { Analysis } from '@/lib/schema/analysis';
import type { Rewrite } from '@/lib/schema/rewrite';
import { useLiveScore } from '@/lib/rewrite/client';
import { persistRewriteState } from '@/app/actions/analysis';
import { useUnsavedGuard } from '@/lib/hooks/use-unsaved-guard';
import { usePaletteCommands } from '@/components/palette/registry';
import { useToast } from '@/components/ui/toast';
import { FlowNav } from '@/components/report/flow-nav';
import { EngineReadouts } from '@/components/report/engine-readouts';
import { Count } from '@/components/ui/count';
import { Button, ButtonLink } from '@/components/ui/button';
import { Kbd, Readout } from '@/components/ui/primitives';
import { IconArrowRight, IconKeyboard } from '@/components/ui/icons';
import { DiffRow } from './diff-row';
import { PlaceholderPanel } from './placeholder-panel';
import { ChangeLog } from './change-log';
import { cn } from '@/lib/cn';

/**
 * Side-by-side rewrite review. Original left, rewrite right, each change a row
 * with accept/reject; keyboard j/k/a/r; the score re-computes on every action
 * with the same engine. Placeholders are filled in a side panel and block
 * export until they are.
 */
export function DiffScreen({ doc, analysis, rewrite }: { doc: ParsedResume; analysis: Analysis; rewrite: Rewrite }) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() => Object.fromEntries(rewrite.diffs.map((h) => [h.id, h.accepted])));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(rewrite.placeholders.filter((p) => p.value).map((p) => [p.id, p.value!])));
  const [cursor, setCursor] = useState(0);
  const [sweep, setSweep] = useState<string | null>(null);
  const [panel, setPanel] = useState<'fill' | 'changes' | 'notes'>('fill');
  const [focusPh, setFocusPh] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const live = useLiveScore(doc, analysis, rewrite, accepted, values);
  const toast = useToast();
  const router = useTransitionRouter();

  const original = useMemo(() => new Map(doc.lines.map((l) => [l.id, l])), [doc.lines]);
  const rewriteLines = useMemo(() => new Map(rewrite.lines.map((l) => [l.id, l])), [rewrite.lines]);
  const changes = useMemo(() => rewrite.diffs.filter((h) => h.kind !== 'same'), [rewrite.diffs]);
  const changeIndex = useMemo(() => new Map(changes.map((h, i) => [h.id, i])), [changes]);
  const acceptedCount = changes.filter((h) => accepted[h.id]).length;

  // Persist after a pause; the guard warns while a save is pending.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = useCallback(
    (nextAccepted: Record<string, boolean>, nextValues: Record<string, string>) => {
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await persistRewriteState(analysis.id, { accepted: nextAccepted, placeholders: nextValues });
        setDirty(false);
      }, 600);
    },
    [analysis.id],
  );
  useUnsavedGuard(dirty);

  const setHunk = useCallback(
    (id: string, value: boolean, withSweep = true) => {
      setAccepted((a) => {
        const next = { ...a, [id]: value };
        schedulePersist(next, values);
        return next;
      });
      if (value && withSweep) {
        setSweep(id);
        setTimeout(() => setSweep((s) => (s === id ? null : s)), 560);
      }
    },
    [schedulePersist, values],
  );
  const setAll = useCallback(
    (value: boolean) => {
      const prev = accepted;
      const next = Object.fromEntries(rewrite.diffs.map((h) => [h.id, h.kind === 'same' ? true : value]));
      setAccepted(next);
      schedulePersist(next, values);
      toast({
        title: value ? `Accepted all ${changes.length} changes` : `Rejected all ${changes.length} changes`,
        tone: 'neutral',
        undo: {
          onUndo: () => {
            setAccepted(prev);
            schedulePersist(prev, values);
          },
        },
      });
    },
    [accepted, rewrite.diffs, changes.length, schedulePersist, values, toast],
  );
  const setValue = useCallback(
    (id: string, v: string) => {
      setValues((vals) => {
        const next = { ...vals, [id]: v };
        schedulePersist(accepted, next);
        return next;
      });
    },
    [accepted, schedulePersist],
  );

  // Rows: hunks in order, virtualized.
  const parentRef = useRef<HTMLDivElement>(null);
  const wasScrolling = useRef(false);
  const virtualizer = useVirtualizer({
    count: rewrite.diffs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rewrite.diffs[i].kind === 'same' ? 28 * Math.max(1, rewrite.diffs[i].rewriteLineIds.length) : 84),
    overscan: 30,
    onChange: (inst) => {
      if (wasScrolling.current && !inst.isScrolling) requestAnimationFrame(() => parentRef.current?.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => inst.measureElement(el)));
      wasScrolling.current = inst.isScrolling;
    },
  });
  const cursorHunk = changes[cursor];
  useEffect(() => {
    if (!cursorHunk) return;
    const idx = rewrite.diffs.findIndex((h) => h.id === cursorHunk.id);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // Keyboard: j/k move, a accept, r reject, Enter toggle, A accept all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(changes.length - 1, c + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'a' && cursorHunk) setHunk(cursorHunk.id, true);
      else if (e.key === 'r' && cursorHunk) setHunk(cursorHunk.id, false);
      else if (e.key === 'Enter' && cursorHunk) setHunk(cursorHunk.id, !accepted[cursorHunk.id]);
      else if (e.key === 'A' && e.shiftKey) setAll(true);
      else if (e.key === 'f') {
        setPanel('fill');
        document.getElementById('placeholder-panel')?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changes.length, cursorHunk, accepted, setHunk, setAll]);

  usePaletteCommands(
    'diff',
    [
      { id: 'accept-all', label: 'Accept all changes', group: 'Rewrite', shortcut: '⇧A', run: () => setAll(true) },
      { id: 'reject-all', label: 'Reject all changes', group: 'Rewrite', run: () => setAll(false) },
      { id: 'panel-fill', label: 'Show fill-in fields', group: 'Rewrite', shortcut: 'F', run: () => setPanel('fill') },
      { id: 'panel-changes', label: 'Show what changed and why', group: 'Rewrite', run: () => setPanel('changes') },
      { id: 'go-export', label: 'Go to export', group: 'Next', run: () => router.push(`/report/${analysis.id}/export`) },
    ],
    [setAll, analysis.id],
  );

  const items = virtualizer.getVirtualItems();
  const originalScore = analysis.overallScore ?? 0;
  const gainNow = live.current.overallScore - originalScore;

  return (
    <div className="flex flex-col">
      <FlowNav id={analysis.id} current="diff" hasRewrite fileName={doc.fileName} score={analysis.overallScore} projected={live.projected.overallScore} />
      <div className="container-x flex flex-col gap-4 py-5">
        <div className="panel flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="t-label">Score now</p>
              <p className="num mt-1 flex items-baseline gap-2 text-3xl leading-none text-fg">
                <Count value={live.current.overallScore} spring="tick" />
                <span className={cn('text-sm', gainNow >= 0 ? 'text-good' : 'text-bad')}>
                  {gainNow >= 0 ? '+' : ''}
                  {gainNow} vs {originalScore}
                </span>
              </p>
            </div>
            <Readout label="with fill-ins" value={<Count value={live.projected.overallScore} spring="tick" />} tone={live.projected.overallScore >= 89 ? 'good' : 'accent'} hint="Score once every placeholder is filled" />
            <Readout label="accepted" value={`${acceptedCount}/${changes.length}`} />
            <Readout label="fill-ins left" value={live.unfilledCount} tone={live.unfilledCount ? 'accent' : 'good'} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setAll(true)}>
              Accept all
            </Button>
            <Button variant="ghost" onClick={() => setAll(false)}>
              Reject all
            </Button>
            <ButtonLink href={`/report/${analysis.id}/export`} variant="primary">
              Export <IconArrowRight />
            </ButtonLink>
          </div>
        </div>
        {rewrite.aiUsed ? null : (
          <p className="rounded-r2 border border-line bg-bg-1 px-3 py-2 text-xs text-fg-1">
            <span className="t-label mr-2">rule-based rewrite</span>
            No model key was configured, so bullets were rewritten by rules: weak openers removed, verbs first, every missing number and result turned into a fill-in field. Set <code className="num">AI_MODEL</code> and an API key for model-written prose. Every number below still comes from the engine.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <div className="mb-2 grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center text-xs">
              <p className="t-label px-2">Original · {doc.fileName}</p>
              <span />
              <p className="t-label px-2">Rewrite · single column</p>
            </div>
            <div ref={parentRef} className="relative h-[min(72dvh,900px)] overflow-y-auto overscroll-contain rounded-r2 border border-line bg-bg" role="list" aria-label="Changes" tabIndex={0}>
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {items.map((vi) => {
                  const h = rewrite.diffs[vi.index];
                  const ci = changeIndex.get(h.id);
                  return (
                    <DiffRow
                      key={h.id}
                      ref={virtualizer.measureElement}
                      data-index={vi.index}
                      style={{ transform: `translateY(${vi.start}px)` }}
                      hunk={h}
                      index={ci ?? vi.index}
                      original={original}
                      rewrite={rewriteLines}
                      placeholders={rewrite.placeholders}
                      values={values}
                      accepted={accepted[h.id] ?? h.accepted}
                      isCursor={ci !== undefined && ci === cursor}
                      sweeping={sweep === h.id}
                      onAccept={() => setHunk(h.id, true)}
                      onReject={() => setHunk(h.id, false)}
                      onSelect={() => ci !== undefined && setCursor(ci)}
                      onFocusPlaceholder={(id) => {
                        setPanel('fill');
                        setFocusPh(id);
                      }}
                      gutter={44}
                    />
                  );
                })}
              </div>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-2">
              <IconKeyboard size={14} />
              <span>
                <Kbd>j</Kbd> <Kbd>k</Kbd> move
              </span>
              <span>
                <Kbd>a</Kbd> accept
              </span>
              <span>
                <Kbd>r</Kbd> reject
              </span>
              <span>
                <Kbd>⇧A</Kbd> accept all
              </span>
              <span>
                <Kbd>f</Kbd> fill-ins
              </span>
            </p>
          </div>
          <aside className="flex min-w-0 flex-col gap-3 xl:col-span-4">
            <div role="tablist" aria-label="Side panels" className="flex gap-1 border-b border-line">
              {(
                [
                  ['fill', `Fill-ins${live.unfilledCount ? ` (${live.unfilledCount})` : ''}`],
                  ['changes', 'What changed'],
                  ['notes', 'Verifier notes'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" type="button" aria-selected={panel === id} onClick={() => setPanel(id)} className={cn('hit relative -mb-px px-3 py-2 text-sm', panel === id ? 'text-fg' : 'text-fg-2 hover:text-fg-1')}>
                  {label}
                  {panel === id ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-accent" /> : null}
                </button>
              ))}
            </div>
            {panel === 'fill' ? <PlaceholderPanel rewrite={rewrite} values={values} accepted={accepted} onChange={setValue} focusId={focusPh} onFocused={() => setFocusPh(null)} /> : null}
            {panel === 'changes' ? (
              <ChangeLog
                hunks={changes}
                accepted={accepted}
                onJump={(id) => {
                  const ci = changeIndex.get(id);
                  if (ci !== undefined) setCursor(ci);
                }}
              />
            ) : null}
            {panel === 'notes' ? (
              <div className="panel-2 flex flex-col gap-3 p-3 text-sm">
                <p className="t-label">Iterations: {rewrite.iterations}</p>
                <ul className="flex flex-col gap-2 text-fg-1">
                  {rewrite.notes.length === 0 ? <li className="text-fg-2">Nothing had to be corrected.</li> : null}
                  {rewrite.notes.map((n, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-fg-3">›</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-fg-2">Every number in the rewrite was checked against the original; unsupported ones became fill-in fields. Tools the original never mentions were rejected.</p>
              </div>
            ) : null}
            <div>
              <p className="t-label mb-2">Engines now</p>
              <EngineReadouts engines={live.current.perEngineScores} compact compare={analysis.perEngineScores} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
