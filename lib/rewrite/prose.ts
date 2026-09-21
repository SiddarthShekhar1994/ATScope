import { streamObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { ParsedResume } from '../parse/types';
import type { PlanItem } from '../schema/analysis';
import { RewriteOutputSchema, type RewriteOutput } from '../schema/rewrite';
import type { ScoringContext, KeywordMap } from '../score/types';
import { providerOptions } from '../ai/model';
import { entryLabel } from '../score/util';

/**
 * The model's job is prose, not structure: bullets, summary, skills grouping,
 * and keyword additions it can justify with a quote. The structural builder
 * places everything; the verifier checks every claim.
 */

export interface ProseProgress {
  entryId?: string;
  bulletsSoFar: number;
  totalEntries: number;
  entriesDone: number;
}

function buildPrompt(doc: ParsedResume, plan: PlanItem[], enabledIds: Set<string>, ctx: ScoringContext, keywordMap: KeywordMap | undefined, feedback?: string[], previous?: RewriteOutput) {
  const enabled = plan.filter((p) => enabledIds.has(p.id) || p.locked);
  const bulletEntries = new Set(enabled.filter((p) => p.kind === 'bullets').map((p) => String(p.data?.entryId ?? '')));
  const remaining = enabled.find((p) => p.kind === 'bullets' && /remaining/.test(p.change));
  const entries = doc.entries
    .filter((e) => e.section === 'experience' || e.section === 'projects' || e.section === 'volunteer')
    .map((e) => {
      const rewrite = bulletEntries.has(e.id) || (remaining ? e.bulletLineIds.some((id) => remaining.lineRefs.includes(id)) : false);
      const bullets = e.bulletLineIds.map((id) => doc.lines.find((l) => l.id === id)).filter(Boolean) as ParsedResume['lines'];
      return `${e.id} — ${entryLabel(e)} (${e.dates ?? 'no dates'}) ${rewrite ? '[REWRITE THESE BULLETS]' : '[KEEP AS IS — return no bullets for this entry]'}\n${bullets.map((b) => `    ${b.id}: ${b.text}`).join('\n')}`;
    })
    .join('\n');
  const summaryLines = doc.lines.filter((l) => l.section === 'summary' && l.kind !== 'heading').map((l) => `${l.id}: ${l.text}`);
  const skillLines = doc.lines.filter((l) => l.section === 'skills' && l.kind !== 'heading').map((l) => `${l.id}: ${l.text}`);
  const summaryOn = enabled.some((p) => p.kind === 'summary');
  const supported = (keywordMap?.missing ?? []).filter((m) => m.supportedBy?.length).map((m) => `${m.term} (implied by ${m.supportedBy!.join(', ')})`);
  const unsupported = (keywordMap?.missing ?? []).filter((m) => !m.supportedBy?.length).map((m) => m.term);
  const overused = (keywordMap?.overused ?? []).map((o) => `${o.term} (${o.count}×)`);

  const prompt = [
    `TARGET: ${ctx.targetLabel}${ctx.jdText ? `\n\nJOB DESCRIPTION (for vocabulary only; do not claim anything from it):\n${ctx.jdText.slice(0, 4000)}` : ''}`,
    `\nFULL RESUME TEXT (line ids):\n${doc.lines
      .filter((l) => l.source !== 'footer')
      .map((l) => `${l.id}: ${l.text}`)
      .join('\n')}`,
    `\nENTRIES:\n${entries}`,
    `\nSUMMARY LINES: ${summaryOn ? '(rewrite as 2–3 sentences of fact)' : '(keep; return an empty summary array)'}\n${summaryLines.join('\n') || '(none)'}`,
    `\nSKILLS LINES (regroup into plain "Group: a, b, c" lines; keep every real tool, drop personality traits):\n${skillLines.join('\n') || '(none — build the list only from tools named in the bullets)'}`,
    supported.length ? `\nKEYWORDS YOU MAY ADD (already implied by the resume): ${supported.join('; ')}` : '',
    unsupported.length ? `\nKEYWORDS THE TARGET WANTS BUT THE RESUME DOES NOT SUPPORT — add one ONLY if you can quote a line that genuinely demonstrates it: ${unsupported.slice(0, 20).join(', ')}` : '',
    overused.length ? `\nOVERUSED TERMS — keep each to at most three mentions across the document: ${overused.join(', ')}` : '',
    feedback && feedback.length ? `\nPREVIOUS ATTEMPT SCORED BELOW TARGET. Fix these while keeping every rule:\n${feedback.map((f) => `- ${f}`).join('\n')}\n\nPREVIOUS OUTPUT (revise it, do not start from scratch):\n${JSON.stringify(previous).slice(0, 12000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return prompt;
}

const INSTRUCTIONS = [
  'You rewrite resumes so they parse cleanly and rank well in applicant tracking systems, while staying strictly truthful.',
  'Hard rules:',
  '1. Every fact must come from the resume text provided: employers, titles, dates, tools, numbers. Do not add anything the person did not state. If a claim is not in the text, it does not go in.',
  '2. Where a number would make a bullet stronger and the resume has none, write a placeholder in double square brackets with a short hint: [[number of clients]], [[% faster]], [[$ saved]]. At most two per bullet.',
  '3. Each bullet: specific past-tense action verb → what you did and at what scale → the outcome. 12–28 words. Vary the sentence shape; do not end every bullet the same way.',
  '4. Banned words: spearheaded, leveraged, leverage, utilized, utilize, synergy, cutting-edge, results-driven, dynamic, passionate, seasoned, delve, robust, proven track record, team player, detail-oriented, self-starter, fast-paced.',
  '5. No first person. No filler (various, numerous, as needed, etc.).',
  '6. Skills: group real tools and methods into up to four "Group: a, b, c" lines. Drop traits (communication, hard worker).',
  '7. addedKeywords: for every target keyword you introduce that was not literally in the resume, give the exact quote from the resume that justifies it. If you cannot quote evidence, do not add the keyword.',
  '8. For each bullet set originLineId to the line you rewrote. Keep one bullet per original bullet unless two originals say the same thing.',
  '9. Return only entries marked [REWRITE THESE BULLETS]; for others return nothing.',
].join('\n');

export async function draftRewrite(
  doc: ParsedResume,
  plan: PlanItem[],
  enabledIds: Set<string>,
  ctx: ScoringContext,
  keywordMap: KeywordMap | undefined,
  model: LanguageModel,
  spec: string,
  onProgress?: (p: ProseProgress) => void,
  feedback?: string[],
  previous?: RewriteOutput,
  signal?: AbortSignal,
): Promise<RewriteOutput> {
  const totalEntries = plan.filter((p) => p.kind === 'bullets' && (enabledIds.has(p.id) || p.locked)).length;
  const result = streamObject({
    model,
    schema: RewriteOutputSchema,
    schemaName: 'ResumeRewrite',
    schemaDescription: 'A truthful, ATS-friendly rewrite of the resume prose.',
    reasoning: 'medium',
    providerOptions: providerOptions(spec),
    abortSignal: signal,
    instructions: INSTRUCTIONS,
    prompt: buildPrompt(doc, plan, enabledIds, ctx, keywordMap, feedback, previous),
  });
  let lastEntries = -1;
  let lastBullets = -1;
  for await (const partial of result.partialObjectStream) {
    const entries = partial.entries ?? [];
    const bullets = entries.reduce((n, e) => n + (e?.bullets?.length ?? 0), 0);
    const done = Math.max(0, entries.length - 1);
    if (done !== lastEntries || bullets !== lastBullets) {
      lastEntries = done;
      lastBullets = bullets;
      onProgress?.({ entryId: entries[entries.length - 1]?.entryId ?? undefined, bulletsSoFar: bullets, totalEntries, entriesDone: done });
    }
  }
  return result.object;
}
