import type { ParsedResume } from '../parse/types';
import type { Rewrite } from '../schema/rewrite';
import { PLACEHOLDER_RE } from '../score/bullet-strength';

/**
 * The document that gets exported: the composed rewrite as typed lines, with
 * placeholders substituted. Shared by the PDF, DOCX and TXT writers so all
 * three carry identical text.
 */
export type ExportKind = 'name' | 'headline' | 'contact' | 'heading' | 'entry' | 'bullet' | 'text';

export interface ExportLine {
  kind: ExportKind;
  text: string;
  section: string;
}

export function buildExportDoc(doc: ParsedResume, rewrite: Rewrite, accepted: Record<string, boolean>, values: Record<string, string>): ExportLine[] {
  const original = new Map(doc.lines.map((l) => [l.id, l]));
  const lines = new Map(rewrite.lines.map((l) => [l.id, l]));
  const phValue = new Map(rewrite.placeholders.map((p) => [`${p.lineId}:${p.token}`, (values[p.id] ?? p.value ?? '').trim()]));
  const out: ExportLine[] = [];
  let sawName = false;
  for (const h of rewrite.diffs) {
    const on = accepted[h.id] ?? h.accepted;
    const useRewrite = h.kind === 'same' || ((h.kind === 'modify' || h.kind === 'insert') && on);
    const useOriginal = (h.kind === 'modify' && !on) || (h.kind === 'delete' && !on);
    if (useRewrite) {
      for (const id of h.rewriteLineIds) {
        const l = lines.get(id);
        if (!l) continue;
        const text = l.text.replace(PLACEHOLDER_RE, (tok) => phValue.get(`${l.id}:${tok}`) || tok);
        let kind: ExportKind = l.kind === 'blank' ? 'text' : (l.kind as ExportKind);
        if (kind === 'name') sawName = true;
        else if (l.section === 'contact' && kind === 'text') kind = 'headline';
        out.push({ kind, text, section: l.section });
      }
    } else if (useOriginal) {
      for (const id of h.originalLineIds) {
        const l = original.get(id);
        if (!l) continue;
        const kind: ExportKind = l.kind === 'blank' ? 'text' : l.kind === 'name' ? 'name' : (l.kind as ExportKind);
        out.push({ kind, text: l.text, section: l.section });
      }
    }
  }
  if (!sawName && out[0] && out[0].kind !== 'name') out[0] = { ...out[0], kind: 'name' };
  return out;
}

export function exportText(lines: ExportLine[]): string {
  const parts: string[] = [];
  for (const l of lines) {
    if (l.kind === 'heading' && parts.length) parts.push('');
    parts.push(l.kind === 'bullet' ? `- ${l.text}` : l.kind === 'heading' ? l.text.toUpperCase() : l.text);
  }
  return parts.join('\n');
}

export function unfilledPlaceholders(lines: ExportLine[]): string[] {
  return lines.flatMap((l) => l.text.match(PLACEHOLDER_RE) ?? []);
}

export function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'resume';
}
