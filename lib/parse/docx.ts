import JSZip from 'jszip';
import { parseXml, findAll, childByTag, type XmlNode } from './xml';
import type { RawExtraction, RawTextItem } from './types';

/**
 * DOCX extraction straight from WordprocessingML.
 *
 * We deliberately do not use mammoth here: mammoth (like most ATS parsers)
 * silently drops headers, footers and text boxes. We want to *see* those so we
 * can tell the user what disappeared.
 */

interface Para {
  text: string;
  bold: boolean;
  size?: number;
  bullet: boolean;
  heading: boolean;
  pageBreakBefore: boolean;
}

export async function extractDocx(data: Uint8Array): Promise<RawExtraction> {
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Not a Word document: word/document.xml is missing.');
  const warnings: string[] = [];
  const root = parseXml(docXml);
  const body = findFirstTag(root, 'w:body');
  if (!body) throw new Error('Word document has no body.');

  const fonts = new Set<string>();
  for (const rf of findAll(root, 'w:rFonts')) {
    for (const key of ['w:ascii', 'w:hAnsi']) if (rf.attrs[key]) fonts.add(rf.attrs[key]);
  }
  try {
    const styles = await zip.file('word/styles.xml')?.async('string');
    if (styles) {
      const m = styles.match(/w:rFonts[^>]*w:ascii="([^"]+)"/);
      if (m) fonts.add(m[1]);
    }
  } catch {
    /* optional */
  }

  const items: RawTextItem[] = [];
  const tables: RawExtraction['tables'] = [];
  const textBoxes: RawExtraction['textBoxes'] = [];
  const images: RawExtraction['images'] = [];
  let stream = 0;
  let page = 1;
  let order = 0; // paragraph order, used to synthesise a y position
  const totalParas = Math.max(1, countParagraphs(body));
  let declaredColumns: number | undefined;

  const imageIds = new Set<string>();
  for (const blip of findAll(root, 'a:blip')) {
    const id = blip.attrs['r:embed'] || blip.attrs['r:link'] || `blip-${imageIds.size}`;
    imageIds.add(id);
  }
  for (const v of findAll(root, 'v:imagedata')) imageIds.add(v.attrs['r:id'] || `vml-${imageIds.size}`);
  for (const id of imageIds) images.push({ page: 1, description: `Embedded image (${id})` });

  // Text boxes: AlternateContent carries the same box twice (Choice + Fallback).
  const seenBoxes = new Set<string>();
  for (const box of findAll(root, 'w:txbxContent')) {
    const text = findAll(box, 'w:p')
      .map((p) => paragraphOf(p).text.trim())
      .filter(Boolean)
      .join('\n');
    if (!text || seenBoxes.has(text)) continue;
    seenBoxes.add(text);
    textBoxes.push({ page: 1, text });
  }

  const pushPara = (para: Para, opts: { source?: RawTextItem['source']; column?: number; columns?: number; table?: RawTextItem['table'] } = {}) => {
    if (para.pageBreakBefore) page++;
    const text = para.text.replace(/\s+/g, ' ').trim();
    order++;
    if (!text) return;
    const y = Math.min(0.98, 0.04 + (order / totalParas) * 0.92);
    const columns = opts.columns ?? 1;
    const col = opts.column ?? 0;
    items.push({
      text: (para.bullet ? '• ' : '') + text,
      page,
      bbox: { x: columns > 1 ? col / columns + 0.02 : 0.08, y, w: columns > 1 ? 1 / columns - 0.04 : 0.84, h: 0.012 },
      font: { bold: para.bold, size: para.size, name: undefined },
      source: opts.source ?? 'body',
      streamIndex: stream++,
      table: opts.table,
    });
  };

  const walkBlock = (node: XmlNode) => {
    for (const child of node.children) {
      if (child.tag === 'w:p') {
        pushPara(paragraphOf(child, { skipTextBoxes: true }));
      } else if (child.tag === 'w:tbl') {
        handleTable(child);
      } else if (child.tag === 'w:sdt') {
        const content = childByTag(child, 'w:sdtContent');
        if (content) walkBlock(content);
      } else if (child.tag === 'w:sectPr') {
        const cols = findAll(child, 'w:cols')[0];
        const n = cols ? parseInt(cols.attrs['w:num'] || '1', 10) : 1;
        if (n >= 2) declaredColumns = Math.max(declaredColumns ?? 1, n);
      }
    }
  };

  const handleTable = (tbl: XmlNode) => {
    const rows = tbl.children.filter((c) => c.tag === 'w:tr');
    const cellsPerRow = rows.map((r) => r.children.filter((c) => c.tag === 'w:tc'));
    const cols = Math.max(0, ...cellsPerRow.map((c) => c.length));
    const totalParas = cellsPerRow.flat().reduce((n, tc) => n + findAll(tc, 'w:p', [], new Set(['w:tbl'])).length, 0);
    const id = `T${tables.length + 1}`;
    const isLayout = rows.length <= 2 && cols >= 2 && cols <= 3 && totalParas >= 6;
    const cellTexts: string[] = [];
    cellsPerRow.forEach((cells, r) => {
      // Cells of one row sit side by side, so each starts at the same y.
      const rowStart = order;
      let rowEnd = order;
      cells.forEach((tc, c) => {
        order = rowStart;
        const paras = tc.children.filter((x) => x.tag === 'w:p' || x.tag === 'w:tbl' || x.tag === 'w:sdt');
        const cellText: string[] = [];
        for (const p of paras) {
          if (p.tag === 'w:tbl') {
            handleTable(p);
            continue;
          }
          const para = paragraphOf(p, { skipTextBoxes: true });
          cellText.push(para.text.trim());
          pushPara(para, isLayout ? { column: c, columns: cols } : { table: { id, row: r, col: c }, source: 'table', column: c, columns: cols });
        }
        rowEnd = Math.max(rowEnd, order);
        cellTexts.push(cellText.filter(Boolean).join(' '));
      });
      order = rowEnd;
    });
    tables.push({ id, page, rows: rows.length, cols, cells: cellTexts });
    if (isLayout) declaredColumns = Math.max(declaredColumns ?? 1, cols);
  };

  walkBlock(body);

  const headerText: string[] = [];
  const footerText: string[] = [];
  for (const name of Object.keys(zip.files)) {
    const isHeader = /^word\/header\d*\.xml$/.test(name);
    const isFooter = /^word\/footer\d*\.xml$/.test(name);
    if (!isHeader && !isFooter) continue;
    const xml = await zip.file(name)!.async('string');
    const hf = parseXml(xml);
    const paras = findAll(hf, 'w:p').map((p) => paragraphOf(p).text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (const t of paras) {
      if (isHeader) headerText.push(t);
      else footerText.push(t);
      items.push({
        text: t,
        page: 1,
        bbox: { x: 0.08, y: isHeader ? 0.015 : 0.975, w: 0.84, h: 0.012 },
        font: {},
        source: isHeader ? 'header' : 'footer',
        streamIndex: stream++,
      });
    }
  }
  for (const box of textBoxes) {
    for (const t of box.text.split('\n')) {
      items.push({ text: t, page: 1, bbox: { x: 0.6, y: 0.05, w: 0.35, h: 0.012 }, font: {}, source: 'textbox', streamIndex: stream++ });
    }
  }

  if (items.length === 0) warnings.push('The document contains no text.');

  return {
    fileType: 'docx',
    pageCount: page,
    items,
    images,
    textBoxes,
    tables,
    headerText,
    footerText,
    fonts: [...fonts],
    declaredColumns,
    warnings,
  };
}

