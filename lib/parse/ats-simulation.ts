import type { RawExtraction, ParsedResume, ResumeLine, AtsLine, DroppedElement, ReadingOrderIssue, LayoutInfo, RawTextItem } from './types';
import { toResumeLines, GLYPH_ISSUES, NON_STANDARD_BULLETS, EMAIL_RE, PHONE_RE } from './lines';
import { assignSections } from './sections';

/**
 * Turn a raw extraction into the full document model, including the "ATS view":
 * the text as a position-sorting parser (PDFBox / Tika style) or a document-order
 * parser (DOCX) actually receives it. Nothing here is invented — every ATS line
 * points back at the human lines it was built from.
 */
export function buildParsedResume(raw: RawExtraction, meta: { id: string; fileName: string; fileSize: number; parserMs: number }): ParsedResume {
  const { lines, columnsPerPage, itemLineIds } = toResumeLines(raw);
  const { sections, entries, contact } = assignSections(lines);

  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lineFor = (it: RawTextItem): ResumeLine | undefined => lineById.get(itemLineIds[it.streamIndex]);

  const columns = Math.max(1, ...Object.values(columnsPerPage).map((c) => c.columns), raw.declaredColumns ?? 1);
  const dataTables = new Map<string, RawTextItem[]>();
  for (const it of raw.items) if (it.table) dataTables.set(it.table.id, [...(dataTables.get(it.table.id) ?? []), it]);

  const atsLines: AtsLine[] = [];
  const readingOrderIssues: ReadingOrderIssue[] = [];
  const dropped: DroppedElement[] = [];

  if (raw.fileType === 'pdf') {
    // Position-sorted extraction: every fragment on a baseline joins one row, columns be damned.
    const body = raw.items.filter((i) => i.source === 'body').sort((a, b) => a.page - b.page || a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
    const rows: RawTextItem[][] = [];
    for (const it of body) {
      const row = rows[rows.length - 1];
      const tol = Math.max(0.004, it.bbox.h * 0.45);
      if (row && row[0].page === it.page && Math.abs(row[0].bbox.y - it.bbox.y) < tol) row.push(it);
      else rows.push([it]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.bbox.x - b.bbox.x);
      const ids = uniq(row.map((it) => lineFor(it)?.id).filter(Boolean) as string[]);
      const cols = uniq(row.map((it) => lineFor(it)?.column ?? 0));
      const text = row.map((it) => it.text.trim()).join(' ').replace(/\s+/g, ' ');
      const mangled = cols.length > 1;
      atsLines.push({ text, fromLineIds: ids, mangled, note: mangled ? 'Two columns read as one line' : undefined });
    }
    if (columns > 1) {
      const merged = atsLines.filter((l) => l.mangled).slice(0, 4);
      if (merged.length) {
        readingOrderIssues.push({
          id: 'RO1',
          kind: 'column-interleave',
          description: `${atsLines.filter((l) => l.mangled).length} rows merge text from both columns. A position-sorting parser reads "${merged[0].text.slice(0, 90)}" as one line.`,
          lineRefs: merged.flatMap((m) => m.fromLineIds).slice(0, 8),
        });
      }
    }
    // Content-stream order versus visual order.
    const bodyLines = lines.filter((l) => l.source === 'body');
    const byStream = [...bodyLines].sort((a, b) => (a.streamIndex ?? 0) - (b.streamIndex ?? 0));
    const displaced = bodyLines.filter((l, i) => Math.abs(byStream.indexOf(l) - i) > 6);
    if (bodyLines.length > 10 && displaced.length > bodyLines.length * 0.25 && columns === 1) {
      readingOrderIssues.push({
        id: `RO${readingOrderIssues.length + 1}`,
        kind: 'out-of-order',
        description: `The PDF content stream lists ${displaced.length} of ${bodyLines.length} lines far from where they appear on the page. Parsers that read in stream order (pdf.js, PDFBox default) see "${byStream[0].text.slice(0, 60)}" first.`,
        lineRefs: displaced.slice(0, 6).map((l) => l.id),
      });
    }
  } else {
    // Document order; data tables flatten row by row.
    const ordered = [...raw.items].sort((a, b) => a.streamIndex - b.streamIndex);
    const doneRows = new Set<string>();
    for (const it of ordered) {
      if (it.source !== 'body' && it.source !== 'table') continue;
      if (it.table) {
        const key = `${it.table.id}:${it.table.row}`;
        if (doneRows.has(key)) continue;
        doneRows.add(key);
        const cells = ordered.filter((o) => o.table && o.table.id === it.table!.id && o.table.row === it.table!.row);
        const ids = uniq(cells.map((c) => lineFor(c)?.id).filter(Boolean) as string[]);
        const distinctCols = uniq(cells.map((c) => c.table!.col)).length;
        atsLines.push({
          text: cells.map((c) => c.text.replace(/^•\s*/, '').trim()).join(' ').replace(/\s+/g, ' '),
          fromLineIds: ids,
          mangled: distinctCols > 1,
          note: distinctCols > 1 ? `Table row flattened: ${distinctCols} cells merged` : undefined,
        });
        continue;
      }
      const line = lineFor(it);
      atsLines.push({ text: it.text.replace(/\s+/g, ' ').trim(), fromLineIds: line ? [line.id] : [] });
    }
    for (const [id, cells] of dataTables) {
      const cols = uniq(cells.map((c) => c.table!.col)).length;
      if (cols > 1) {
        readingOrderIssues.push({
          id: `RO${readingOrderIssues.length + 1}`,
          kind: 'table-flatten',
          description: `Table ${id} (${uniq(cells.map((c) => c.table!.row)).length} rows × ${cols} columns) is flattened cell by cell: "${cells
            .slice(0, cols)
            .map((c) => c.text.trim())
            .join(' ')
            .slice(0, 80)}".`,
          lineRefs: uniq(cells.map((c) => lineFor(c)?.id).filter(Boolean) as string[]).slice(0, 6),
        });
      }
    }
    if (columns > 1) {
      const col1 = lines.filter((l) => l.column === 1).slice(0, 3);
      readingOrderIssues.push({
        id: `RO${readingOrderIssues.length + 1}`,
        kind: 'column-interleave',
        description: `The layout uses ${columns} columns built from a table. Parsers read the cells in file order and lose which heading each block belongs to.`,
        lineRefs: col1.map((l) => l.id),
      });
    }
  }

  // Dropped elements ------------------------------------------------------
  const headerLines = lines.filter((l) => l.source === 'header');
  const footerLines = lines.filter((l) => l.source === 'footer');
  const boxLines = lines.filter((l) => l.source === 'textbox');
  if (headerLines.length) {
    const text = headerLines.map((l) => l.text).join(' · ');
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'header',
      description: /@|\d{3}[\s.-]\d{4}/.test(text) ? 'Contact details sit in the page header. Parsers that skip headers never see them.' : 'Text in the page header is skipped by most parsers.',
      text,
      lineRefs: headerLines.map((l) => l.id),
      page: 1,
      severity: EMAIL_RE.test(text) || PHONE_RE.test(text) ? 'high' : 'low',
    });
  }
  if (footerLines.length) {
    const text = footerLines.map((l) => l.text).join(' · ');
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'footer',
      description: 'Text in the page footer is skipped by most parsers.',
      text,
      lineRefs: footerLines.map((l) => l.id),
      severity: EMAIL_RE.test(text) || PHONE_RE.test(text) ? 'high' : 'low',
    });
  }
  if (boxLines.length) {
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'textbox',
      description: `${raw.textBoxes.length} text box${raw.textBoxes.length === 1 ? '' : 'es'} float outside the document flow. Their text is invisible to the parser.`,
      text: boxLines.map((l) => l.text).join(' · ').slice(0, 300),
      lineRefs: boxLines.map((l) => l.id),
      severity: 'high',
    });
  }
  for (const [id, cells] of dataTables) {
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'table',
      description: `Table ${id} with ${cells.length} cells. Cell boundaries disappear; content runs together in row order.`,
      text: cells
        .slice(0, 6)
        .map((c) => c.text.trim())
        .join(' | ')
        .slice(0, 200),
      lineRefs: uniq(cells.map((c) => lineFor(c)?.id).filter(Boolean) as string[]).slice(0, 8),
      severity: 'high',
    });
  }
  if (columns > 1) {
    const right = lines.filter((l) => l.column === 1 && l.source === 'body');
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'column',
      description: `${columns}-column layout. Single-column documents parse cleanly in Workday, Greenhouse, Lever and Taleo; multi-column ones get interleaved or split.`,
      text: right
        .slice(0, 4)
        .map((l) => l.text)
        .join(' · ')
        .slice(0, 200),
      lineRefs: right.slice(0, 6).map((l) => l.id),
      severity: 'high',
    });
  }
  const imgByPage = new Map<number, number>();
  for (const im of raw.images) imgByPage.set(im.page, (imgByPage.get(im.page) ?? 0) + 1);
  for (const [page, n] of imgByPage) {
    const nearest = lines.find((l) => l.page === page && l.source === 'body');
    const vector = raw.images.find((i) => i.page === page && /vector/.test(i.description));
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'image',
      description: vector
        ? `${vector.description} on page ${page}. Skill bars and rating dots carry no text; the parser sees nothing.`
        : `${n} image${n === 1 ? '' : 's'} on page ${page}. Photos, logos and icon glyphs are discarded.`,
      lineRefs: nearest ? [nearest.id] : [],
      page,
      severity: 'low',
    });
  }
  const glyphLines = lines.filter((l) => GLYPH_ISSUES.test(l.raw));
  if (glyphLines.length) {
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'glyph',
      description: `${glyphLines.length} line${glyphLines.length === 1 ? '' : 's'} contain icon-font or ligature characters that arrive as garbage (e.g. "${showGlyphs(glyphLines[0].raw)}").`,
      text: glyphLines
        .slice(0, 3)
        .map((l) => showGlyphs(l.raw))
        .join(' · '),
      lineRefs: glyphLines.slice(0, 6).map((l) => l.id),
      severity: glyphLines.some((l) => l.section === 'contact' || l.kind === 'contact') ? 'medium' : 'low',
    });
  }
  const symbolBullets = lines.filter((l) => l.bullet && NON_STANDARD_BULLETS.test(l.raw));
  if (symbolBullets.length) {
    dropped.push({
      id: `D${dropped.length + 1}`,
      kind: 'icon',
      description: `${symbolBullets.length} bullets use a symbol-font glyph ("${symbolBullets[0].bullet}"). Some parsers keep the glyph as text; use "•" or "-".`,
      lineRefs: symbolBullets.slice(0, 6).map((l) => l.id),
      severity: 'low',
    });
  }

  const bodyText = lines.filter((l) => l.source === 'body' || l.source === 'table').map((l) => l.text);
  const layout: LayoutInfo = {
    pageCount: raw.pageCount,
    columns,
    singleColumn: columns === 1,
    tableCount: dataTables.size,
    tableCellCount: [...dataTables.values()].reduce((n, c) => n + c.length, 0),
    headerText: raw.headerText,
    footerText: raw.footerText,
    imageCount: raw.images.length,
    textBoxCount: raw.textBoxes.length,
    fonts: raw.fonts.slice(0, 12),
    ligatureLineIds: glyphLines.map((l) => l.id),
    symbolBulletLineIds: symbolBullets.map((l) => l.id),
    wordCount: bodyText.join(' ').split(/\s+/).filter(Boolean).length,
    charCount: bodyText.join('').length,
  };

  return {
    id: meta.id,
    fileName: meta.fileName,
    fileType: raw.fileType,
    fileSize: meta.fileSize,
    lines,
    sections,
    entries,
    layout,
    contact,
    atsLines,
    atsPlainText: atsLines.map((l) => l.text).join('\n'),
    dropped,
    readingOrderIssues,
    meta: { parsedAt: new Date().toISOString(), parserMs: meta.parserMs, warnings: raw.warnings },
  };
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function showGlyphs(s: string): string {
  return s
    .replace(new RegExp('[\\uE000-\\uF8FF]', 'g'), String.fromCharCode(0xfffd))
    .replace(new RegExp('[\\uFB00-\\uFB06]', 'g'), (c) => '‹' + c + '›')
    .slice(0, 60);
}
