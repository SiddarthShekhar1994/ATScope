import { z } from 'zod';

/**
 * The single output contract. The server streams partial versions of
 * `Analysis` (category by category) and the client renders whatever has
 * arrived. Everything in here is produced by the engine or the rewriter and is
 * stored verbatim, so it doubles as the persistence schema.
 */

export const CategoryIdSchema = z.enum(['parse', 'keywords', 'impact', 'structure', 'writing', 'contact']);
export const SeveritySchema = z.enum(['high', 'medium', 'low']);
export const ScoreBandSchema = z.enum(['filtered', 'borderline', 'competitive', 'strong']);
export const StageSchema = z.enum(['queued', 'parse', 'structure', 'contact', 'parse-integrity', 'keywords', 'impact', 'writing', 'fixes', 'aggregate', 'plan', 'done', 'error']);

export const FindingSchema = z.object({
  id: z.string(),
  categoryId: CategoryIdSchema,
  quote: z.string(),
  lineRef: z.string(),
  relatedLineRefs: z.array(z.string()).optional(),
  severity: SeveritySchema,
  pointCost: z.number(),
  explanation: z.string(),
  fix: z.string(),
  fixKind: z.enum(['rewrite-line', 'add-line', 'remove-line', 'restructure', 'add-keyword', 'layout', 'contact', 'rename-heading', 'merge-lines']),
  ruleId: z.string(),
  /** True once the fix text was written by the model rather than a template. */
  fixByModel: z.boolean().optional(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
});

export const CategorySchema = z.object({
  id: CategoryIdSchema,
  label: z.string(),
  weight: z.number(),
  score: z.number(),
  summary: z.string(),
  findings: z.array(FindingSchema),
  facts: z.array(z.object({ label: z.string(), value: z.string() })),
});

export const EngineScoreSchema = z.object({
  engine: z.enum(['workday', 'greenhouse', 'lever', 'taleo']),
  label: z.string(),
  score: z.number(),
  note: z.string(),
});

export const DroppedElementSchema = z.object({
  id: z.string(),
  kind: z.enum(['table', 'header', 'footer', 'image', 'textbox', 'icon', 'glyph', 'column', 'shape']),
  description: z.string(),
  text: z.string().optional(),
  lineRefs: z.array(z.string()),
  page: z.number().optional(),
  severity: SeveritySchema,
});

export const ReadingOrderIssueSchema = z.object({
  id: z.string(),
  kind: z.enum(['column-interleave', 'table-flatten', 'out-of-order', 'orphan']),
  description: z.string(),
  lineRefs: z.array(z.string()),
});

export const AtsLineSchema = z.object({
  text: z.string(),
  fromLineIds: z.array(z.string()),
  note: z.string().optional(),
  mangled: z.boolean().optional(),
});

export const ParseReportSchema = z.object({
  droppedElements: z.array(DroppedElementSchema),
  readingOrderIssues: z.array(ReadingOrderIssueSchema),
  atsPlainText: z.string(),
  atsLines: z.array(AtsLineSchema),
  layout: z.object({
    pageCount: z.number(),
    columns: z.number(),
    singleColumn: z.boolean(),
    tableCount: z.number(),
    imageCount: z.number(),
    textBoxCount: z.number(),
    wordCount: z.number(),
    fonts: z.array(z.string()),
  }),
});

export const KeywordMapSchema = z.object({
  present: z.array(z.object({ term: z.string(), weight: z.number(), count: z.number(), lineRefs: z.array(z.string()), matchedAs: z.string() })),
  missing: z.array(z.object({ term: z.string(), weight: z.number(), category: z.string().optional(), supportedBy: z.array(z.string()).optional() })),
  overused: z.array(z.object({ term: z.string(), count: z.number(), lineRefs: z.array(z.string()), limit: z.number() })),
  jdMatchPercent: z.number(),
  targetLabel: z.string(),
  targetSource: z.enum(['jd', 'role', 'inferred']),
});

export const PlanItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['layout', 'contact', 'heading', 'bullets', 'summary', 'keywords', 'structure', 'writing']),
  change: z.string(),
  detail: z.string().optional(),
  targetSection: z.string(),
  /** Points on the 0-99 overall scale, derived from the findings this item resolves. */
  projectedGain: z.number(),
  enabled: z.boolean(),
  /** Locked items cannot be unchecked: the rewrite is single-column text, so layout fixes are inherent. */
  locked: z.boolean().optional(),
  findingIds: z.array(z.string()),
  /** Line refs the item touches, for highlighting. */
  lineRefs: z.array(z.string()),
  /** Payload for the rewriter. */
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
});

export const BulletStrengthSchema = z.object({
  lineRef: z.string(),
  text: z.string(),
  verb: z.number(),
  metric: z.number(),
  outcome: z.number(),
  score: z.number(),
  notes: z.array(z.string()),
});

export const TargetSchema = z.object({
  label: z.string(),
  source: z.enum(['jd', 'role', 'inferred']),
  roleId: z.string().optional(),
  jdText: z.string().optional(),
});

export const TimingSchema = z.object({ stage: StageSchema, startedAt: z.number(), endedAt: z.number().optional() });

export const AnalysisSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'done', 'error']),
  stage: StageSchema,
  error: z.string().optional(),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  fileName: z.string(),
  fileType: z.enum(['pdf', 'docx', 'text']),
  target: TargetSchema,
  overallScore: z.number().optional(),
  rawTotal: z.number().optional(),
  scoreBand: ScoreBandSchema.optional(),
  perEngineScores: z.array(EngineScoreSchema).optional(),
  categories: z.array(CategorySchema),
  parseReport: ParseReportSchema.optional(),
  keywordMap: KeywordMapSchema.optional(),
  bulletStrengths: z.array(BulletStrengthSchema).optional(),
  improvementPlan: z.array(PlanItemSchema).optional(),
  projectedScore: z.number().optional(),
  timings: z.array(TimingSchema),
  aiUsed: z.boolean(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type ParseReport = z.infer<typeof ParseReportSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type AnalysisFinding = z.infer<typeof FindingSchema>;
export type AnalysisCategory = z.infer<typeof CategorySchema>;

/** Events the analysis stream emits. The client folds them into an `Analysis`. */
export const AnalysisEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stage'), stage: StageSchema, at: z.number() }),
  z.object({ type: z.literal('parse'), parseReport: ParseReportSchema, at: z.number() }),
  z.object({ type: z.literal('category'), category: CategorySchema, at: z.number() }),
  z.object({ type: z.literal('finding-fix'), findingId: z.string(), fix: z.string(), at: z.number() }),
  z.object({ type: z.literal('finding-resolved'), findingId: z.string(), at: z.number() }),
  z.object({
    type: z.literal('aggregate'),
    overallScore: z.number(),
    rawTotal: z.number(),
    scoreBand: ScoreBandSchema,
    perEngineScores: z.array(EngineScoreSchema),
    keywordMap: KeywordMapSchema,
    bulletStrengths: z.array(BulletStrengthSchema),
    at: z.number(),
  }),
  z.object({ type: z.literal('plan'), improvementPlan: z.array(PlanItemSchema), projectedScore: z.number(), at: z.number() }),
  z.object({ type: z.literal('done'), at: z.number(), aiUsed: z.boolean() }),
  z.object({ type: z.literal('error'), message: z.string(), at: z.number() }),
]);
export type AnalysisEvent = z.infer<typeof AnalysisEventSchema>;