function findFirstTag(node: XmlNode, tag: string): XmlNode | undefined {
  for (const c of node.children) {
    if (c.tag === tag) return c;
    const d = findFirstTag(c, tag);
    if (d) return d;
  }
  return undefined;
}

function countParagraphs(node: XmlNode): number {
  return findAll(node, 'w:p').length;
}

function paragraphOf(p: XmlNode, opts: { skipTextBoxes?: boolean } = {}): Para {
  let text = '';
  let boldChars = 0;
  let totalChars = 0;
  let size: number | undefined;
  let pageBreakBefore = false;
  const pPr = childByTag(p, 'w:pPr');
  const bullet = !!(pPr && findAll(pPr, 'w:numPr').length);
  const styleVal = pPr ? childByTag(pPr, 'w:pStyle')?.attrs['w:val'] ?? '' : '';
  const heading = /heading|title/i.test(styleVal);
  if (pPr && childByTag(pPr, 'w:pageBreakBefore')) pageBreakBefore = true;

  const walk = (node: XmlNode, inheritedBold: boolean) => {
    for (const c of node.children) {
      switch (c.tag) {
        case 'w:r': {
          const rPr = childByTag(c, 'w:rPr');
          const b = rPr ? isOn(childByTag(rPr, 'w:b')) : inheritedBold;
          const sz = rPr ? childByTag(rPr, 'w:sz')?.attrs['w:val'] : undefined;
          if (sz) size = Math.max(size ?? 0, parseInt(sz, 10) / 2);
          walk(c, b);
          break;
        }
        case 'w:t': {
          const t = c.children.map((x) => x.text ?? '').join('');
          text += t;
          totalChars += t.trim().length;
          if (inheritedBold) boldChars += t.trim().length;
          break;
        }
        case 'w:tab':
          text += '\t';
          break;
        case 'w:br':
          if (c.attrs['w:type'] === 'page') pageBreakBefore = pageBreakBefore || text.trim().length === 0;
          text += ' ';
          break;
        case 'w:lastRenderedPageBreak':
          if (text.trim().length === 0) pageBreakBefore = true;
          break;
        case 'w:sym': {
          // Symbol-font glyphs (Wingdings bullets/icons) come through as private-use characters.
          const code = c.attrs['w:char'];
          text += code ? String.fromCodePoint(0xf000 + (parseInt(code, 16) & 0xff)) : String.fromCharCode(0xf0b7);
          break;
        }
        case 'w:txbxContent':
        case 'w:drawing':
        case 'w:pict':
        case 'mc:AlternateContent':
          if (opts.skipTextBoxes) break;
          walk(c, inheritedBold);
          break;
        case 'w:hyperlink':
        case 'w:smartTag':
        case 'w:sdt':
        case 'w:sdtContent':
        case 'w:ins':
        case 'w:fldSimple':
          walk(c, inheritedBold);
          break;
        default:
          break;
      }
    }
  };
  const markBold = pPr ? isOn(childByTag(childByTag(pPr, 'w:rPr') ?? { tag: '', attrs: {}, children: [] }, 'w:b')) : false;
  walk(p, markBold);
  return {
    text,
    bold: totalChars > 0 && boldChars / totalChars >= 0.8,
    size,
    bullet: bullet || /^[\s]*[•·▪◦■●○➢➤►✓✔\-–—*o]\s/.test(text),
    heading,
    pageBreakBefore,
  };
}

function isOn(node: XmlNode | undefined): boolean {
  if (!node) return false;
  const v = node.attrs['w:val'];
  return v === undefined || !(v === '0' || v === 'false' || v === 'off');
}
