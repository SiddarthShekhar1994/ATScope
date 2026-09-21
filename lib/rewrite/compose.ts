import type { Hunk, RewriteLine, Placeholder, ScoreSummary } from '../schema/rewrite';
import type { ScoringContext } from '../score/types';
import { parseFromText } from '../parse/from-text';
import { scoreResume } from '../score/aggregate';
import { PLACEHOLDER_RE } from '../score/bullet-strength';

/**
 * Compose the current document from the rewrite given which hunks are
 * accepted and which placeholders are filled. Runs on the client so every
 * accept/reject/fill re-scores instantly with the same engine.
 */

export interface ComposeInput {
  lines: RewriteLine[];
  diffs: Hunk[];
  placeholders: Placeholder[];
  originalText: Record<string, string>;
}

export interface Composed {
  text: string;
  /** Composed line index per rewrite line id (accepted lines only). */
  positions: Record<string, number>;
  unfilled: Placeholder[];
}

export function composeDocument(input: ComposeInput): Composed {
  const byId = new Map(input.lines.map((l) => [l.id, l]));
  const values = new Map(input.placeholders.map((p) => [p.token + '@' + p.lineId, p.value?.trim() ?? '']));
  const out: string[] = [];
  const positions: Record<string, number> = {};
  let lastKind: RewriteLine['kind'] | null = null;
  const emitRewrite = (id: string) => {
    const l = byId.get(id);
    if (!l) return;
    if (l.kind === 'heading' && out.length) out.push('');
    let text = l.text;
    text = text.replace(PLACEHOLDER_RE, (token) => {
      const v = values.get(token + '@' + l.id);
      return v ? v : token;
    });
    positions[id] = out.length;
    out.push(l.kind === 'bullet' ? `• ${text}` : text);
    lastKind = l.kind;
  };
  const emitOriginal = (id: string) => {
    const text = input.originalText[id];
    if (text === undefined) return;
    out.push(text);
  };
  for (const h of input.diffs) {
    switch (h.kind) {
      case 'same':
        h.rewriteLineIds.forEach(emitRewrite);
        break;
      case 'modify':
        if (h.accepted) h.rewriteLineIds.forEach(emitRewrite);
        else h.originalLineIds.forEach(emitOriginal);
        break;
      case 'insert':
        if (h.accepted) h.rewriteLineIds.forEach(emitRewrite);
        break;
      case 'delete':
        if (!h.accepted) h.originalLineIds.forEach(emitOriginal);
        break;
    }
  }
  void lastKind;
  const acceptedLineIds = new Set(Object.keys(positions));
  const unfilled = input.placeholders.filter((p) => acceptedLineIds.has(p.lineId) && !(p.value && p.value.trim()));
  return { text: out.join('\n'), positions, unfilled };
}

export function scoreText(text: string, ctx: ScoringContext, creditPlaceholders: boolean): ScoreSummary {
  const doc = parseFromText(text, 'composed');
  const result = scoreResume(doc, { ...ctx, placeholderCredit: creditPlaceholders });
  return {
    overallScore: result.overallScore,
    rawTotal: result.rawTotal,
    scoreBand: result.scoreBand,
    perEngineScores: result.perEngineScores,
    categories: result.categories,
  };
}

/** Extract [[placeholders]] from the rewrite lines. Gains are filled in by the verifier. */
export function extractPlaceholders(lines: RewriteLine[]): Placeholder[] {
  const out: Placeholder[] = [];
  for (const l of lines) {
    const tokens = l.text.match(PLACEHOLDER_RE) ?? [];
    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push({ id: `PH${out.length + 1}`, lineId: l.id, token, hint: token.slice(2, -2).trim(), projectedGain: 0 });
    }
  }
  return out;
}

/** Marginal gain of each placeholder: score with just that one credited minus score with none credited. */
export function placeholderGains(input: ComposeInput, ctx: ScoringContext): Placeholder[] {
  const base = composeDocument(input);
  const baseScore = scoreText(base.text, ctx, false).rawTotal;
  return input.placeholders.map((p) => {
    if (p.value && p.value.trim()) return { ...p, projectedGain: 0 };
    const credited = composeDocument({
      ...input,
      lines: input.lines.map((l) => (l.id === p.lineId ? { ...l, text: l.text.split(p.token).join(creditStandIn(p.hint)) } : l)),
      placeholders: input.placeholders.filter((x) => x.id !== p.id),
    });
    const s = scoreText(credited.text, ctx, false).rawTotal;
    return { ...p, projectedGain: Math.max(0, Math.round((s - baseScore) * 10) / 10) };
  });
}

/** A stand-in that the engine will count the way a real value would. */
function creditStandIn(hint: string): string {
  const h = hint.toLowerCase();
  if (/email/.test(h)) return 'name@example.com';
  if (/phone/.test(h)) return '(555) 000-0000';
  if (/linkedin/.test(h)) return 'linkedin.com/in/handle';
  if (/city|location/.test(h)) return 'City, ST';
  if (/url|portfolio|github/.test(h)) return 'github.com/handle';
  if (/mon yyyy|dates?/.test(h)) return 'Jan 2020 – Dec 2022';
  if (/name/.test(h)) return 'Full Name';
  if (/result|outcome|improv/.test(h)) return 'cutting turnaround 30%';
  return '10';
}
