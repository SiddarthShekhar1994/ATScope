'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import type { ParsedResume, ResumeLine } from '@/lib/parse/types';
import type { Analysis, AnalysisFinding } from '@/lib/schema/analysis';
import type { Rewrite } from '@/lib/schema/rewrite';
import { CATEGORY_META } from '@/lib/score/types';
import { useUrlState } from '@/lib/hooks/use-url-state';
import { usePaletteCommands } from '@/components/palette/registry';
import { ScoreRing } from './score-ring';
import { CategoryBars } from './category-bars';
import { EngineReadouts } from './engine-readouts';
import { AtsView } from './ats-view';
import { KeywordMapView } from './keyword-map';
import { BulletMeter } from './bullet-meter';
import { FlowNav } from './flow-nav';
import { ScanPane, type LineMark } from '@/components/analyze/scan-pane';
import { ButtonLink } from '@/components/ui/button';
import { Readout } from '@/components/ui/primitives';
import { IconArrowRight } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

type Tab = 'resume' | 'ats' | 'keywords' | 'bullets';
const TABS: { id: Tab; label: string }[] = [
  { id: 'resume', label: 'Resume' },
  { id: 'ats', label: 'ATS view' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'bullets', label: 'Bullets' },
];
const DEFAULTS = { tab: 'resume', cat: '', f: '', term: '' } as const;

/**
 * The report. Left: score, engines, six category bars that expand into
 * findings. Right: the resume pane (and ATS view, keyword map, bullet meter)
 * kept in sync — click a finding and the line lights up; click a line and its
 * finding opens. URL carries tab, category and finding for deep links.
 */
