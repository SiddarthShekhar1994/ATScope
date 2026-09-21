import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ExportLine } from './model';

/**
 * ATS-safe PDF: US Letter, single column, embedded standard Helvetica (no
 * subsetting surprises), real text (no outlines), no headers, footers, tables,
 * images or text boxes. Bullets are the plain "•" glyph. Headings are bold caps
 * with a hairline so humans can scan it too.
 */
const PAGE = { w: 612, h: 792 };
const MARGIN = 54; // 0.75in
const INK = rgb(0.09, 0.08, 0.07);
const MUTED = rgb(0.35, 0.33, 0.3);
const RULE = rgb(0.75, 0.73, 0.7);

export async function exportPdf(lines: ExportLine[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setProducer('ATScope');
  pdf.setCreator('ATScope');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const name = lines.find((l) => l.kind === 'name');
  if (name) pdf.setTitle(`${name.text} — Resume`);

  let page = pdf.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;
  const width = PAGE.w - MARGIN * 2;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - MARGIN;
    }
  };
  const draw = (text: string, x: number, size: number, font: PDFFont, color = INK, maxWidth = width - (x - MARGIN)) => {
    const rows = wrap(sanitize(text), font, size, maxWidth);
    const lineH = size * 1.32;
    for (const row of rows) {
      ensure(lineH);
      page.drawText(row, { x, y: y - size, size, font, color });
      y -= lineH;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    switch (l.kind) {
      case 'name':
        draw(l.text, MARGIN, 20, bold);
        y -= 2;
        break;
      case 'headline':
        draw(l.text, MARGIN, 11, regular, MUTED);
        break;
      case 'contact':
        draw(l.text, MARGIN, 9.5, regular, MUTED);
        y -= 4;
        break;
      case 'heading': {
        y -= 8;
        ensure(28);
        const size = 10.5;
        page.drawText(sanitize(l.text).toUpperCase(), { x: MARGIN, y: y - size, size, font: bold, color: INK });
        y -= size + 3;
        rule(page, MARGIN, y, width);
        y -= 6;
        break;
      }
      case 'entry':
        y -= 3;
        draw(l.text, MARGIN, 10.5, bold);
        break;
      case 'bullet': {
        const size = 10;
        const indent = 14;
        const rows = wrap(sanitize(l.text), regular, size, width - indent);
        const lineH = size * 1.34;
        for (let r = 0; r < rows.length; r++) {
          ensure(lineH);
          if (r === 0) page.drawText('•', { x: MARGIN + 2, y: y - size, size, font: regular, color: INK });
          page.drawText(rows[r], { x: MARGIN + indent, y: y - size, size, font: regular, color: INK });
          y -= lineH;
        }
        break;
      }
      default:
        draw(l.text, MARGIN, 10, regular);
    }
  }
  return pdf.save();
}

function rule(page: PDFPage, x: number, y: number, w: number) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.6, color: RULE });
}

/** Greedy word wrap using real glyph widths. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !cur) cur = next;
    else {
      rows.push(cur);
      cur = w;
    }
  }
  if (cur) rows.push(cur);
  return rows.length ? rows : [''];
}

/**
 * Standard fonts use WinAnsi, which covers Latin-1 plus the common typographic
 * marks (dashes, curly quotes, bullet, ellipsis, middle dot). Anything else is
 * mapped to a plain equivalent or dropped so the export never throws.
 */
const WINANSI_EXTRA = [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x2030, 0x20ac, 0x2122];
const SQUARE_BULLETS = [0x25aa, 0x25cf, 0x25e6, 0x2023];
const ARROWS = [0x2192, 0x27a2, 0x25ba];

function sanitize(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (SQUARE_BULLETS.includes(cp)) out += '-';
    else if (ARROWS.includes(cp)) out += '->';
    else if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA.includes(cp)) out += ch;
  }
  return out;
}
