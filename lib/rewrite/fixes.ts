import { streamObject } from 'ai';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import type { ParsedResume } from '../parse/types';
import type { Finding } from '../score/types';
import { providerOptions } from '../ai/model';
import { sanitizeBullet, originalNumbers, originalTerms } from './verifier';

/**
 * Model-written fixes for the findings that need prose (weak bullets, generic
 * phrasing). Streams one element at a time so each finding can dock the moment
 * its fix exists. Every fix is scrubbed against the upload before it is used.
 */

const FixItem = z.object({
  findingId: z.string().describe('The finding id exactly as given.'),
  fix: z.string().describe('The single rewritten line. Only facts from the resume. Use [[hint]] for any number that is not in the resume.'),
});

export const FIXABLE_RULES = new Set(['weak-bullet', 'weak-opener', 'generic-phrase', 'filler', 'passive', 'first-person', 'objective-summary', 'overlong']);

export async function* streamFixes(doc: ParsedResume, findings: Finding[], model: LanguageModel, spec: string, signal?: AbortSignal): AsyncGenerator<{ findingId: string; fix: string }> {
  const targets = findings.filter((f) => FIXABLE_RULES.has(f.ruleId));
  if (targets.length === 0) return;
  // One fix per line: several findings can point at the same line.
  const byLine = new Map<string, Finding[]>();
  for (const f of targets) byLine.set(f.lineRef, [...(byLine.get(f.lineRef) ?? []), f]);
  const items = [...byLine.entries()].slice(0, 40).map(([lineRef, fs]) => {
    const line = doc.lines.find((l) => l.id === lineRef);
    const entry = line?.entryIndex !== undefined ? doc.entries[line.entryIndex] : undefined;
    return {
      id: fs[0].id,
      allIds: fs.map((f) => f.id),
      lineRef,
      text: line?.text ?? fs[0].quote,
      context: entry ? `${entry.title ?? ''} at ${entry.org ?? ''} (${entry.dates ?? ''})`.trim() : line?.section ?? '',
      problems: fs.map((f) => f.explanation).join(' '),
    };
  });
  const numbers = originalNumbers(doc);
  const terms = originalTerms(doc);
  const resumeText = doc.lines
    .filter((l) => l.source === 'body' || l.source === 'table')
    .map((l) => `${l.id}: ${l.text}`)
    .join('\n');

  const result = streamObject({
    model,
    output: 'array',
    schema: FixItem,
    reasoning: 'low',
    providerOptions: providerOptions(spec),
    abortSignal: signal,
    instructions: [
      'You rewrite single resume lines so an applicant tracking system and a recruiter both rate them higher.',
      'Rules, in priority order:',
      '1. Use only facts present in the resume text. Never invent employers, dates, tools, teams, or numbers.',
      '2. Where a number would strengthen the line and none exists, insert a placeholder in double square brackets with a short hint, e.g. [[number of accounts]] or [[% reduction in turnaround]]. One or two placeholders per line at most.',
      '3. Open with a specific past-tense action verb. Never use: spearheaded, leveraged, utilized, synergy, cutting-edge, results-driven, dynamic, passionate, seasoned, delve, robust.',
      '4. State the outcome: what changed because of the work.',
      '5. Keep it to one line, 12–28 words. No first person. No filler ("various", "as needed").',
      '6. Vary sentence structure across lines; do not end every line with "by [[X]]%".',
      'Return one object per input finding id, with the finding id unchanged.',
    ].join('\n'),
    prompt: `RESUME (line ids for reference):\n${resumeText}\n\nLINES TO FIX:\n${items.map((it) => `- findingId: ${it.id}\n  line ${it.lineRef} (${it.context}): "${it.text}"\n  problems: ${it.problems}`).join('\n')}`,
  });

  const seen = new Set<string>();
  for await (const el of result.elementStream) {
    const item = items.find((it) => it.id === el.findingId || it.allIds.includes(el.findingId));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    const notes: string[] = [];
    const cleaned = sanitizeBullet(el.fix, numbers, terms, notes, item.context || 'this line');
    if (cleaned.rejected) continue;
    for (const id of item.allIds) yield { findingId: id, fix: cleaned.text };
  }
}
