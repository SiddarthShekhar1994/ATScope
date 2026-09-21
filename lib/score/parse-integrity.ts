import type { CategoryScorer, Finding } from './types';
import { finding, CATEGORY_META, clamp100 } from './types';
import { nameLine, firstLine, lineMap, capCosts } from './util';
import { showGlyphs } from '../parse/ats-simulation';

/**
 * Parse integrity: how much of the document survives a parser. Every finding
 * points at the element that gets lost or scrambled. Single-column, table-free,
 * header-free documents score 100 here across all four engines.
 */
export const scoreParseIntegrity: CategoryScorer = (doc) => {
  const meta = CATEGORY_META.parse;
  const byId = lineMap(doc);
  const anchor = nameLine(doc) ?? firstLine(doc);
  const groups: Finding[][] = [];
  const dropped = doc.dropped;

  const column = dropped.find((d) => d.kind === 'column');
  if (column) {
    const merged = doc.atsLines.filter((l) => l.mangled);
    const example = merged[0];
    const ref = column.lineRefs[0] ?? anchor.id;
    const line = byId.get(ref) ?? anchor;
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'multi-column',
        quote: line.text,
        lineRef: line.id,
        relatedLineRefs: column.lineRefs,
        severity: 'high',
        pointCost: 30,
        explanation: example
          ? `${doc.layout.columns}-column layout. A position-sorting parser merges both columns line by line: it reads "${example.text.slice(0, 80)}" as a single sentence. ${merged.length} lines are scrambled this way.`
          : `${doc.layout.columns}-column layout built from a table. Parsers read the cells in file order and lose which heading each block belongs to.`,
        fix: 'Rebuild as one column, top to bottom: contact, summary, experience, education, skills.',
        fixKind: 'layout',
        data: { columns: doc.layout.columns },
      }),
    ]);
  }

  groups.push(
    capCosts(
      dropped
        .filter((d) => d.kind === 'table')
        .map((d) => {
          const line = byId.get(d.lineRefs[0]) ?? anchor;
          return finding({
            categoryId: 'parse',
            ruleId: 'table',
            quote: line.text,
            lineRef: line.id,
            relatedLineRefs: d.lineRefs,
            severity: 'high',
            pointCost: 10,
            explanation: `${d.description} Taleo and Workday flatten tables cell by cell, so "${(d.text ?? '').split(' | ').slice(0, 2).join('" and "')}" become one run of words with no label.`,
            fix: 'Replace the table with plain lines: "Label: item, item, item".',
            fixKind: 'layout',
          });
        }),
      30,
    ),
  );

  const header = dropped.find((d) => d.kind === 'header');
  if (header) {
    const line = byId.get(header.lineRefs[0]) ?? anchor;
    const hasContact = header.severity === 'high';
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'header-text',
        quote: line.text,
        lineRef: line.id,
        relatedLineRefs: header.lineRefs,
        severity: hasContact ? 'high' : 'low',
        pointCost: hasContact ? 15 : 5,
        explanation: hasContact
          ? `Your contact line lives in the page header region. Most parsers extract body text only; the email and phone on this line never reach the candidate record.`
          : `Text in the page header ("${line.text.slice(0, 60)}") is skipped by most parsers.`,
        fix: hasContact ? 'Move the contact line into the body, directly below your name.' : 'Move it into the body or delete it.',
        fixKind: 'layout',
      }),
    ]);
  }
  const footer = dropped.find((d) => d.kind === 'footer');
  if (footer) {
    const line = byId.get(footer.lineRefs[0]) ?? anchor;
    const hasContact = footer.severity === 'high';
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'footer-text',
        quote: line.text,
        lineRef: line.id,
        severity: hasContact ? 'medium' : 'low',
        pointCost: hasContact ? 8 : 2,
        explanation: hasContact ? 'Contact details in the footer are skipped by most parsers.' : `Footer text ("${line.text.slice(0, 50)}") is skipped by parsers; harmless here, but it can be misread as body text by the ones that do read it.`,
        fix: hasContact ? 'Move contact details into the body.' : 'Remove the footer.',
        fixKind: 'layout',
      }),
    ]);
  }

  const boxes = dropped.filter((d) => d.kind === 'textbox');
  groups.push(
    capCosts(
      boxes.map((d) => {
        const line = byId.get(d.lineRefs[0]) ?? anchor;
        return finding({
          categoryId: 'parse',
          ruleId: 'textbox',
          quote: line.text,
          lineRef: line.id,
          relatedLineRefs: d.lineRefs,
          severity: 'high',
          pointCost: 12,
          explanation: `"${line.text.slice(0, 60)}" sits in a floating text box. Text boxes are outside the document flow; parsers do not read them at all.`,
          fix: 'Move the text into the main body as normal paragraphs.',
          fixKind: 'layout',
        });
      }),
      24,
    ),
  );

  groups.push(
    capCosts(
      dropped
        .filter((d) => d.kind === 'image')
        .map((d) => {
          const line = byId.get(d.lineRefs[0]) ?? anchor;
          const vector = /vector/.test(d.description);
          return finding({
            categoryId: 'parse',
            ruleId: vector ? 'vector-graphics' : 'image',
            quote: line.text,
            lineRef: line.id,
            severity: 'low',
            pointCost: 5,
            explanation: d.description,
            fix: vector ? 'Replace rating bars and icons with plain text; a bar has no words to parse.' : 'Remove photos, logos and icon images. If an image carried text, retype it.',
            fixKind: 'layout',
          });
        }),
      15,
    ),
  );

  const glyph = dropped.find((d) => d.kind === 'glyph');
  if (glyph) {
    const line = byId.get(glyph.lineRefs[0]) ?? anchor;
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'glyphs',
        quote: showGlyphs(line.raw),
        lineRef: line.id,
        relatedLineRefs: glyph.lineRefs,
        severity: glyph.severity === 'medium' ? 'medium' : 'low',
        pointCost: glyph.severity === 'medium' ? 8 : 5,
        explanation: `Icon-font or ligature characters arrive as garbage: this line extracts as "${showGlyphs(line.raw)}". ${glyph.lineRefs.length} line${glyph.lineRefs.length === 1 ? '' : 's'} affected${glyph.severity === 'medium' ? ', including contact details' : ''}.`,
        fix: 'Replace icon glyphs with words ("Email:", "Phone:") and turn off ligatures in the export.',
        fixKind: 'layout',
      }),
    ]);
  }
  const icons = dropped.find((d) => d.kind === 'icon');
  if (icons) {
    const line = byId.get(icons.lineRefs[0]) ?? anchor;
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'symbol-bullets',
        quote: line.raw,
        lineRef: line.id,
        relatedLineRefs: icons.lineRefs,
        severity: 'low',
        pointCost: 3,
        explanation: icons.description,
        fix: 'Use the standard bullet "•" or a hyphen.',
        fixKind: 'layout',
      }),
    ]);
  }

  for (const issue of doc.readingOrderIssues.filter((i) => i.kind === 'out-of-order')) {
    const line = byId.get(issue.lineRefs[0]) ?? anchor;
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'stream-order',
        quote: line.text,
        lineRef: line.id,
        relatedLineRefs: issue.lineRefs,
        severity: 'medium',
        pointCost: 8,
        explanation: issue.description,
        fix: 'Re-export from the source document (Word/Docs → PDF) rather than a design tool; that writes the stream in reading order.',
        fixKind: 'layout',
      }),
    ]);
  }

  if (doc.fileSize > 2 * 1024 * 1024) {
    groups.push([
      finding({
        categoryId: 'parse',
        ruleId: 'file-size',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'low',
        pointCost: 5,
        explanation: `The file is ${(doc.fileSize / 1024 / 1024).toFixed(1)} MB for ${doc.layout.wordCount} words. Several portals cap uploads at 2 MB, and the weight means embedded images.`,
        fix: 'Export as a text PDF without images; expect under 200 KB.',
        fixKind: 'layout',
      }),
    ]);
  }

  const findings = groups.flat().sort((a, b) => b.pointCost - a.pointCost);
  const total = findings.reduce((n, f) => n + f.pointCost, 0);
  const score = clamp100(Math.round(100 - total));
  const lost = doc.lines.filter((l) => l.source !== 'body' && l.source !== 'table').length;
  const mangled = doc.atsLines.filter((l) => l.mangled).length;
  return {
    id: 'parse',
    label: meta.label,
    weight: meta.weight,
    score,
    summary:
      findings.length === 0
        ? 'Single column, no tables, no header text. Everything on the page reaches the parser in order.'
        : `${doc.layout.columns} column${doc.layout.columns === 1 ? '' : 's'}, ${doc.layout.tableCount} table${doc.layout.tableCount === 1 ? '' : 's'}; ${lost} line${lost === 1 ? '' : 's'} invisible to parsers, ${mangled} scrambled.`,
    findings,
    facts: [
      { label: 'Columns', value: String(doc.layout.columns) },
      { label: 'Tables', value: String(doc.layout.tableCount) },
      { label: 'Lines lost', value: String(lost) },
      { label: 'Lines scrambled', value: String(mangled) },
    ],
  };
};
