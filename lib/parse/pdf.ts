import { getDocumentProxy, getResolvedPDFJS } from 'unpdf';
import type { RawExtraction, RawTextItem, BBox } from './types';

/**
 * Geometry-aware PDF extraction.
 *
 * We keep every text run with its page box and its position in the content
 * stream. The ATS simulation later linearises those runs the way a parser
 * does (stream order), while the human view is rebuilt from geometry.
 */

interface Fragment {
  text: string;
  page: number;
  x: number; // pt, left
  yTop: number; // pt from top
  yBase: number; // pt from top (baseline)
  w: number;
  h: number;
  fontName: string;
  fontSize: number;
  streamIndex: number;
  hasEOL: boolean;
}

const HEADER_BAND = 0.055;
const FOOTER_BAND = 0.945;

export async function extractPdf(data: Uint8Array): Promise<RawExtraction> {
  const pdfjs = await getResolvedPDFJS();
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const doc = await getDocumentProxy(data);
  const warnings: string[] = [];
  const fonts = new Set<string>();
  const images: RawExtraction['images'] = [];
  const fragments: Fragment[] = [];
  const pageSizes: { w: number; h: number }[] = [];
  let stream = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const W = viewport.width;
    const H = viewport.height;
    pageSizes.push({ w: W, h: H });

    // Operator list first: it populates commonObjs with real font names and
    // lets us count image draws.
    let shapeCount = 0;
    try {
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (
          fn === OPS.paintImageXObject ||
          fn === OPS.paintInlineImageXObject ||
          fn === OPS.paintImageMaskXObject ||
          fn === OPS.paintImageXObjectRepeat
        ) {
          images.push({ page: p, description: 'Embedded image' });
        }
        if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke) shapeCount++;
      }
    } catch (err) {
      warnings.push(`Could not read drawing operators on page ${p}: ${(err as Error).message}`);
    }
    if (shapeCount > 12) {
      images.push({ page: p, description: `${shapeCount} filled vector shapes (rating bars, dots or icons)` });
    }

    const content = await page.getTextContent();
    const styles = content.styles as Record<string, { fontFamily?: string }>;

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const [a, b, , d, e, f] = item.transform as number[];
      const fontSize = Math.max(Math.hypot(a, b), Math.abs(d), 1);
      const height = item.height || fontSize;
      const yBaseFromTop = H - f;
      let fontName = item.fontName;
      try {
        const obj = page.commonObjs.has(fontName) ? (page.commonObjs.get(fontName) as { name?: string }) : null;
        if (obj?.name) fontName = obj.name;
        else if (styles[item.fontName]?.fontFamily) fontName = styles[item.fontName].fontFamily as string;
      } catch {
        /* commonObjs may not be populated for every font */
      }
      fonts.add(fontName.replace(/^[A-Z]{6}\+/, ''));
      if (item.str.trim().length === 0) {
        // Whitespace-only runs still terminate lines.
        if (item.hasEOL && fragments.length) fragments[fragments.length - 1].hasEOL = true;
        continue;
      }
      fragments.push({
        text: item.str,
        page: p,
        x: e,
        yTop: yBaseFromTop - height * 0.8,
        yBase: yBaseFromTop,
        w: item.width,
        h: height,
        fontName,
        fontSize,
        streamIndex: stream++,
        hasEOL: item.hasEOL,
      });
    }
  }

  const merged = mergeRuns(fragments);
  const items: RawTextItem[] = merged.map((fr) => {
    const size = pageSizes[fr.page - 1];
    const bbox: BBox = {
      x: clamp(fr.x / size.w),
      y: clamp(fr.yTop / size.h),
      w: clamp(fr.w / size.w),
      h: clamp(fr.h / size.h),
    };
    const lower = fr.fontName.toLowerCase();
    const source: RawTextItem['source'] =
      bbox.y + bbox.h < HEADER_BAND ? 'header' : bbox.y > FOOTER_BAND ? 'footer' : 'body';
    return {
      text: fr.text,
      page: fr.page,
      bbox,
      font: {
        bold: /bold|black|heavy|semibold|demi/.test(lower),
        size: Math.round(fr.fontSize * 10) / 10,
        name: fr.fontName,
      },
      source,
      streamIndex: fr.streamIndex,
      hasEOL: fr.hasEOL,
    };
  });

  // Header/footer text must be *repeated* structure or contact-like to count; a
  // name set at the very top of a page with tight margins is still body text.
  const headerText: string[] = [];
  const footerText: string[] = [];
  for (const it of items) {
    if (it.source === 'header') {
      if (looksLikeHeaderContent(it.text, items, it.page)) headerText.push(it.text);
      else it.source = 'body';
    } else if (it.source === 'footer') {
      if (looksLikeFooterContent(it.text)) footerText.push(it.text);
      else it.source = 'body';
    }
  }

  if (items.length === 0) warnings.push('No text layer found. This PDF is probably a scanned image.');

  return {
    fileType: 'pdf',
    pageCount: doc.numPages,
    items,
    images,
    textBoxes: [],
    tables: [],
    headerText,
    footerText,
    fonts: [...fonts],
    warnings,
  };
}

/** Join adjacent runs on the same baseline into one fragment when the gap is a word space, not a column gap. */
function mergeRuns(frags: Fragment[]): Fragment[] {
  const out: Fragment[] = [];
  for (const fr of frags) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.page === fr.page &&
      !prev.hasEOL &&
      Math.abs(prev.yBase - fr.yBase) < Math.max(prev.fontSize, fr.fontSize) * 0.45 &&
      fr.x >= prev.x + prev.w - 1 &&
      fr.x - (prev.x + prev.w) < Math.max(prev.fontSize, fr.fontSize) * 1.6
    ) {
      const gap = fr.x - (prev.x + prev.w);
      const needsSpace = gap > Math.max(prev.fontSize, fr.fontSize) * 0.12 && !prev.text.endsWith(' ') && !fr.text.startsWith(' ');
      prev.text = prev.text + (needsSpace ? ' ' : '') + fr.text;
      prev.w = fr.x + fr.w - prev.x;
      prev.h = Math.max(prev.h, fr.h);
      prev.yTop = Math.min(prev.yTop, fr.yTop);
      prev.hasEOL = fr.hasEOL;
      if (/bold|black|heavy/i.test(fr.fontName) && !/bold|black|heavy/i.test(prev.fontName)) {
        // keep the dominant font of the run; bold headings are usually a single run anyway
      }
      continue;
    }
    out.push({ ...fr });
  }
  return out;
}

function looksLikeHeaderContent(text: string, items: RawTextItem[], page: number): boolean {
  const t = text.trim();
  if (/@|\+?\d[\d\s().-]{7,}|linkedin\.com|github\.com|https?:\/\//i.test(t)) return true;
  // Repeated on another page's top band => running header.
  const repeats = items.filter((i) => i.page !== page && i.bbox.y + i.bbox.h < HEADER_BAND && i.text.trim() === t);
  return repeats.length > 0;
}

function looksLikeFooterContent(text: string): boolean {
  const t = text.trim();
  return /^page\s*\d+|^\d+\s*(of|\/)\s*\d+$|^\d{1,2}$|@|\+?\d[\d\s().-]{7,}|confidential|résumé|resume|curriculum|linkedin|github/i.test(t) || t.length < 4;
}

function clamp(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}
