/**
 * Exercises the model code path without an API key: a MockLanguageModelV4
 * streams canned JSON through streamObject exactly as a provider would. The
 * canned rewrite deliberately includes a fabricated number and a tool the
 * resume never mentions, so this also proves the verifier catches both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';
import { parseResumeFile } from '../lib/parse';
import { scoreResume, buildContext } from '../lib/score';
import { buildPlan } from '../lib/rewrite/planner';
import { streamFixes } from '../lib/rewrite/fixes';
import { runRewrite } from '../lib/rewrite/rewriter';
import { runAnalysis } from '../lib/analysis/pipeline';
import type { Analysis } from '../lib/schema/analysis';

function textStreamModel(json: string) {
  const chunks = json.match(/[^]{1,40}/g) ?? [];
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't1' },
        ...chunks.map((delta) => ({ type: 'text-delta' as const, id: 't1', delta })),
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: { unified: 'stop' as const, raw: 'stop' }, usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 20, reasoning: 0 } } },
      ]),
    }),
  });
}

void (async () => {
  const file = 'samples/weak-sidebar.docx';
  const doc = await parseResumeFile(new Uint8Array(fs.readFileSync(file)), path.basename(file), 'mock');
  const ctx = buildContext(doc, {});
  const score = scoreResume(doc, ctx);
  const findings = score.categories.flatMap((c) => c.findings);
  const weak = findings.filter((f) => f.ruleId === 'weak-bullet').slice(0, 2);

  // 1. Fixes stream (array output): one fix per finding id, element by element.
  const fixesJson = JSON.stringify({ elements: weak.map((f) => ({ findingId: f.id, fix: 'Built [[number]] operations dashboards in Tableau, cutting weekly reporting time by [[%]].' })) });
  console.log('fixes stream:');
  for await (const fix of streamFixes(doc, findings, textStreamModel(fixesJson), 'mock/test')) console.log('  ', fix.findingId, '→', fix.fix);

  // 2. Rewrite draft (object output) fed through the full rewriter + verifier.
  const exp = doc.entries.filter((e) => e.section === 'experience');
  const rewriteJson = JSON.stringify({
    headline: 'Data Analyst',
    summary: ['Data analyst with 2 years at Nimbus Health and Coastal Bank, building dashboards in Tableau and SQL.', 'Cut weekly reporting time by 45% for a 30-person operations team.'],
    entries: exp.map((e) => ({
      entryId: e.id,
      bullets: e.bulletLineIds.map((id, i) => ({
        originLineId: id,
        text: i === 0 ? 'Built 14 Tableau dashboards for the operations team, cutting weekly reporting time by 45%.' : i === 1 ? 'Automated ad hoc analysis with Snowflake and dbt, saving [[hours]] per week.' : 'Partnered with [[number]] stakeholders to translate requirements into SQL models, [[result]].',
        reason: 'Verb first, scale, outcome.',
      })),
    })),
    skills: [
      { group: 'Data', items: ['SQL', 'Python', 'Tableau', 'Excel', 'Snowflake'] },
      { group: 'Methods', items: ['A/B testing', 'Data cleaning', 'Communication'] },
    ],
    addedKeywords: [
      { keyword: 'data analysis', evidence: 'Helped with weekly reporting and ad hoc analysis.' },
      { keyword: 'power bi', evidence: 'this quote does not exist in the resume' },
    ],
  });
  const analysis: Analysis = await (async () => {
    const gen = runAnalysis(doc, { model: { model: null, spec: 'none', provider: 'none', available: false } });
    for (;;) {
      const s = await gen.next();
      if (s.done) return s.value;
    }
  })();
  const { plan } = buildPlan(doc, score.categories, score.rawTotal);
  const enabled = plan.filter((p) => p.enabled).map((p) => p.id);
  console.log('\nrewrite stream:');
  const gen = runRewrite(doc, analysis, enabled, { model: { model: textStreamModel(rewriteJson), spec: 'mock/test', provider: 'mock', available: true } });
  for (;;) {
    const s = await gen.next();
    if (s.done) {
      const rw = s.value;
      console.log(`  done: aiUsed=${rw.aiUsed} projected=${rw.projected?.overallScore} current=${rw.current?.overallScore} iterations=${rw.iterations}`);
      console.log('  notes:');
      for (const n of rw.notes) console.log('   -', n);
      console.log('  experience bullets:');
      for (const l of rw.lines.filter((l) => l.kind === 'bullet')) console.log('   •', l.text);
      console.log('  skills:', rw.lines.filter((l) => l.section === 'skills' && l.kind !== 'heading').map((l) => l.text).join(' | '));
      break;
    }
    if (s.value.type !== 'section') console.log('  ', s.value.type, 'message' in s.value ? s.value.message : 'note' in s.value ? `${s.value.note}` : '');
  }
})();