export function ReportScreen({ doc, analysis, rewrite, readOnly }: { doc: ParsedResume; analysis: Analysis; rewrite: Rewrite | null; readOnly?: boolean }) {
  const [url, setUrl] = useUrlState<{ tab: string; cat: string; f: string; term: string }>(DEFAULTS);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const router = useTransitionRouter();
  const tab = (TABS.some((t) => t.id === url.tab) ? url.tab : 'resume') as Tab;
  const findings = useMemo(() => analysis.categories.flatMap((c) => c.findings), [analysis.categories]);
  const active = findings.find((f) => f.id === url.f) ?? null;
  const activeTerm = url.term || null;
  const termLines = useMemo(() => {
    if (!activeTerm || !analysis.keywordMap) return new Set<string>();
    const hit = analysis.keywordMap.present.find((k) => k.term === activeTerm) ?? analysis.keywordMap.overused.find((k) => k.term === activeTerm);
    return new Set(hit?.lineRefs ?? []);
  }, [activeTerm, analysis.keywordMap]);

  const marks = useMemo(() => {
    const m: Record<string, LineMark> = {};
    const rank = { high: 3, medium: 2, low: 1 } as const;
    for (const f of findings) {
      if (f.ruleId === 'missing-keyword') continue;
      const cur = m[f.lineRef];
      if (!cur) m[f.lineRef] = { severity: f.severity, count: 1, categoryIds: [f.categoryId] };
      else m[f.lineRef] = { severity: rank[f.severity] > rank[cur.severity] ? f.severity : cur.severity, count: cur.count + 1, categoryIds: [...new Set([...cur.categoryIds, f.categoryId])] };
    }
    for (const id of termLines) if (!m[id]) m[id] = { severity: 'low', count: 0, categoryIds: ['keywords'] };
    return m;
  }, [findings, termLines]);

  const selectFinding = useCallback(
    (f: AnalysisFinding) => {
      setUrl({ f: f.id, cat: f.categoryId, tab: tab === 'ats' || tab === 'resume' ? tab : 'resume', term: '' }, 'push');
    },
    [setUrl, tab],
  );
  const selectLine = useCallback(
    (line: ResumeLine) => {
      const onLine = findings.filter((f) => f.lineRef === line.id || f.relatedLineRefs?.includes(line.id)).sort((a, b) => b.pointCost - a.pointCost);
      if (onLine[0]) {
        setUrl({ f: onLine[0].id, cat: onLine[0].categoryId }, 'push');
        requestAnimationFrame(() => document.getElementById(`finding-${onLine[0].id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      }
    },
    [findings, setUrl],
  );

  usePaletteCommands(
    'report',
    [
      ...TABS.map((t) => ({ id: `tab-${t.id}`, label: `Show ${t.label}`, group: 'Report', run: () => setUrl({ tab: t.id }) })),
      ...analysis.categories.map((c) => ({ id: `cat-${c.id}`, label: `Open ${c.label}`, hint: `${c.score}/100`, group: 'Categories', run: () => setUrl({ cat: c.id }) })),
      ...(readOnly ? [] : [{ id: 'go-plan', label: 'Build the plan', group: 'Next', shortcut: 'P', run: () => router.push(`/report/${analysis.id}/plan`) }]),
    ],
    [analysis.id, setUrl, readOnly],
  );

  const lost = doc.lines.filter((l) => l.source !== 'body' && l.source !== 'table').length;
  const highlightSet = useMemo(() => new Set([...(active ? [active.lineRef, ...(active.relatedLineRefs ?? [])] : []), ...termLines]), [active, termLines]);

  return (
    <div className="flex flex-col">
      {!readOnly ? <FlowNav id={analysis.id} current="report" hasRewrite={!!rewrite} fileName={doc.fileName} score={analysis.overallScore} projected={rewrite?.projected?.overallScore} /> : null}
      <div className="container-x grid grid-cols-1 gap-8 py-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <ScoreRing score={analysis.overallScore} size={188} id="score-ring" />
            <div className="min-w-0 flex-1">
              <p className="t-label">
                {analysis.target.source === 'jd' ? 'Against the pasted description' : analysis.target.source === 'role' ? 'Against the chosen role' : 'Against the inferred role'}
              </p>
              <p className="mt-1 text-md font-medium text-fg">{analysis.target.label}</p>
              <p className="mt-2 text-sm text-fg-1">
                {analysis.overallScore !== undefined && analysis.overallScore < 50
                  ? 'Below 50, most ranking filters never surface this profile to a recruiter.'
                  : analysis.overallScore !== undefined && analysis.overallScore < 70
                    ? 'Borderline. It parses, but keyword and impact gaps push it down the list.'
                    : analysis.overallScore !== undefined && analysis.overallScore < 85
                      ? 'Competitive. A few structural fixes and stronger bullets close the gap.'
                      : 'Strong. Parses cleanly and reads well.'}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Readout label="findings" value={findings.length} />
                <Readout label="lost" value={lost} tone={lost ? 'bad' : 'good'} />
                <Readout label="plan →" value={analysis.projectedScore !== undefined ? Math.round(analysis.projectedScore) : '—'} tone="accent" hint="If every planned change is applied" />
              </div>
            </div>
          </section>
          {analysis.perEngineScores ? <EngineReadouts engines={analysis.perEngineScores} /> : null}
          <CategoryBars categories={analysis.categories} expanded={url.cat || null} onToggle={(id) => setUrl({ cat: url.cat === id ? '' : id })} activeFindingId={active?.id} onSelectFinding={selectFinding} showAll={showAll} onShowAll={(id) => setShowAll((s) => ({ ...s, [id]: !s[id] }))} />
          {!readOnly ? (
            <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-fg">Next: the plan</p>
                <p className="text-sm text-fg-1">
                  {analysis.improvementPlan?.length ?? 0} intended changes, projected to <span className="num text-fg">{analysis.projectedScore !== undefined ? Math.round(analysis.projectedScore) : '—'}</span>. You choose which survive.
                </p>
              </div>
              <ButtonLink href={`/report/${analysis.id}/plan`} variant="primary" size="lg">
                Build the plan <IconArrowRight />
              </ButtonLink>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
          <div role="tablist" aria-label="Resume views" className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} id={`tab-${t.id}`} onClick={() => setUrl({ tab: t.id })} className={cn('hit relative -mb-px rounded-t-r1 px-3 py-2.5 text-sm', tab === t.id ? 'text-fg' : 'text-fg-2 hover:text-fg-1')}>
                {t.label}
                {tab === t.id ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-accent" /> : null}
              </button>
            ))}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-w-0">
            {tab === 'resume' ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-fg-2">
                  Lines in the order a person reads them. Marked lines carry findings; click one to open it. {lost ? `${lost} struck-through line${lost === 1 ? '' : 's'} sit in headers or footers that parsers skip.` : ''}
                </p>
                <ScanPane lines={doc.lines} marks={marks} activeLineId={active?.lineRef ?? null} onLineClick={selectLine} scanning={false} className="h-[min(78dvh,900px)]" ariaLabel="Your resume, line by line" />
              </div>
            ) : null}
            {tab === 'ats' && analysis.parseReport ? <AtsView doc={doc} report={analysis.parseReport} mode="split" highlightLineIds={highlightSet} onLineClick={selectLine} /> : null}
            {tab === 'keywords' && analysis.keywordMap ? (
              <KeywordMapView
                map={analysis.keywordMap}
                activeTerm={activeTerm}
                onPick={(term, lineRefs) => {
                  setUrl({ term: activeTerm === term ? '' : term, f: '' });
                  if (lineRefs.length) {
                    setUrl({ term, tab: 'resume', f: '' }, 'push');
                  }
                }}
              />
            ) : null}
            {tab === 'bullets' && analysis.bulletStrengths ? (
              <BulletMeter
                bullets={analysis.bulletStrengths}
                activeLineRef={active?.lineRef}
                onSelect={(lineRef) => {
                  const line = doc.lines.find((l) => l.id === lineRef);
                  if (line) {
                    selectLine(line);
                    setUrl({ tab: 'resume' });
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {active ? `Selected finding on line ${active.lineRef} in ${CATEGORY_META[active.categoryId].label}` : ''}
      </p>
    </div>
  );
}
