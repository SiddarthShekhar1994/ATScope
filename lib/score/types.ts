import type { ParsedResume } from '../parse/types';

export type CategoryId = 'parse' | 'keywords' | 'impact' | 'structure' | 'writing' | 'contact';

export type Severity = 'high' | 'medium' | 'low';

export type FixKind = 'rewrite-line' | 'add-line' | 'remove-line' | 'restructure' | 'add-keyword' | 'layout' | 'contact' | 'rename-heading' | 'merge-lines';

export interface Finding {
  id: string;
  categoryId: CategoryId;
  /** Exact text lifted from the document. Never paraphrased. */
  quote: string;
  lineRef: string;
  relatedLineRefs?: string[];
  severity: Severity;
  pointCost: number;
  /** What is wrong, in specifics. */
  explanation: string;
  /** What to do about it, in specifics. May be replaced by an LLM-written fix later. */
  fix: string;
  fixKind: FixKind;
  ruleId: string;
  /** Machine-readable payload the planner and rewriter use (e.g. the keyword to add). */
  data?: Record<string, string | number | boolean | string[]>;
}

export interface CategoryResult {
  id: CategoryId;
  label: string;
  weight: number;
  /** 0-100 within the category. */
  score: number;
  summary: string;
  findings: Finding[];
  /** Small facts worth showing next to the score (e.g. "12 of 14 bullets lack a number"). */
  facts: { label: string; value: string }[];
}

export interface TargetKeyword {
  term: string;
  /** Alternate spellings that count as a match. */
  aliases: string[];
  /** 1 = nice to have, 2 = mentioned, 3 = required / in the title. */
  weight: 1 | 2 | 3;
  category?: string;
}

export interface ScoringContext {
  targetLabel: string;
  targetSource: 'jd' | 'role' | 'inferred';
  roleId?: string;
  targetKeywords: TargetKeyword[];
  jdText?: string;
  /** When true, [[placeholder]] tokens count as numbers (used for projected scores). */
  placeholderCredit?: boolean;
}

export type CategoryScorer = (doc: ParsedResume, ctx: ScoringContext) => CategoryResult;

export interface KeywordHit {
  term: string;
  weight: number;
  count: number;
  lineRefs: string[];
  matchedAs: string;
}

export interface KeywordMap {
  present: KeywordHit[];
  missing: { term: string; weight: number; category?: string; supportedBy?: string[] }[];
  overused: { term: string; count: number; lineRefs: string[]; limit: number }[];
  jdMatchPercent: number;
  targetLabel: string;
  targetSource: ScoringContext['targetSource'];
}

export interface BulletStrength {
  lineRef: string;
  text: string;
  verb: 0 | 1;
  metric: 0 | 1;
  outcome: 0 | 1;
  /** 0-3 */
  score: number;
  notes: string[];
}

export type ScoreBand = 'filtered' | 'borderline' | 'competitive' | 'strong';

export interface EngineScore {
  engine: 'workday' | 'greenhouse' | 'lever' | 'taleo';
  label: string;
  score: number;
  note: string;
}

export interface ScoreResult {
  overallScore: number;
  scoreBand: ScoreBand;
  perEngineScores: EngineScore[];
  categories: CategoryResult[];
  keywordMap: KeywordMap;
  bulletStrengths: BulletStrength[];
  /** Raw weighted total before the 99 cap, for transparency. */
  rawTotal: number;
}

export const CATEGORY_META: Record<CategoryId, { label: string; weight: number; order: number }> = {
  parse: { label: 'Parse integrity', weight: 25, order: 0 },
  keywords: { label: 'Keyword coverage', weight: 25, order: 1 },
  impact: { label: 'Impact & quantification', weight: 20, order: 2 },
  structure: { label: 'Structure & sections', weight: 15, order: 3 },
  writing: { label: 'Writing quality', weight: 10, order: 4 },
  contact: { label: 'Contact & metadata', weight: 5, order: 5 },
};

export function bandFor(score: number): ScoreBand {
  if (score < 50) return 'filtered';
  if (score < 70) return 'borderline';
  if (score < 85) return 'competitive';
  return 'strong';
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  filtered: 'Likely filtered out',
  borderline: 'Borderline',
  competitive: 'Competitive',
  strong: 'Strong',
};

/** Helper to build a finding with consistent shape. */
export function finding(partial: Omit<Finding, 'id'> & { id?: string }): Finding {
  return { ...partial, id: partial.id ?? `${partial.categoryId}-${partial.ruleId}-${partial.lineRef}`, pointCost: round1(partial.pointCost) };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}
