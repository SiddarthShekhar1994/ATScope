import type { ParsedResume } from '../parse/types';
import type { AnalysisEvent, Analysis, ParseReport, Stage } from '../schema/analysis';
import type { CategoryId, CategoryResult, ScoringContext } from '../score/types';
import { buildContext, scoreCategory, assemble } from '../score';
import { buildPlan } from '../rewrite/planner';
import { streamFixes } from '../rewrite/fixes';
import type { ModelInfo } from '../ai/model';

/**
 * The analysis pipeline as an async generator of events. Each event carries
 * the wall-clock time it was produced, so the analyzing screen animates on real
 * timings: deterministic stages resolve in milliseconds, model-written fixes
 * arrive one by one as the model produces them.
 */

const CATEGORY_SEQUENCE: { stage: Stage; id: CategoryId }[] = [
  { stage: 'structure', id: 'structure' },
  { stage: 'contact', id: 'contact' },
  { stage: 'parse-integrity', id: 'parse' },
  { stage: 'keywords', id: 'keywords' },
  { stage: 'impact', id: 'impact' },
  { stage: 'writing', id: 'writing' },
];

export function parseReportOf(doc: ParsedResume): ParseReport {
  return {
    droppedElements: doc.dropped,
    readingOrderIssues: doc.readingOrderIssues,
    atsPlainText: doc.atsPlainText,
    atsLines: doc.atsLines,
    layout: {
      pageCount: doc.layout.pageCount,
      columns: doc.layout.columns,
      singleColumn: doc.layout.singleColumn,
      tableCount: doc.layout.tableCount,
      imageCount: doc.layout.imageCount,
      textBoxCount: doc.layout.textBoxCount,
      wordCount: doc.layout.wordCount,
      fonts: doc.layout.fonts,
    },
  };
}

export interface PipelineOptions {
  jd?: string;
  roleId?: string;
  model: ModelInfo;
  signal?: AbortSignal;
}

export async function* runAnalysis(doc: ParsedResume, opts: PipelineOptions): AsyncGenerator<AnalysisEvent, Analysis> {
  const now = () => Date.now();
  const startedAt = now();
  yield { type: 'stage', stage: 'parse', at: now() };
  yield { type: 'parse', parseReport: parseReportOf(doc), at: now() };

  const ctx: ScoringContext = buildContext(doc, { jd: opts.jd, roleId: opts.roleId });
  const categories: CategoryResult[] = [];
  for (const step of CATEGORY_SEQUENCE) {
    if (opts.signal?.aborted) break;
    yield { type: 'stage', stage: step.stage, at: now() };
    const result = scoreCategory(step.id, doc, ctx);
    categories.push(result);
    yield { type: 'category', category: result, at: now() };
    for (const f of result.findings) yield { type: 'finding-resolved', findingId: f.id, at: now() };
    // Yield to the event loop so events flush individually rather than in one burst.
    await new Promise((r) => setTimeout(r, 0));
  }

  // Model-written fixes for the prose findings. Real latency, real order.
  let aiUsed = false;
  const modelFixed = new Set<string>();
  if (opts.model.available && opts.model.model && !opts.signal?.aborted) {
    yield { type: 'stage', stage: 'fixes', at: now() };
    try {
      const findings = categories.flatMap((c) => c.findings);
      for await (const fix of streamFixes(doc, findings, opts.model.model, opts.model.spec, opts.signal)) {
        aiUsed = true;
        const f = findings.find((x) => x.id === fix.findingId);
        if (f) {
          f.fix = fix.fix;
          modelFixed.add(f.id);
        }
        yield { type: 'finding-fix', findingId: fix.findingId, fix: fix.fix, at: now() };
      }
    } catch (err) {
      // A model failure never fails the analysis; template fixes stay in place.
      console.error('[analysis] fix generation failed:', (err as Error).message);
    }
  }

  yield { type: 'stage', stage: 'aggregate', at: now() };
  const ordered = ['parse', 'keywords', 'impact', 'structure', 'writing', 'contact'].map((id) => categories.find((c) => c.id === id)!).filter(Boolean);
  const score = assemble(doc, ctx, ordered);
  yield {
    type: 'aggregate',
    overallScore: score.overallScore,
    rawTotal: score.rawTotal,
    scoreBand: score.scoreBand,
    perEngineScores: score.perEngineScores,
    keywordMap: score.keywordMap,
    bulletStrengths: score.bulletStrengths,
    at: now(),
  };

  yield { type: 'stage', stage: 'plan', at: now() };
  const { plan, projectedScore } = buildPlan(doc, ordered, score.rawTotal);
  yield { type: 'plan', improvementPlan: plan, projectedScore, at: now() };
  yield { type: 'done', at: now(), aiUsed };

  const analysis: Analysis = {
    id: doc.id,
    status: 'done',
    stage: 'done',
    startedAt,
    finishedAt: now(),
    fileName: doc.fileName,
    fileType: doc.fileType,
    target: { label: ctx.targetLabel, source: ctx.targetSource, roleId: ctx.roleId, jdText: ctx.jdText },
    overallScore: score.overallScore,
    rawTotal: score.rawTotal,
    scoreBand: score.scoreBand,
    perEngineScores: score.perEngineScores,
    categories: ordered.map((c) => ({ ...c, findings: c.findings.map((f) => ({ ...f, fixByModel: modelFixed.has(f.id) || undefined })) })),
    parseReport: parseReportOf(doc),
    keywordMap: score.keywordMap,
    bulletStrengths: score.bulletStrengths,
    improvementPlan: plan,
    projectedScore,
    timings: [],
    aiUsed,
  };
  return analysis;
}

