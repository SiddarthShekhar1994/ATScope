/**
 * Definition-of-done check: parse → score → plan → rewrite (no model) →
 * fill every placeholder → export PDF and DOCX → parse and score the exports
 * with the same engine. The exported files must land in the 89–99 band.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseResumeFile } from '../lib/parse';
import { scoreResume, buildContext } from '../lib/score';
import { buildPlan } from '../lib/rewrite/planner';
import { verifyAndBuild } from '../lib/rewrite/verifier';
import { buildExportDoc, exportText, unfilledPlaceholders } from '../lib/export/model';
import { exportPdf } from '../lib/export/pdf';
import { exportDocx } from '../lib/export/docx';
import type { Rewrite } from '../lib/schema/rewrite';

const file = process.argv[2] ?? 'samples/weak-sidebar.docx';

function fillValue(hint: string): string {
  const h = hint.toLowerCase();
  if (/email/.test(h)) return 'person@example.com';
  if (/phone/.test(h)) return '(555) 010-2030';
  if (/linkedin/.test(h)) return 'linkedin.com/in/example';
  if (/city|location/.test(h)) return 'Austin, TX';
  if (/url|portfolio|github/.test(h)) return 'github.com/example';
  if (/dates?|yyyy/.test(h)) return 'Jan 2020 – Dec 2022';
  if (/name/.test(h)) return 'Full Name';
  if (/result|outcome|improv|headline/.test(h)) return 'cutting turnaround time 30%';
  if (/audience|attendance|volume|amount/.test(h)) return '4,000';
  if (/quantity|scale/.test(h)) return '12 projects';
  return '12';
}

void (async () => {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const doc = await parseResumeFile(bytes, path.basename(file), 'rt');
  const ctx = buildContext(doc, {});
  const before = scoreResume(doc, ctx);
  const { plan } = buildPlan(doc, before.categories, before.rawTotal);
  const enabled = new Set(plan.filter((p) => p.enabled).map((p) => p.id));
  const built = await verifyAndBuild(doc, plan, enabled, null, ctx);
  const rewrite: Rewrite = {
    id: 'rt',
    analysisId: 'rt',
    status: 'done',
    startedAt: 0,
    sections: built.sections,
    lines: built.lines,
    diffs: built.hunks,
    placeholders: built.placeholders,
    projected: built.projected,
    current: built.current,
    iterations: built.iterations,
    notes: built.notes,
    aiUsed: false,
    enabledPlanItemIds: [...enabled],
  };
  const accepted = Object.fromEntries(rewrite.diffs.map((h) => [h.id, h.accepted]));
  const values = Object.fromEntries(rewrite.placeholders.map((p) => [p.id, fillValue(p.hint)]));
  const lines = buildExportDoc(doc, rewrite, accepted, values);
  const leftover = unfilledPlaceholders(lines);
  console.log(`\n${path.basename(file)}: original ${before.overallScore} → projected ${built.projected.overallScore} · ${rewrite.placeholders.length} placeholders filled · leftover brackets: ${leftover.length}`);

  const outDir = path.join(process.cwd(), 'samples', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const stem = path.basename(file).replace(/\.[^.]+$/, '');
  const pdf = await exportPdf(lines);
  const docx = await exportDocx(lines);
  fs.writeFileSync(path.join(outDir, `${stem}-ats.pdf`), pdf);
  fs.writeFileSync(path.join(outDir, `${stem}-ats.docx`), docx);
  fs.writeFileSync(path.join(outDir, `${stem}-ats.txt`), exportText(lines));

  for (const [name, data] of [
    [`${stem}-ats.pdf`, pdf],
    [`${stem}-ats.docx`, docx],
  ] as const) {
    const parsed = await parseResumeFile(new Uint8Array(data), name, 'rt-out');
    const ctx2 = buildContext(parsed, { roleId: ctx.roleId });
    const score = scoreResume(parsed, ctx2);
    console.log(`  ${name.padEnd(28)} → ${score.overallScore} (${score.scoreBand})  cats: ${score.categories.map((c) => `${c.id} ${c.score}`).join(' | ')}  engines: ${score.perEngineScores.map((e) => `${e.label} ${e.score}`).join(', ')}`);
    console.log(`     layout: cols ${parsed.layout.columns}, tables ${parsed.layout.tableCount}, lost ${parsed.lines.filter((l) => l.source !== 'body').length}, entries ${parsed.entries.length}, sections ${parsed.sections.map((s) => s.id).join(',')}`);
    const top = score.categories.flatMap((c) => c.findings.slice(0, 2).map((f) => `${c.id}: -${f.pointCost} "${f.quote.slice(0, 50)}" ${f.explanation.slice(0, 90)}`));
    if (top.length) console.log('     remaining: ' + top.slice(0, 5).join('\n                '));
  }
})();
