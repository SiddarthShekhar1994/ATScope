import type { RawExtraction, ParsedResume } from './types';
import { buildParsedResume } from './ats-simulation';
import { SECTION_HEADINGS, normalizeHeading } from './headings';

/**
 * Build a document model from plain text. Used to score rewrites (which are
 * always single-column plain text) with exactly the same engine that scored the
 * upload, so the two numbers are comparable.
 */
export function rawFromText(text: string): RawExtraction {
  const rows = text.replace(/\r\n?/g, '\n').split('\n');
  const items: RawExtraction['items'] = [];
  const nonEmpty = rows.filter((r) => r.trim().length > 0);
  const total = Math.max(1, nonEmpty.length);
  let stream = 0;
  for (const row of rows) {
    const t = row.replace(/\s+$/g, '');
    if (!t.trim()) continue;
    const isHeading = SECTION_HEADINGS.has(normalizeHeading(t)) && t.trim().split(/\s+/).length <= 4;
    items.push({
      text: t.trim(),
      page: 1,
      bbox: { x: 0.08, y: 0.04 + (stream / total) * 0.92, w: 0.84, h: 0.012 },
      font: { bold: isHeading, size: isHeading ? 12 : 11 },
      source: 'body',
      streamIndex: stream++,
      hasEOL: true,
    });
  }
  return {
    fileType: 'text',
    pageCount: Math.max(1, Math.ceil(nonEmpty.length / 55)),
    items,
    images: [],
    textBoxes: [],
    tables: [],
    headerText: [],
    footerText: [],
    fonts: ['Arial'],
    warnings: [],
  };
}

export function parseFromText(text: string, id: string, fileName = 'rewrite.txt'): ParsedResume {
  const raw = rawFromText(text);
  return buildParsedResume(raw, { id, fileName, fileSize: text.length, parserMs: 0 });
}
