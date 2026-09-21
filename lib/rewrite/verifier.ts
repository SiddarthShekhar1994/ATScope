import type { ParsedResume } from '../parse/types';
import type { RewriteOutput, RewriteLine, Hunk, Placeholder, ScoreSummary } from '../schema/rewrite';
import type { PlanItem } from '../schema/analysis';
import type { ScoringContext } from '../score/types';
import { DICTIONARY, termRegex } from '../score/keywords/dictionary';
import { PLACEHOLDER_RE, bulletStrength } from '../score/bullet-strength';
import { buildStructure } from './structural';
import { rewriteBulletFallback } from './fallback';
import { composeDocument, scoreText, extractPlaceholders, placeholderGains } from './compose';
import { AI_PHRASES } from '../score/writing';

export const TARGET_MIN = 89;
export const MAX_ITERATIONS = 3;

/**
 * The verifier enforces the two promises the product makes:
 *  1. Nothing in the rewrite is invented — numbers, tools and claims must trace
 *     back to the upload or be marked as [[placeholders]].
 *  2. The rewrite scores 89–99 with the same engine that scored the upload, or
 *     we say exactly why it could not.
 */

export interface VerifiedBuild {
  lines: RewriteLine[];
  sections: { id: string; title: string; lineIds: string[] }[];
  hunks: Hunk[];
  placeholders: Placeholder[];
  projected: ScoreSummary;
  current: ScoreSummary;
  iterations: number;
  notes: string[];
}

// A number with its unit, but never the space after it: "14 Tableau" keeps its space.
const NUMBER_RE = /(?:\$\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent|million|billion|thousand|[kmbx](?![a-z])))?\+?/gi;

export function originalNumbers(doc: ParsedResume): Set<string> {
  const set = new Set<string>();
  for (const l of doc.lines) for (const m of l.text.match(NUMBER_RE) ?? []) set.add(normNum(m));
  return set;
}

function normNum(s: string): string {
  return s.toLowerCase().replace(/[\s,$]/g, '').replace(/percent/, '%').replace(/\+$/, '');
}

/** Terms the upload mentions (canonical dictionary ids). */
export function originalTerms(doc: ParsedResume): Set<string> {
  const text = doc.lines.map((l) => l.text).join('\n');
  const set = new Set<string>();
  for (const e of DICTIONARY) if (termRegex(e.t, e.a).test(text)) set.add(e.t);
  return set;
}

/**
 * Scrub a model bullet: unsupported numbers become [[number]]; a bullet that
 * names a tool the upload never mentioned (and that was not justified with
 * evidence) is rejected so the caller falls back to the original line.
 */
export function sanitizeBullet(text: string, allowedNumbers: Set<string>, allowedTerms: Set<string>, notes: string[], label: string): { text: string; rejected: boolean } {
  let t = text.trim();
  // Numbers.
  const protectedSpans = [...t.matchAll(PLACEHOLDER_RE)].map((m) => [m.index!, m.index! + m[0].length] as const);
  const inPlaceholder = (i: number) => protectedSpans.some(([a, b]) => i >= a && i < b);
  let removed = 0;
  t = t.replace(NUMBER_RE, (m, offset: number) => {
    if (inPlaceholder(offset)) return m;
    if (/^(19|20)\d{2}$/.test(m.trim())) return m; // years are checked structurally via entries
    if (allowedNumbers.has(normNum(m))) return m;
    removed++;
    return '[[number]]';
  });
  if (removed) notes.push(`Removed ${removed} unsupported number${removed === 1 ? '' : 's'} from a bullet under ${label}; replaced with fill-in fields.`);
  // Tools and skills.
  for (const e of DICTIONARY) {
    if (e.c === 'soft' || e.c === 'method' || e.c === 'business' || e.c === 'leadership') continue;
    if (allowedTerms.has(e.t)) continue;
    if (termRegex(e.t, e.a).test(t.replace(PLACEHOLDER_RE, ''))) {
      notes.push(`Rejected a model bullet under ${label}: it names “${e.t}”, which the original never mentions.`);
      return { text: t, rejected: true };
    }
  }
  // Generic phrasing.
  for (const p of AI_PHRASES) {
    const swap = p.swap.split(' / ')[0];
    if (/^(used|led|launched|analyzed|investigated|worked with|combined)$/.test(swap)) t = t.replace(new RegExp(p.re.source, 'gi'), (m) => (/^[A-Z]/.test(m) ? swap.charAt(0).toUpperCase() + swap.slice(1) : swap));
  }
  return { text: t.replace(/\s{2,}/g, ' ').replace(/\s([,.])/g, '$1'), rejected: false };
}

