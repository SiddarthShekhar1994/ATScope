/**
 * Runs the real engine on the sample resume and freezes the result into
 * lib/demo/sample.json. The landing page's live demo replays these events —
 * same parser, same scorer, same findings — with timings taken from a real run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseResumeFile } from '../lib/parse';
import { runAnalysis } from '../lib/analysis/pipeline';
import type { AnalysisEvent, Analysis } from '../lib/schema/analysis';

void (async () => {
  const file = path.join(process.cwd(), 'samples', 'weak-two-column.pdf');
  const bytes = new Uint8Array(fs.readFileSync(file));
  const doc = await parseResumeFile(bytes, 'jordan-blake.pdf', 'demo');
  const events: AnalysisEvent[] = [];
  const gen = runAnalysis(doc, { model: { model: null, spec: 'none', provider: 'none', available: false } });
  let analysis: Analysis | undefined;
  for (;;) {
    const step = await gen.next();
    if (step.done) {
      analysis = step.value;
      break;
    }
    events.push(step.value);
  }
  const t0 = events[0]?.at ?? 0;
  const relative = events.map((e) => ({ ...e, at: e.at - t0 }));
  const out = {
    doc: {
      ...doc,
      meta: { ...doc.meta, parsedAt: '2026-01-01T00:00:00.000Z' },
    },
    target: analysis!.target,
    events: relative.filter((e) => e.type !== 'finding-resolved'),
  };
  fs.mkdirSync(path.join(process.cwd(), 'lib', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'lib', 'demo', 'sample.json'), JSON.stringify(out));
  console.log(`demo written: ${events.length} events, score ${analysis!.overallScore}, ${doc.lines.length} lines`);
})();
