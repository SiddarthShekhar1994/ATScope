import type { RawExtraction, RawTextItem, ResumeLine, LineKind } from './types';
import { SECTION_HEADINGS, normalizeHeading } from './headings';

// Private-use (icon font) and ligature ranges are written as escaped strings so
// the source stays readable; the characters themselves are invisible in editors.
const PUA = '\\uE000-\\uF8FF';
export const BULLET_GLYPHS = new RegExp('^\\s*([•·▪■●○◦➢➤►▶✓✔✗✦❖◆◇→\\-–—*]|o\\s|[' + PUA + '])\\s*');
export const NON_STANDARD_BULLETS = new RegExp('^\\s*([➢➤►▶✓✔✗✦❖◆◇→■●○◦]|[' + PUA + '])');
export const GLYPH_ISSUES = new RegExp('[\\uFB00-\\uFB06' + PUA + '\\uFFFD]');

export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
export const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/;
export const URL_RE = /(https?:\/\/[^\s|]+|(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\/[^\s|,]+|\b[\w-]+\.(?:dev|io|me|com)\/?[^\s|,]*)/i;
export const LOCATION_RE = /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s?([A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/;

/**
 * A column is detected when a vertical band in the middle of the page is
 * empty across most body rows *and* the right-hand block has a consistent left
 * edge (right-aligned dates do not qualify).
 */
export function detectColumns(items: RawTextItem[], page: number): { columns: number; divider: number } {
  const body = items.filter((i) => i.page === page && i.source === 'body' && i.text.trim().length > 1);
  if (body.length < 8) return { columns: 1, divider: 1 };
  const BINS = 100;
  const cover = new Array<number>(BINS).fill(0);
  for (const it of body) {
    const a = Math.max(0, Math.floor(it.bbox.x * BINS));
    const b = Math.min(BINS - 1, Math.ceil((it.bbox.x + it.bbox.w) * BINS));
    for (let k = a; k <= b; k++) cover[k]++;
  }
  const allow = Math.max(1, Math.floor(body.length * 0.05));
  let best: { start: number; end: number } | null = null;
  let run: number | null = null;
  for (let k = Math.floor(BINS * 0.2); k <= Math.floor(BINS * 0.8); k++) {
    if (cover[k] <= allow) {
      if (run === null) run = k;
    } else if (run !== null) {
      if (!best || k - run > best.end - best.start) best = { start: run, end: k };
      run = null;
    }
  }
  if (run !== null && (!best || Math.floor(BINS * 0.8) - run > best.end - best.start)) best = { start: run, end: Math.floor(BINS * 0.8) };
  if (!best || best.end - best.start < 3) return { columns: 1, divider: 1 };
  const divider = (best.start + best.end) / 2 / BINS;
  const left = body.filter((i) => i.bbox.x + i.bbox.w <= divider + 0.01);
  const right = body.filter((i) => i.bbox.x >= divider - 0.01);
  if (left.length < 5 || right.length < 5) return { columns: 1, divider: 1 };
  // Right block must be left-aligned (a real column), not a ragged set of right-aligned dates.
  const xs = right.map((i) => i.bbox.x);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  const nonDate = right.filter((i) => !DATE_LIKE.test(i.text)).length;
  if (sd > 0.04 || nonDate < right.length * 0.4) return { columns: 1, divider: 1 };
  // Blocks must overlap vertically (side by side, not stacked).
  const yr = (list: RawTextItem[]) => [Math.min(...list.map((i) => i.bbox.y)), Math.max(...list.map((i) => i.bbox.y + i.bbox.h))];
  const [l0, l1] = yr(left);
  const [r0, r1] = yr(right);
  const overlap = Math.min(l1, r1) - Math.max(l0, r0);
  if (overlap < 0.2) return { columns: 1, divider: 1 };
  return { columns: 2, divider };
}

const DATE_LIKE = /\b(19|20)\d{2}\b|present|current/i;
/** A dated entry line, as opposed to a wrapped fragment that happens to end in a year. */
const DATE_RANGE_LIKE = /\b(19|20)\d{2}\s*(?:[–—-]|to)\s*(?:(19|20)\d{2}|present|current)|^(?:[A-Z][a-z]+\.? ?)?'?\d{2,4}\s*[–—-]/i;

interface VisualLine {
  items: RawTextItem[];
  page: number;
  column: number;
  y: number;
  source: RawTextItem['source'];
}

/**
 * Assemble visual lines: fragments on the same baseline within the same column
 * (and the same table cell) become one line. Output is in human reading order:
 * page, then column, then top-to-bottom.
 */
export function buildVisualLines(raw: RawExtraction): { lines: VisualLine[]; columnsPerPage: Record<number, { columns: number; divider: number }> } {
  const columnsPerPage: Record<number, { columns: number; divider: number }> = {};
  const lines: VisualLine[] = [];
  for (let p = 1; p <= raw.pageCount; p++) {
    const col = raw.fileType === 'pdf' ? detectColumns(raw.items, p) : { columns: raw.declaredColumns ?? 1, divider: 0.5 };
    columnsPerPage[p] = col;
    const pageItems = raw.items.filter((i) => i.page === p);
    const assign = (it: RawTextItem): number => {
      if (col.columns < 2) return 0;
      if (raw.fileType === 'docx') return it.table ? 0 : it.bbox.x < 0.5 ? 0 : 1;
      if (it.bbox.x + it.bbox.w <= col.divider + 0.01) return 0;
      if (it.bbox.x >= col.divider - 0.01) return 1;
      return 0; // spans the gutter (e.g. a full-width name)
    };
    const sorted = [...pageItems].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
    for (const it of sorted) {
      const column = assign(it);
      const tol = Math.max(0.004, (it.bbox.h || 0.012) * 0.45);
      const existing =
        raw.fileType === 'pdf'
          ? lines.find((l) => l.page === p && l.column === column && l.source === it.source && Math.abs(l.y - it.bbox.y) < tol && sameCell(l.items[0], it))
          : undefined;
      if (existing) {
        existing.items.push(it);
        existing.items.sort((a, b) => a.bbox.x - b.bbox.x);
      } else {
        lines.push({ items: [it], page: p, column, y: it.bbox.y, source: it.source });
      }
    }
  }
  const sourceRank: Record<string, number> = { header: 0, body: 1, table: 1, textbox: 2, footer: 3 };
  lines.sort((a, b) => a.page - b.page || sourceRank[a.source] - sourceRank[b.source] || a.column - b.column || a.y - b.y);
  return { lines, columnsPerPage };
}

function sameCell(a: RawTextItem, b: RawTextItem): boolean {
  if (!a.table && !b.table) return true;
  if (!a.table || !b.table) return false;
  return a.table.id === b.table.id && a.table.row === b.table.row && a.table.col === b.table.col;
}

export function lineText(items: RawTextItem[]): string {
  let out = '';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i > 0) {
      const prev = items[i - 1];
      const gap = it.bbox.x - (prev.bbox.x + prev.bbox.w);
      out += gap > 0.06 ? '   ' : ' ';
    }
    out += it.text;
  }
  return out.replace(/[ \t]+/g, (m) => (m.length >= 3 ? '   ' : ' ')).trim();
}

export function toResumeLines(raw: RawExtraction): {
  lines: ResumeLine[];
  columnsPerPage: Record<number, { columns: number; divider: number }>;
  itemLineIds: Record<number, string>;
} {
  const { lines: visual, columnsPerPage } = buildVisualLines(raw);
  const lines: ResumeLine[] = [];
  const itemLineIds: Record<number, string> = {};
  const maxSize = Math.max(...raw.items.map((i) => i.font?.size ?? 0), 0);
  const medianSize = median(raw.items.map((i) => i.font?.size ?? 0).filter((s) => s > 0)) || 11;

  visual.forEach((vl, idx) => {
    const rawText = lineText(vl.items);
    if (!rawText) return;
    const bulletMatch = rawText.match(BULLET_GLYPHS);
    const bullet = bulletMatch ? bulletMatch[1] : undefined;
    const text = (bullet ? rawText.replace(BULLET_GLYPHS, '') : rawText).trim();
    const size = Math.max(...vl.items.map((i) => i.font?.size ?? 0));
    const bold = vl.items.every((i) => i.font?.bold) || (vl.items[0]?.font?.bold === true && vl.items.length === 1);
    const x0 = Math.min(...vl.items.map((i) => i.bbox.x));
    const x1 = Math.max(...vl.items.map((i) => i.bbox.x + i.bbox.w));
    const y0 = Math.min(...vl.items.map((i) => i.bbox.y));
    const y1 = Math.max(...vl.items.map((i) => i.bbox.y + i.bbox.h));
    const line: ResumeLine = {
      id: `L${lines.length + 1}`,
      index: lines.length,
      text,
      raw: rawText,
      page: vl.page,
      kind: 'text',
      source: vl.source,
      section: 'unknown',
      bullet,
      bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      column: vl.column,
      font: { bold, size: size || undefined, name: vl.items[0]?.font?.name },
      streamIndex: Math.min(...vl.items.map((i) => i.streamIndex)),
    };
    line.kind = classifyKind(line, { idx, maxSize, medianSize, isFirstBody: lines.every((l) => l.source !== 'body') && vl.source === 'body' });
    for (const it of vl.items) itemLineIds[it.streamIndex] = line.id;
    lines.push(line);
  });
  const merged = raw.fileType === 'pdf' ? mergeWrappedLines(lines, itemLineIds) : lines;
  return { lines: merged, columnsPerPage, itemLineIds };
}

/**
 * PDFs have no paragraphs, only lines. A bullet that wraps arrives as a bullet
 * line followed by a glyph-less continuation. Rejoin continuations so a wrapped
 * bullet is scored as one bullet, the way a person reads it. The signal is the
 * previous line running to the column's right edge (or the continuation
 * starting lowercase), same column, same font size, no new bullet or date.
 */
function mergeWrappedLines(lines: ResumeLine[], itemLineIds: Record<number, string>): ResumeLine[] {
  const rightEdge = new Map<string, number>();
  for (const l of lines) {
    if (!l.bbox) continue;
    const key = `${l.page}:${l.column ?? 0}:${l.source}`;
    rightEdge.set(key, Math.max(rightEdge.get(key) ?? 0, l.bbox.x + l.bbox.w));
  }
  const out: ResumeLine[] = [];
  const remap: Record<string, string> = {};
  for (const l of lines) {
    const prev = out[out.length - 1];
    const key = `${l.page}:${l.column ?? 0}:${l.source}`;
    const edge = rightEdge.get(key) ?? 1;
    const canContinue =
      prev &&
      prev.page === l.page &&
      (prev.column ?? 0) === (l.column ?? 0) &&
      prev.source === l.source &&
      (prev.kind === 'bullet' || prev.kind === 'text') &&
      l.kind === 'text' &&
      !l.bullet &&
      !DATE_RANGE_LIKE.test(l.text) &&
      Math.abs((prev.font?.size ?? 0) - (l.font?.size ?? 0)) < 0.6 &&
      !!prev.bbox &&
      !!l.bbox &&
      l.bbox.y - (prev.bbox.y + prev.bbox.h) < prev.bbox.h * 0.9 &&
      !/[.!?:;]$/.test(prev.text) &&
      (prev.bbox.x + prev.bbox.w > edge - 0.08 || (/^[a-z]/.test(l.text) && !DATE_LIKE.test(l.text)));
    if (canContinue) {
      prev.text = `${prev.text} ${l.text}`;
      prev.raw = `${prev.raw} ${l.raw}`;
      prev.bbox = { x: Math.min(prev.bbox!.x, l.bbox!.x), y: prev.bbox!.y, w: Math.max(prev.bbox!.x + prev.bbox!.w, l.bbox!.x + l.bbox!.w) - Math.min(prev.bbox!.x, l.bbox!.x), h: l.bbox!.y + l.bbox!.h - prev.bbox!.y };
      remap[l.id] = prev.id;
      continue;
    }
    out.push(l);
  }
  if (Object.keys(remap).length === 0) return lines;
  for (const k of Object.keys(itemLineIds)) if (remap[itemLineIds[Number(k)]]) itemLineIds[Number(k)] = remap[itemLineIds[Number(k)]];
  // Re-number so ids stay dense and match what people see.
  const idMap: Record<string, string> = {};
  out.forEach((l, i) => {
    idMap[l.id] = `L${i + 1}`;
    l.id = `L${i + 1}`;
    l.index = i;
  });
  for (const k of Object.keys(itemLineIds)) itemLineIds[Number(k)] = idMap[itemLineIds[Number(k)]] ?? itemLineIds[Number(k)];
  return out;
}

const US_STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';
/** "Austin, TX", "San Jose, CA", "Austin TX" (after a separator), "Remote". */
export const STRICT_LOCATION_RE = new RegExp(
  String.raw`\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){0,2}),\s?([A-Z]{2})\b|(?:^|[,|•·]\s*|\s[–—-]\s)([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?)\s(?:${US_STATES})\b|\b(Remote|Hybrid)\b`,
);

function classifyKind(line: ResumeLine, ctx: { idx: number; maxSize: number; medianSize: number; isFirstBody: boolean }): LineKind {
  const t = line.text;
  if (line.bullet) return 'bullet';
  const words = t.split(/\s+/).length;
  if (EMAIL_RE.test(t) || PHONE_RE.test(t) || URL_RE.test(t.replace(EMAIL_RE, ''))) return 'contact';
  const norm = normalizeHeading(t);
  const inTable = line.source === 'table';
  if (SECTION_HEADINGS.has(norm) && words <= 5 && !inTable) return 'heading';
  const isCaps = t === t.toUpperCase() && /[A-Z]/.test(t) && (words >= 2 || t.replace(/[^A-Z]/g, '').length >= 6);
  const big = (line.font?.size ?? 0) >= ctx.medianSize * 1.15;
  if (ctx.isFirstBody && words >= 2 && words <= 4 && /^[A-Z][a-zA-Z'.-]+(\s[A-Z][a-zA-Z'.-]+){1,3}$/.test(t.replace(/\s+/g, ' ')) && !/\d/.test(t)) return 'name';
  if (line.page === 1 && (line.font?.size ?? 0) === ctx.maxSize && words <= 4 && !/\d/.test(t) && ctx.maxSize > ctx.medianSize * 1.3) return 'name';
  const labelValue = /:\s*\S/.test(t);
  if (!inTable && !labelValue && words <= 5 && !/[.;,]$/.test(t) && (line.font?.bold || isCaps || (big && words <= 3)) && !/\d{4}/.test(t) && t.length < 40) return 'heading';
  if (STRICT_LOCATION_RE.test(t) && words <= 6 && !/\d{4}/.test(t)) return 'contact';
  if (line.index < 8 && LOCATION_RE.test(t) && words <= 4 && !/\d{4}/.test(t)) return 'contact';
  return 'text';
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
