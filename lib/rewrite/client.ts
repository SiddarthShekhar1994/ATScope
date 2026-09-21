'use client';

import { useMemo } from 'react';
import type { ParsedResume } from '../parse/types';
import type { Analysis } from '../schema/analysis';
import type { Rewrite, ScoreSummary } from '../schema/rewrite';
import { buildContext } from '../score';
import { composeDocument, scoreText } from './compose';

/**
 * Client-side live scoring. The same engine that scored the upload runs in the
 * browser on the composed document every time a change is accepted, rejected
 * or a placeholder is filled — no round trip, no estimate.
 */
export interface LiveScore {
  text: string;
  current: ScoreSummary;
  projected: ScoreSummary;
  unfilledCount: number;
  positions: Record<string, number>;
}

export function useLiveScore(doc: ParsedResume, analysis: Analysis, rewrite: Rewrite, accepted: Record<string, boolean>, values: Record<string, string>): LiveScore {
  const ctx = useMemo(() => buildContext(doc, { jd: analysis.target.jdText, roleId: analysis.target.source === 'jd' ? undefined : analysis.target.roleId }), [doc, analysis.target]);
  const originalText = useMemo(() => Object.fromEntries(doc.lines.map((l) => [l.id, l.text])), [doc.lines]);
  return useMemo(() => {
    const diffs = rewrite.diffs.map((h) => ({ ...h, accepted: accepted[h.id] ?? h.accepted }));
    const placeholders = rewrite.placeholders.map((p) => ({ ...p, value: values[p.id] ?? p.value }));
    const composed = composeDocument({ lines: rewrite.lines, diffs, placeholders, originalText });
    const current = scoreText(composed.text, ctx, false);
    const projected = composed.unfilled.length ? scoreText(composed.text, ctx, true) : current;
    return { text: composed.text, current, projected, unfilledCount: composed.unfilled.length, positions: composed.positions };
  }, [rewrite, accepted, values, originalText, ctx]);
}
