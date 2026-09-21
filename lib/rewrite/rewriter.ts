import type { ParsedResume } from '../parse/types';
import type { Analysis } from '../schema/analysis';
import type { Rewrite, RewriteEvent, RewriteOutput } from '../schema/rewrite';
import { buildContext } from '../score';
import type { ModelInfo } from '../ai/model';
import { draftRewrite } from './prose';
import { verifyAndBuild } from './verifier';

/**
 * Orchestrates one rewrite: model draft (if configured) → verification →
 * scoring loop → final Rewrite object. Emits progress as it happens.
 */
export async function* runRewrite(doc: ParsedResume, analysis: Analysis, enabledPlanItemIds: string[], opts: { model: ModelInfo; signal?: AbortSignal }): AsyncGenerator<RewriteEvent, Rewrite> {
  const now = () => Date.now();
  const startedAt = now();
  const plan = analysis.improvementPlan ?? [];
  const enabled = new Set(enabledPlanItemIds);
  const ctx = buildContext(doc, { jd: analysis.target.jdText, roleId: analysis.target.source === 'jd' ? undefined : analysis.target.roleId });
  const progress: RewriteEvent[] = [];
  const emit = (e: RewriteEvent) => progress.push(e);

  let draft: RewriteOutput | null = null;
  let aiUsed = false;
  if (opts.model.available && opts.model.model) {
    yield { type: 'status', message: `Drafting bullets and summary with ${opts.model.spec}…`, at: now() };
    try {
      draft = await draftRewrite(
        doc,
        plan,
        enabled,
        ctx,
        analysis.keywordMap,
        opts.model.model,
        opts.model.spec,
        (p) => emit({ type: 'status', message: p.bulletsSoFar ? `${p.bulletsSoFar} bullet${p.bulletsSoFar === 1 ? '' : 's'} drafted across ${Math.min(p.entriesDone + 1, Math.max(1, p.totalEntries))} of ${Math.max(1, p.totalEntries)} roles…` : 'Reading the resume…', at: now() }),
        undefined,
        undefined,
        opts.signal,
      );
      aiUsed = true;
      // Drain progress collected during the await.
      for (const e of progress.splice(0)) yield e;
    } catch (err) {
      yield { type: 'status', message: `Model draft failed (${(err as Error).message.slice(0, 120)}). Falling back to the rule-based rewrite.`, at: now() };
      draft = null;
    }
  } else {
    yield { type: 'status', message: `No model configured (${opts.model.reason ?? 'AI_MODEL'}). Applying the rule-based rewrite: every change is traceable, numbers become fill-in fields.`, at: now() };
  }

  yield { type: 'status', message: 'Verifying every claim against the original and re-scoring…', at: now() };
  const iterations: RewriteEvent[] = [];
  const refine =
    aiUsed && opts.model.model
      ? async (feedback: string[], previous: RewriteOutput) => {
          try {
            return await draftRewrite(doc, plan, enabled, ctx, analysis.keywordMap, opts.model.model!, opts.model.spec, undefined, feedback, previous, opts.signal);
          } catch {
            return null;
          }
        }
      : undefined;
  const built = await verifyAndBuild(doc, plan, enabled, draft, ctx, refine, (iteration, score, note) => iterations.push({ type: 'iteration', iteration, score, note, at: now() }));
  for (const e of iterations) yield e;

  const rewrite: Rewrite = {
    id: `${analysis.id}-rw-${startedAt.toString(36)}`,
    analysisId: analysis.id,
    status: 'done',
    startedAt,
    finishedAt: now(),
    sections: built.sections,
    lines: built.lines,
    diffs: built.hunks,
    placeholders: built.placeholders,
    projected: built.projected,
    current: built.current,
    iterations: built.iterations,
    notes: built.notes,
    aiUsed,
    enabledPlanItemIds,
  };
  for (const s of built.sections) {
    yield { type: 'section', section: s, lines: built.lines.filter((l) => s.lineIds.includes(l.id)), at: now() };
  }
  yield { type: 'complete', rewrite, at: now() };
  return rewrite;
}
