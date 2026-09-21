'use client';

import { useMemo } from 'react';
import type { ParsedResume } from '@/lib/parse/types';
import type { FeedState } from '@/lib/analysis/client';
import { ScanPane, type LineMark } from './scan-pane';
import { FindingsDock } from './findings-dock';
import { StageStrip, formatMs } from './stage-strip';
import { ScoreRing } from '@/components/report/score-ring';
import { Readout } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export function marksFromFeed(state: FeedState): Record<string, LineMark> {
  const marks: Record<string, LineMark> = {};
  const rank = { high: 3, medium: 2, low: 1 } as const;
  for (const a of state.arrivals) {
    // Missing-keyword findings anchor to the skills line for citation; they are not defects of that line.
    if (a.finding.ruleId === 'missing-keyword') continue;
    const refs = [a.finding.lineRef];
    for (const id of refs) {
      const cur = marks[id];
      if (!cur) marks[id] = { severity: a.finding.severity, count: 1, categoryIds: [a.categoryId] };
      else marks[id] = { severity: rank[a.finding.severity] > rank[cur.severity] ? a.finding.severity : cur.severity, count: cur.count + 1, categoryIds: [...new Set([...cur.categoryIds, a.categoryId])] };
    }
  }
  return marks;
}

/**
 * The analyzing screen. Everything on it is driven by the event feed: the scan
 * line follows the newest finding, the dock fills in arrival order, the stage
 * strip shows measured durations, and the ring stays blank until the aggregate
 * event actually arrives.
 */
export function AnalyzeScreen({ doc, state, compact, modelAvailable, onSelect, activeId, className, caption }: { doc: ParsedResume; state: FeedState; compact?: boolean; modelAvailable?: boolean; onSelect?: (findingId: string, lineRef: string) => void; activeId?: string | null; className?: string; caption?: React.ReactNode }) {
  const marks = useMemo(() => marksFromFeed(state), [state]);
  const last = state.arrivals[state.arrivals.length - 1];
  const a = state.analysis;
  const lostLines = doc.lines.filter((l) => l.source !== 'body' && l.source !== 'table').length;
  return (
    <div className={cn('flex flex-col gap-3', className)} style={{ viewTransitionName: 'doc-panel' } as React.CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="t-label">{state.done ? 'Analysis complete' : 'Analyzing'}</p>
          <p className={cn('truncate font-medium text-fg', compact ? 'text-sm' : 'text-base')}>
            {doc.fileName} <span className="text-fg-2">· {a.target.label}</span>
          </p>
        </div>
        <div className="num flex items-center gap-2 text-xs text-fg-1">
          <span className="t-label">elapsed</span>
          <span className={cn('text-fg', compact ? 'text-sm' : 'text-md')}>{formatMs(state.elapsedMs)}</span>
        </div>
      </div>
      <StageStrip state={state} compact={compact} modelAvailable={modelAvailable} />
      <div className={cn('grid gap-3', compact ? 'grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]')}>
        <ScanPane lines={doc.lines} marks={marks} scanTo={last?.finding.lineRef ?? null} activeLineId={activeId ? state.arrivals.find((x) => x.finding.id === activeId)?.finding.lineRef : null} compact={compact} scanning={!state.done} className={compact ? 'h-[360px]' : 'h-[min(70dvh,760px)] min-h-[420px]'} ariaLabel="Resume being scanned" />
        <div className="flex min-h-0 flex-col gap-3">
          <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-3')}>
            <Readout label="findings" value={state.arrivals.length} tone={state.arrivals.length ? 'default' : 'muted'} />
            <Readout label="lines" value={doc.lines.length} hint={`${lostLines} invisible to parsers`} />
            <Readout label="lost" value={lostLines} tone={lostLines ? 'bad' : 'good'} hint="Lines a parser never reads" />
          </div>
          <FindingsDock arrivals={state.arrivals} onSelect={onSelect} activeId={activeId} compact={compact} className={compact ? 'h-[210px]' : 'min-h-0 flex-1 max-h-[calc(min(70dvh,760px)-200px)]'} />
          <div className="flex items-center gap-3 rounded-r2 border border-line bg-bg-2 p-2">
            <ScoreRing score={a.overallScore} size={compact ? 64 : 84} stroke={compact ? 5 : 7} label="" showBand={false} />
            <div className="min-w-0 text-xs text-fg-1">
              {a.overallScore === undefined ? (
                <>
                  <p className="text-fg">Score pending</p>
                  <p>Computed only when every category has resolved.</p>
                </>
              ) : (
                <>
                  <p className="text-fg">
                    <span className="num">{a.overallScore}</span> / 99 · {a.scoreBand === 'filtered' ? 'likely filtered out' : a.scoreBand}
                  </p>
                  <p>
                    {a.perEngineScores?.map((e) => (
                      <span key={e.engine} className="num mr-2">
                        {e.label} {e.score}
                      </span>
                    ))}
                  </p>
                </>
              )}
            </div>
          </div>
          {caption}
        </div>
      </div>
    </div>
  );
}