/** Clean model output against the upload before anything is built from it. */
export function sanitizeModelOutput(doc: ParsedResume, out: RewriteOutput, notes: string[]): RewriteOutput {
  const numbers = originalNumbers(doc);
  const terms = originalTerms(doc);
  const originalText = doc.lines.map((l) => l.text.toLowerCase().replace(/\s+/g, ' ')).join('\n');
  // Added keywords need verbatim evidence.
  const added: RewriteOutput['addedKeywords'] = [];
  for (const k of out.addedKeywords ?? []) {
    const ev = (k.evidence ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (ev.length >= 6 && originalText.includes(ev)) {
      added.push(k);
      const e = DICTIONARY.find((d) => d.t === k.keyword.toLowerCase() || d.a?.includes(k.keyword.toLowerCase()));
      if (e) terms.add(e.t);
    } else {
      notes.push(`Dropped keyword “${k.keyword}”: the evidence quoted does not appear in the original.`);
    }
  }
  const entries = (out.entries ?? []).map((e) => {
    const entry = doc.entries.find((x) => x.id === e.entryId);
    const label = entry ? [entry.title, entry.org].filter(Boolean).join(' at ') || entry.id : e.entryId;
    const bullets = e.bullets
      .map((b) => {
        const s = sanitizeBullet(b.text, numbers, terms, notes, label);
        if (!s.rejected) return { ...b, text: s.text };
        // Keep the person's content: fall back to the rule-based rewrite of the original line.
        const original = b.originLineId ? doc.lines.find((l) => l.id === b.originLineId) : undefined;
        if (!original) return null;
        return { originLineId: b.originLineId, text: rewriteBulletFallback(original.text), reason: 'The model version named a tool the original never mentions; the rule-based rewrite of your line is used instead.' };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
    return { ...e, bullets };
  });
  const skills = (out.skills ?? []).map((g) => ({
    group: g.group,
    items: g.items.filter((it) => {
      const e = DICTIONARY.find((d) => termRegex(d.t, d.a).test(it));
      if (!e) return originalText.includes(it.toLowerCase());
      if (terms.has(e.t)) return true;
      notes.push(`Dropped skill “${it}”: not in the original and no evidence given.`);
      return false;
    }),
  }));
  const summary = (out.summary ?? []).map((s) => sanitizeBullet(s, numbers, terms, notes, 'the summary')).map((s) => s.text);
  return { ...out, entries, skills, summary, addedKeywords: added };
}

/** Build, score, and iterate until the projected score clears the bar or we run out of honest levers. */
export async function verifyAndBuild(
  doc: ParsedResume,
  plan: PlanItem[],
  enabledIds: Set<string>,
  model: RewriteOutput | null,
  ctx: ScoringContext,
  refine?: (feedback: string[], previous: RewriteOutput) => Promise<RewriteOutput | null>,
  onIteration?: (iteration: number, score: number, note: string) => void,
): Promise<VerifiedBuild> {
  const notes: string[] = [];
  let current = model ? sanitizeModelOutput(doc, model, notes) : null;
  let build = buildStructure(doc, plan, enabledIds, current, ctx);
  const originalText = Object.fromEntries(doc.lines.map((l) => [l.id, l.text]));
  let iterations = 0;
  let projected = score(build, originalText, ctx, true);
  onIteration?.(++iterations, projected.overallScore, `First pass scores ${projected.overallScore}.`);

  while (projected.overallScore < TARGET_MIN && iterations < MAX_ITERATIONS) {
    const feedback = weakSpots(projected);
    let improved = false;
    if (refine && current && iterations === 1) {
      const again = await refine(feedback, current);
      if (again) {
        current = sanitizeModelOutput(doc, again, notes);
        build = buildStructure(doc, plan, enabledIds, current, ctx);
        improved = true;
      }
    }
    if (!improved) {
      // Deterministic pass: any bullet still short of 3/3 gets the fallback treatment.
      const before = build.lines.map((l) => l.text).join('\n');
      build = {
        ...build,
        lines: build.lines.map((l) => {
          if (l.kind !== 'bullet') return l;
          const s = bulletStrength(l.id, l.text, true);
          return s.score === 3 ? l : { ...l, text: rewriteBulletFallback(l.text) };
        }),
      };
      const after = build.lines.map((l) => l.text).join('\n');
      if (before === after) break;
      notes.push('Applied the rule-based pass to bullets that still lacked a verb, number or outcome.');
    }
    projected = score(build, originalText, ctx, true);
    onIteration?.(++iterations, projected.overallScore, improved ? `Model revision scores ${projected.overallScore}.` : `Rule-based pass scores ${projected.overallScore}.`);
  }
  if (projected.overallScore < TARGET_MIN) {
    const weak = weakSpots(projected);
    notes.push(`Stopped at ${projected.overallScore}. ${weak.join(' ')} Adding those would mean inventing facts, so they are left for you.`);
  }

  const placeholdersRaw = extractPlaceholders(build.lines);
  const placeholders = placeholderGains({ lines: build.lines, diffs: build.hunks, placeholders: placeholdersRaw, originalText }, ctx);
  const currentScore = score({ ...build }, originalText, ctx, false);
  return { lines: build.lines, sections: build.sections, hunks: build.hunks, placeholders, projected, current: currentScore, iterations, notes: [...new Set([...build.notes, ...notes])] };
}

function score(build: { lines: RewriteLine[]; hunks: Hunk[] }, originalText: Record<string, string>, ctx: ScoringContext, credit: boolean): ScoreSummary {
  const composed = composeDocument({ lines: build.lines, diffs: build.hunks, placeholders: [], originalText });
  return scoreText(composed.text, ctx, credit);
}

function weakSpots(s: ScoreSummary): string[] {
  return s.categories
    .filter((c) => c.score < 90)
    .sort((a, b) => (100 - a.score) * a.weight - (100 - b.score) * b.weight)
    .reverse()
    .slice(0, 3)
    .map((c) => {
      const top = c.findings.slice(0, 3).map((f) => f.explanation).join(' ');
      return `${c.label} is at ${c.score}: ${top}`;
    });
}
