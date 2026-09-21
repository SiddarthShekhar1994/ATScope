import fs from 'node:fs';
import path from 'node:path';
import { parseResumeFile } from '../lib/parse';
import { scoreResume, buildContext } from '../lib/score';

const file = process.argv[2];
const jdFile = process.argv[3];
if (!file) {
  console.error('usage: tsx scripts/score-check.ts <resume> [jd.txt]');
  process.exit(1);
}
void (async () => {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const doc = await parseResumeFile(bytes, path.basename(file), 'test');
  const jd = jdFile ? fs.readFileSync(jdFile, 'utf8') : undefined;
  const ctx = buildContext(doc, { jd });
  const t0 = Date.now();
  const result = scoreResume(doc, ctx);
  const ms = Date.now() - t0;
  console.log(`\n${path.basename(file)} → OVERALL ${result.overallScore} (${result.scoreBand}, raw ${result.rawTotal}) in ${ms}ms  target=${ctx.targetLabel} [${ctx.targetSource}]`);
  console.log('engines:', result.perEngineScores.map((e) => `${e.label} ${e.score}`).join(' | '));
  for (const c of result.categories) {
    const sum = c.findings.reduce((n, f) => n + f.pointCost, 0);
    console.log(`\n== ${c.label} (w${c.weight}) score ${c.score}  [findings cost Σ=${sum.toFixed(1)}]  ${c.summary}`);
    for (const f of c.findings.slice(0, 6)) {
      console.log(`   -${f.pointCost.toString().padStart(5)}  ${f.severity.padEnd(6)} ${f.lineRef.padEnd(4)} "${f.quote.slice(0, 70)}"`);
      console.log(`          ${f.explanation}`);
      console.log(`          FIX: ${f.fix}`);
    }
    if (c.findings.length > 6) console.log(`   … ${c.findings.length - 6} more`);
  }
  console.log('\nkeywords present:', result.keywordMap.present.map((k) => `${k.term}(${k.count})`).join(', '));
  console.log('keywords missing:', result.keywordMap.missing.map((k) => `${k.term}[w${k.weight}${k.supportedBy ? ' via ' + k.supportedBy.join('/') : ''}]`).join(', '));
})();
