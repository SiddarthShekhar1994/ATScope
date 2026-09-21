'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Analysis, AnalysisEvent, AnalysisFinding, Stage } from '../schema/analysis';
import { reduceEvent, emptyAnalysis } from './pipeline';

/**
 * Client-side fold of the analysis event stream. Besides the Analysis object it
 * tracks arrival order and time for every finding so the analyzing screen can
 * dock them in the order and at the moments they actually resolved.
 */
export interface Arrival {
  finding: AnalysisFinding;
  categoryId: AnalysisFinding['categoryId'];
  at: number;
}

export interface FeedState {
  analysis: Analysis;
  arrivals: Arrival[];
  /** Real elapsed ms since the first event arrived. */
  elapsedMs: number;
  startedAt: number | null;
  lastEventAt: number | null;
  stageStarted: Partial<Record<Stage, number>>;
  error: string | null;
  done: boolean;
}

type Action = { type: 'event'; event: AnalysisEvent; receivedAt: number } | { type: 'tick'; now: number } | { type: 'reset'; analysis: Analysis };

export function feedReducer(state: FeedState, action: Action): FeedState {
  switch (action.type) {
    case 'reset':
      return { analysis: action.analysis, arrivals: [], elapsedMs: 0, startedAt: null, lastEventAt: null, stageStarted: {}, error: null, done: false };
    case 'tick':
      if (state.done || state.startedAt === null) return state;
      return { ...state, elapsedMs: action.now - state.startedAt };
    case 'event': {
      const ev = action.event;
      const startedAt = state.startedAt ?? action.receivedAt;
      let next: FeedState = { ...state, startedAt, lastEventAt: action.receivedAt, elapsedMs: action.receivedAt - startedAt, analysis: reduceEvent(state.analysis, ev) };
      if (ev.type === 'stage') next = { ...next, stageStarted: { ...next.stageStarted, [ev.stage]: action.receivedAt } };
      if (ev.type === 'category') {
        const fresh = ev.category.findings.filter((f) => !state.arrivals.some((a) => a.finding.id === f.id));
        next = { ...next, arrivals: [...next.arrivals, ...fresh.map((f) => ({ finding: f, categoryId: f.categoryId, at: action.receivedAt }))] };
      }
      if (ev.type === 'finding-fix') {
        next = { ...next, arrivals: next.arrivals.map((a) => (a.finding.id === ev.findingId ? { ...a, finding: { ...a.finding, fix: ev.fix, fixByModel: true } } : a)) };
      }
      if (ev.type === 'done') next = { ...next, done: true, elapsedMs: action.receivedAt - startedAt };
      if (ev.type === 'error') next = { ...next, error: ev.message, done: true };
      return next;
    }
  }
}

export function initialFeed(analysis: Analysis): FeedState {
  return { analysis, arrivals: [], elapsedMs: 0, startedAt: null, lastEventAt: null, stageStarted: {}, error: null, done: false };
}

export function useAnalysisFeed(seed: Analysis) {
  const [state, dispatch] = useReducer(feedReducer, seed, initialFeed);
  const push = useCallback((event: AnalysisEvent) => dispatch({ type: 'event', event, receivedAt: Date.now() }), []);
  const reset = useCallback((analysis: Analysis) => dispatch({ type: 'reset', analysis }), []);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (state.done || state.startedAt === null) return;
    const loop = () => {
      dispatch({ type: 'tick', now: Date.now() });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [state.done, state.startedAt]);
  return { state, push, reset };
}

export { emptyAnalysis };

export const STAGE_LABEL: Record<Stage, string> = {
  queued: 'Queued',
  parse: 'Parse',
  structure: 'Sections',
  contact: 'Contact',
  'parse-integrity': 'Parse integrity',
  keywords: 'Keywords',
  impact: 'Impact',
  writing: 'Writing',
  fixes: 'Model fixes',
  aggregate: 'Score',
  plan: 'Plan',
  done: 'Done',
  error: 'Error',
};

export const STAGE_SEQUENCE: Stage[] = ['parse', 'structure', 'contact', 'parse-integrity', 'keywords', 'impact', 'writing', 'fixes', 'aggregate', 'plan'];
