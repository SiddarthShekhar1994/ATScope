import type { ParsedResume, ResumeLine, Entry } from '../parse/types';

export function lineMap(doc: ParsedResume): Map<string, ResumeLine> {
  return new Map(doc.lines.map((l) => [l.id, l]));
}

/** Bullets that describe work: experience first, then projects and volunteer. */
export function workBullets(doc: ParsedResume): { line: ResumeLine; entry: Entry | undefined; ordinal: number }[] {
  const out: { line: ResumeLine; entry: Entry | undefined; ordinal: number }[] = [];
  const byId = lineMap(doc);
  const entries = doc.entries.filter((e) => e.section === 'experience' || e.section === 'projects' || e.section === 'volunteer');
  for (const entry of entries) {
    entry.bulletLineIds.forEach((id, i) => {
      const line = byId.get(id);
      if (line && (line.kind === 'bullet' || line.kind === 'text')) out.push({ line, entry, ordinal: i + 1 });
    });
  }
  // Bullets in experience that never attached to an entry (no dated header found).
  const attached = new Set(out.map((b) => b.line.id));
  let orphanOrdinal = 0;
  for (const line of doc.lines) {
    if (line.section === 'experience' && line.kind === 'bullet' && !attached.has(line.id)) out.push({ line, entry: undefined, ordinal: ++orphanOrdinal });
  }
  return out;
}

export function firstLine(doc: ParsedResume): ResumeLine {
  return doc.lines.find((l) => l.source === 'body') ?? doc.lines[0];
}

export function nameLine(doc: ParsedResume): ResumeLine {
  const id = doc.contact.lineRefs.name;
  return (id && doc.lines.find((l) => l.id === id)) || firstLine(doc);
}

export function headingLine(doc: ParsedResume, sectionId: string): ResumeLine | undefined {
  const s = doc.sections.find((x) => x.id === sectionId && x.headingLineId);
  return s ? doc.lines.find((l) => l.id === s.headingLineId) : undefined;
}

export function entryLabel(entry: Entry | undefined): string {
  if (!entry) return 'Experience';
  const parts = [entry.title, entry.org].filter(Boolean);
  return parts.length ? parts.join(' at ') : (entry.dates ?? 'this role');
}

export function ordinalWord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function yearsOfExperience(doc: ParsedResume): number {
  const exp = doc.entries.filter((e) => e.section === 'experience' && e.startYear);
  if (!exp.length) return 0;
  const now = new Date().getFullYear();
  const start = Math.min(...exp.map((e) => e.startYear!));
  const end = Math.max(...exp.map((e) => (e.endYear === 'present' ? now : (e.endYear ?? e.startYear!))));
  return Math.max(0, end - start);
}

/** Sum a list of costs but never exceed `cap`; returns the effective costs so findings stay consistent with the score. */
export function capCosts<T extends { pointCost: number }>(items: T[], cap: number): T[] {
  let total = 0;
  const out: T[] = [];
  for (const it of items) {
    if (total >= cap) break;
    const allowed = Math.min(it.pointCost, cap - total);
    total += allowed;
    out.push({ ...it, pointCost: Math.round(allowed * 10) / 10 });
  }
  return out;
}
