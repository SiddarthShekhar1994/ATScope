import fs from 'node:fs';
import path from 'node:path';
import { parseResumeFile } from '../lib/parse';

const file = process.argv[2];
if (!file) {
  console.error('usage: tsx scripts/parse-check.ts <file>');
  process.exit(1);
}
void (async () => {
const bytes = new Uint8Array(fs.readFileSync(file));
const doc = await parseResumeFile(bytes, path.basename(file), "test");
console.log('=== LAYOUT', JSON.stringify(doc.layout));
console.log('=== CONTACT', JSON.stringify(doc.contact));
console.log('=== SECTIONS', doc.sections.map((s) => `${s.id}${s.nonStandardHeading ? '*' : ''}(${s.title}: ${s.lineIds.length})`).join(' | '));
console.log('=== ENTRIES');
for (const e of doc.entries) console.log(`  ${e.id} [${e.section}] title=${e.title} org=${e.org} dates=${e.dates} loc=${e.location} bullets=${e.bulletLineIds.length} parseable=${e.dateParseable}`);
console.log('=== LINES (human order)');
for (const l of doc.lines) console.log(`  ${l.id.padEnd(4)} p${l.page} c${l.column} ${l.source.padEnd(7)} ${l.kind.padEnd(8)} ${l.section.padEnd(12)} ${l.bullet ? '[' + l.bullet + '] ' : ''}${l.text}`);
console.log('=== ATS VIEW');
for (const a of doc.atsLines) console.log(`  ${a.mangled ? '!!' : '  '} ${a.text}${a.note ? '   <-- ' + a.note : ''}`);
console.log('=== DROPPED');
for (const d of doc.dropped) console.log(`  [${d.severity}] ${d.kind}: ${d.description} ${d.text ? '"' + d.text.slice(0, 80) + '"' : ''} refs=${d.lineRefs.join(',')}`);
console.log('=== READING ORDER');
for (const r of doc.readingOrderIssues) console.log(`  ${r.kind}: ${r.description} refs=${r.lineRefs.join(',')}`);
console.log('=== WARNINGS', doc.meta.warnings, 'ms', doc.meta.parserMs);
})();
