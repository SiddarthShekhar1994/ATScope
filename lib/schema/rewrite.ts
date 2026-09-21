import { z } from 'zod';
import { EngineScoreSchema, ScoreBandSchema, CategorySchema } from './analysis';

/** A line of the rewritten document. `originLineIds` point back at the upload. */
export const RewriteLineSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['name', 'contact', 'heading', 'entry', 'bullet', 'text', 'blank']),
  section: z.string(),
  originLineIds: z.array(z.string()),
  entryId: z.string().optional(),
});

export const HunkSchema = z.object({
  id: z.string(),
  kind: z.enum(['same', 'modify', 'insert', 'delete']),
  originalLineIds: z.array(z.string()),
  rewriteLineIds: z.array(z.string()),
  /** One sentence: what changed and why. */
  reason: z.string(),
  planItemId: z.string().optional(),
  findingIds: z.array(z.string()),
  /** Links a delete hunk to the insert hunk it moved to. */
  moveId: z.string().optional(),
  accepted: z.boolean(),
  section: z.string(),
});

export const PlaceholderSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  /** The raw token in the line, e.g. "[[number of accounts]]". */
  token: z.string(),
  hint: z.string(),
  projectedGain: z.number(),
  value: z.string().optional(),
});

export const ScoreSummarySchema = z.object({
  overallScore: z.number(),
  rawTotal: z.number(),
  scoreBand: ScoreBandSchema,
  perEngineScores: z.array(EngineScoreSchema),
  categories: z.array(CategorySchema),
});

export const RewriteSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  status: z.enum(['running', 'done', 'error']),
  error: z.string().optional(),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  sections: z.array(z.object({ id: z.string(), title: z.string(), lineIds: z.array(z.string()) })),
  lines: z.array(RewriteLineSchema),
  diffs: z.array(HunkSchema),
  placeholders: z.array(PlaceholderSchema),
  /** Score with placeholders credited (what the export will score once filled). */
  projected: ScoreSummarySchema.optional(),
  /** Score with placeholders left empty. */
  current: ScoreSummarySchema.optional(),
  iterations: z.number(),
  notes: z.array(z.string()),
  aiUsed: z.boolean(),
  enabledPlanItemIds: z.array(z.string()),
});

export type Rewrite = z.infer<typeof RewriteSchema>;
export type RewriteLine = z.infer<typeof RewriteLineSchema>;
export type Hunk = z.infer<typeof HunkSchema>;
export type Placeholder = z.infer<typeof PlaceholderSchema>;
export type ScoreSummary = z.infer<typeof ScoreSummarySchema>;

/** Events the rewrite stream emits. */
export const RewriteEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), message: z.string(), at: z.number() }),
  z.object({ type: z.literal('section'), section: z.object({ id: z.string(), title: z.string(), lineIds: z.array(z.string()) }), lines: z.array(RewriteLineSchema), at: z.number() }),
  z.object({ type: z.literal('iteration'), iteration: z.number(), score: z.number(), note: z.string(), at: z.number() }),
  z.object({ type: z.literal('complete'), rewrite: RewriteSchema, at: z.number() }),
  z.object({ type: z.literal('error'), message: z.string(), at: z.number() }),
]);
export type RewriteEvent = z.infer<typeof RewriteEventSchema>;

// ---------------------------------------------------------------------------
// Model output schemas (what streamObject asks the LLM for).
// ---------------------------------------------------------------------------

/** Per-finding fixes written during analysis. */
export const FixesOutputSchema = z.object({
  fixes: z.array(
    z.object({
      findingId: z.string().describe('The finding id exactly as given.'),
      fix: z.string().describe('The rewritten line, using only facts from the resume. Use [[hint]] where a number is needed but not present.'),
    }),
  ),
});
export type FixesOutput = z.infer<typeof FixesOutputSchema>;

export const RewriteOutputSchema = z.object({
  headline: z.string().optional().describe('Optional one-line professional title under the name, taken from the resume.'),
  summary: z.array(z.string()).describe('Two or three sentences of fact: role, years, domain, headline numbers. Empty array if the resume had no summary material.'),
  entries: z.array(
    z.object({
      entryId: z.string().describe('The entry id exactly as given (E1, E2 ...).'),
      bullets: z.array(
        z.object({
          originLineId: z.string().optional().describe('The original line id this bullet rewrites (L12). Omit only for a bullet merged from several lines.'),
          text: z.string().describe('Action verb, scale, outcome. Facts only from the resume. [[hint]] for any missing number.'),
          reason: z.string().describe('One sentence: what changed and why.'),
        }),
      ),
    }),
  ),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })).describe('Skills grouped by type, single-column text. Only tools and skills the resume mentions or clearly implies.'),
  addedKeywords: z.array(
    z.object({
      keyword: z.string(),
      evidence: z.string().describe('An exact quote from the original resume that supports this keyword.'),
    }),
  ),
});
export type RewriteOutput = z.infer<typeof RewriteOutputSchema>;