/** Fold a stream of events into an Analysis object. Used identically on the client and to persist the result. */
export function reduceEvent(state: Analysis, ev: AnalysisEvent): Analysis {
  switch (ev.type) {
    case 'stage': {
      const timings = state.timings.map((t) => (t.endedAt ? t : { ...t, endedAt: ev.at }));
      return { ...state, stage: ev.stage, timings: [...timings, { stage: ev.stage, startedAt: ev.at }] };
    }
    case 'parse':
      return { ...state, parseReport: ev.parseReport };
    case 'category': {
      const others = state.categories.filter((c) => c.id !== ev.category.id);
      return { ...state, categories: [...others, ev.category] };
    }
    case 'finding-fix':
      return {
        ...state,
        categories: state.categories.map((c) => ({ ...c, findings: c.findings.map((f) => (f.id === ev.findingId ? { ...f, fix: ev.fix, fixByModel: true } : f)) })),
      };
    case 'finding-resolved':
      return state;
    case 'aggregate':
      return { ...state, overallScore: ev.overallScore, rawTotal: ev.rawTotal, scoreBand: ev.scoreBand, perEngineScores: ev.perEngineScores, keywordMap: ev.keywordMap, bulletStrengths: ev.bulletStrengths };
    case 'plan':
      return { ...state, improvementPlan: ev.improvementPlan, projectedScore: ev.projectedScore };
    case 'done':
      return { ...state, status: 'done', stage: 'done', finishedAt: ev.at, aiUsed: ev.aiUsed, timings: state.timings.map((t) => (t.endedAt ? t : { ...t, endedAt: ev.at })) };
    case 'error':
      return { ...state, status: 'error', stage: 'error', error: ev.message, finishedAt: ev.at };
  }
}

export function emptyAnalysis(doc: { id: string; fileName: string; fileType: Analysis['fileType'] }, target: Analysis['target'], startedAt = Date.now()): Analysis {
  return { id: doc.id, status: 'running', stage: 'queued', startedAt, fileName: doc.fileName, fileType: doc.fileType, target, categories: [], timings: [], aiUsed: false };
}
