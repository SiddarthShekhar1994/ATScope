import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat } from 'docx';
import type { ExportLine } from './model';

/**
 * ATS-safe DOCX: one column, body paragraphs only (no tables, text boxes,
 * headers or footers), real Word bullets via numbering, standard heading text
 * in bold caps. Calibri at conventional sizes.
 */
export async function exportDocx(lines: ExportLine[]): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  const font = 'Calibri';
  for (const l of lines) {
    switch (l.kind) {
      case 'name':
        children.push(new Paragraph({ children: [new TextRun({ text: l.text, bold: true, size: 40, font })], spacing: { after: 40 } }));
        break;
      case 'headline':
        children.push(new Paragraph({ children: [new TextRun({ text: l.text, size: 22, font, color: '444444' })], spacing: { after: 40 } }));
        break;
      case 'contact':
        children.push(new Paragraph({ children: [new TextRun({ text: l.text, size: 19, font, color: '444444' })], spacing: { after: 160 } }));
        break;
      case 'heading':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: l.text.toUpperCase(), bold: true, size: 21, font, characterSpacing: 10 })],
            spacing: { before: 220, after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB', space: 2 } },
          }),
        );
        break;
      case 'entry':
        children.push(new Paragraph({ children: [new TextRun({ text: l.text, bold: true, size: 21, font })], spacing: { before: 100, after: 40 } }));
        break;
      case 'bullet':
        children.push(new Paragraph({ children: [new TextRun({ text: l.text, size: 20, font })], numbering: { reference: 'ats-bullets', level: 0 }, spacing: { after: 30 } }));
        break;
      default:
        children.push(new Paragraph({ children: [new TextRun({ text: l.text, size: 20, font })], spacing: { after: 60 }, alignment: AlignmentType.LEFT }));
    }
  }
  const doc = new Document({
    creator: 'ATScope',
    title: lines.find((l) => l.kind === 'name')?.text ?? 'Resume',
    styles: { default: { document: { run: { font, size: 20 } } } },
    numbering: {
      config: [
        {
          reference: 'ats-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
