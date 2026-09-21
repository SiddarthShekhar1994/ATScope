import type { ParsedResume } from '../parse/types';
import type { CategoryScorer, CategoryId, CategoryResult, ScoreResult, ScoringContext } from './types';
import { CATEGORY_META, bandFor } from './types';
import { scoreParseIntegrity } from './parse-integrity';
import { scoreKeywords } from './keyword-coverage';
import { scoreImpact } from './impact';
import { scoreStructure } from './structure';
import { scoreWriting } from './writing';
import { scoreContact } from './contact';
import { engineScores } from './engines';
import { matchKeywords } from './keywords/extract';
import { bulletStrength } from './bullet-strength';
import { workBullets } from './util';

export const SCORERS: Record<CategoryId, CategoryScorer> = {
  parse: scoreParseIntegrity,
  keywords: scoreKeywords,
  impact: scoreImpact,
  structure: scoreStructure,
  writing: scoreWriting,
  contact: scoreContact,
};

export const CATEGORY_ORDER: CategoryId[] = (Object.keys(CATEGORY_META) as CategoryId[]).sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order);

/** Never award 100: a perfect score invites disbelief and there is always a JD that wants one more term. */
export const MAX_SCORE = 99;

export function weightedTotal(categories: CategoryResult[]): number {
  return categories.reduce((n, c) => n + (c.score * c.weight) / 100, 0);
}

export function scoreCategory(id: CategoryId, doc: ParsedResume, ctx: ScoringContext): CategoryResult {
  return SCORERS[id](doc, ctx);
}

export function scoreResume(doc: ParsedResume, ctx: ScoringContext): ScoreResult {
  const categories = CATEGORY_ORDER.map((id) => scoreCategory(id, doc, ctx));
  return assemble(doc, ctx, categories);
}

export function assemble(doc: ParsedResume, ctx: ScoringContext, categories: CategoryResult[]): ScoreResult {
  const rawTotal = weightedTotal(categories);
  const overallScore = Math.min(MAX_SCORE, Math.round(rawTotal));
  const keywordMap = matchKeywords(doc, ctx);
  const bulletStrengths = workBullets(doc).map((b) => bulletStrength(b.line.id, b.line.text, ctx.placeholderCredit));
  return {
    overallScore,
    scoreBand: bandFor(overallScore),
    perEngineScores: engineScores(doc, categories),
    categories,
    keywordMap,
    bulletStrengths,
    rawTotal: Math.round(rawTotal * 10) / 10,
  };
}
