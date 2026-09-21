import type { ParsedResume } from '../parse/types';
import type { CategoryResult, Finding, CategoryId } from '../score/types';
import { CATEGORY_META } from '../score/types';
import { MAX_SCORE } from '../score/aggregate';
import type { PlanItem } from '../schema/analysis';
import { entryLabel } from '../score/util';

/**
 * Turn findings into an ordered list of intended changes. Each item's projected
 * gain is the weighted sum of the point costs of the findings it resolves —
 * nothing is estimated by hand. Gains are scaled so a category never projects
 * above 100.
 */
export function buildPlan(doc: ParsedResume, categories: CategoryResult[], baseline: number): { plan: PlanItem[]; projectedScore: number } {
  const scale: Record<CategoryId, number> = { parse: 1, keywords: 1, impact: 1, structure: 1, writing: 1, contact: 1 };
  for (const c of categories) {
    const sum = c.findings.reduce((n, f) => n + f.pointCost, 0);
    scale[c.id] = sum > 0 ? Math.min(1, (100 - c.score) / sum) : 1;
  }
  const gain = (fs: Finding[]) => Math.round(fs.reduce((n, f) => n + f.pointCost * scale[f.categoryId] * (CATEGORY_META[f.categoryId].weight / 100), 0) * 10) / 10;
  const all = categories.flatMap((c) => c.findings);
  const byRule = (cat: CategoryId, rules: string[]) => all.filter((f) => f.categoryId === cat && rules.includes(f.ruleId));
  const used = new Set<string>();
  const take = (fs: Finding[]) => {
    const fresh = fs.filter((f) => !used.has(f.id));
    for (const f of fresh) used.add(f.id);
    return fresh;
  };
  const refs = (fs: Finding[]) => [...new Set(fs.flatMap((f) => [f.lineRef, ...(f.relatedLineRefs ?? [])]))];
  const items: PlanItem[] = [];
  let n = 0;
  const push = (item: Omit<PlanItem, 'id' | 'projectedGain' | 'enabled' | 'findingIds' | 'lineRefs'> & { findings: Finding[]; enabled?: boolean; locked?: boolean }) => {
    const fs = take(item.findings);
    if (fs.length === 0) return;
    const g = gain(fs);
    if (g <= 0 && item.kind !== 'layout') return;
    items.push({
      id: `P${++n}`,
      kind: item.kind,
      change: item.change,
      detail: item.detail,
      targetSection: item.targetSection,
      projectedGain: g,
      enabled: item.enabled ?? true,
      locked: item.locked,
      findingIds: fs.map((f) => f.id),
      lineRefs: refs(fs),
      data: item.data,
    });
  };

  // 1. Layout — always the biggest lever and the export is single-column regardless.
  const layout = byRule('parse', ['multi-column', 'table', 'textbox', 'image', 'vector-graphics', 'glyphs', 'symbol-bullets', 'stream-order', 'file-size', 'footer-text']).filter((f) => !(f.ruleId === 'footer-text' && f.severity !== 'low'));
  if (layout.length) {
    const bits: string[] = [];
    if (!doc.layout.singleColumn) bits.push(`${doc.layout.columns} columns → 1`);
    if (doc.layout.tableCount) bits.push(`${doc.layout.tableCount} table${doc.layout.tableCount === 1 ? '' : 's'} → plain lines`);
    if (doc.layout.textBoxCount) bits.push(`${doc.layout.textBoxCount} text box${doc.layout.textBoxCount === 1 ? '' : 'es'} → body text`);
    if (doc.layout.imageCount) bits.push('images removed');
    if (doc.layout.ligatureLineIds.length) bits.push('icon glyphs → words');
    push({ kind: 'layout', change: 'Rebuild as a single-column, table-free document', detail: bits.join(' · '), targetSection: 'Whole document', findings: layout, locked: true, data: { columns: doc.layout.columns } });
  }

  // 2. Contact block.
  const contactMove = [...byRule('parse', ['header-text']), ...byRule('parse', ['footer-text']).filter((f) => f.severity !== 'low'), ...all.filter((f) => f.categoryId === 'contact' && /-in-(header|footer|textbox)$/.test(f.ruleId)), ...byRule('contact', ['contact-sprawl'])];
  push({ kind: 'contact', change: 'Move contact details into the body, on one line under the name', targetSection: 'Contact', findings: contactMove, locked: true });
  const contactMissing = byRule('contact', ['missing-email', 'missing-phone', 'missing-location', 'missing-linkedin', 'missing-portfolio', 'missing-name']);
  if (contactMissing.length) {
    const fields = contactMissing.map((f) => String(f.data?.field ?? '')).filter(Boolean);
    push({
      kind: 'contact',
      change: `Add ${fields.join(', ')} as fill-in fields on the contact line`,
      detail: 'The rewrite cannot invent these; each becomes a placeholder you fill before export.',
      targetSection: 'Contact',
      findings: contactMissing,
      data: { fields },
    });
  }

  // 3. Headings & structure.
  const headings = byRule('structure', ['nonstandard-heading', 'objective-heading', 'unlabeled-summary']);
  if (headings.length) {
    const renames = headings.filter((f) => f.data?.from).map((f) => `“${f.data!.from}” → ${f.data!.to}`);
    push({
      kind: 'heading',
      change: renames.length ? `Rename ${renames.length} heading${renames.length === 1 ? '' : 's'} to names parsers recognise` : 'Label the summary',
      detail: renames.join(' · ') || undefined,
      targetSection: 'Headings',
      findings: headings,
    });
  }
  const missingSections = byRule('structure', ['missing-skills', 'missing-education', 'missing-experience']);
  const missingSkills = missingSections.filter((f) => f.ruleId === 'missing-skills');
  if (missingSkills.length) {
    push({ kind: 'structure', change: 'Add a Skills section built from the tools already named in your bullets', targetSection: 'Skills', findings: missingSkills });
  }
  const otherMissing = missingSections.filter((f) => f.ruleId !== 'missing-skills');
  if (otherMissing.length) {
    push({
      kind: 'structure',
      change: `Add ${otherMissing.map((f) => String(f.data?.section)).join(' and ')} section${otherMissing.length === 1 ? '' : 's'} with fill-in fields`,
      detail: 'Placeholders only — the document has no facts to fill them with.',
      targetSection: 'Sections',
      findings: otherMissing,
      enabled: false,
    });
  }
  push({ kind: 'structure', change: 'Move Experience above Education', targetSection: 'Section order', findings: byRule('structure', ['section-order']) });
  const dates = byRule('structure', ['mixed-date-formats', 'incomplete-entry', 'undated-entry']);
  if (dates.length) {
    push({
      kind: 'structure',
      change: 'Normalize every role line to “Title — Employer | City, ST | Mon YYYY – Mon YYYY”',
      detail: dates.some((f) => f.ruleId === 'undated-entry') ? 'Roles without dates get a [[dates]] placeholder.' : undefined,
      targetSection: 'Experience',
      findings: dates,
    });
  }
  push({ kind: 'structure', change: 'Delete the “references available” line', targetSection: 'Footer', findings: byRule('structure', ['references-line']) });

  // 4. Bullets, one item per role so the user can keep a role as-is.
  const bulletRules = ['weak-bullet', 'weak-opener', 'generic-phrase', 'filler', 'passive', 'first-person', 'repeated-opener', 'identical-structure', 'overlong', 'too-few-bullets'];
  const entryOf = new Map<string, string>();
  for (const e of doc.entries) for (const id of e.bulletLineIds) entryOf.set(id, e.id);
  const bulletFindings = all.filter((f) => (f.categoryId === 'impact' || f.categoryId === 'writing') && bulletRules.includes(f.ruleId) && entryOf.has(f.lineRef));
  const groups = new Map<string, Finding[]>();
  for (const f of bulletFindings) {
    const eid = entryOf.get(f.lineRef)!;
    groups.set(eid, [...(groups.get(eid) ?? []), f]);
  }
  const orderedEntries = doc.entries.filter((e) => groups.has(e.id));
  for (const e of orderedEntries) {
    const fs = groups.get(e.id)!;
    const lines = new Set(fs.map((f) => f.lineRef));
    push({
      kind: 'bullets',
      change: `Rewrite ${lines.size} bullet${lines.size === 1 ? '' : 's'} under ${entryLabel(e)} with verb, number and outcome`,
      detail: 'Numbers that are not in the original become fill-in fields.',
      targetSection: entryLabel(e),
      findings: fs,
      data: { entryId: e.id },
    });
  }
  // Bullet findings outside any entry, plus the "no bullets at all" case.
  const orphan = all.filter((f) => (f.categoryId === 'impact' || f.categoryId === 'writing') && bulletRules.includes(f.ruleId) && !used.has(f.id) && !entryOf.has(f.lineRef) && f.ruleId !== 'no-bullets');
  push({ kind: 'bullets', change: `Rewrite ${new Set(orphan.map((f) => f.lineRef)).size} remaining bullets with verb, number and outcome`, targetSection: 'Experience', findings: orphan });
  push({ kind: 'bullets', change: 'Add bullets under each role from the facts in the entry lines (fill-in fields for results)', targetSection: 'Experience', findings: byRule('impact', ['no-bullets']), enabled: false });

  // 5. Summary.
  const summaryIds = new Set(doc.lines.filter((l) => l.section === 'summary').map((l) => l.id));
  const summaryFindings = all.filter((f) => f.categoryId === 'writing' && summaryIds.has(f.lineRef) && !used.has(f.id));
  push({ kind: 'summary', change: 'Rewrite the summary as two lines of fact', detail: 'Role, years, domain, headline numbers. No adjectives.', targetSection: 'Summary', findings: summaryFindings });

  // 6. Keywords.
  const supported = all.filter((f) => f.categoryId === 'keywords' && f.ruleId === 'missing-keyword' && f.data?.supported === true);
  if (supported.length) {
    const terms = supported.map((f) => String(f.data!.term));
    push({
      kind: 'keywords',
      change: `Add ${terms.length} keyword${terms.length === 1 ? '' : 's'} your experience already supports`,
      detail: terms.join(', '),
      targetSection: 'Skills',
      findings: supported,
      data: { terms },
    });
  }
  const overused = byRule('keywords', ['overused-keyword']);
  if (overused.length) {
    push({ kind: 'keywords', change: `Trim overused terms: ${overused.map((f) => `${f.data?.term} (${f.data?.count}×)`).join(', ')}`, targetSection: 'Experience', findings: overused });
  }
  const unsupported = all.filter((f) => f.categoryId === 'keywords' && f.ruleId === 'missing-keyword' && f.data?.supported !== true);
  if (unsupported.length) {
    // Not a change we will make: shown so the projection is honest about what is left.
    take(unsupported);
    items.push({
      id: `P${++n}`,
      kind: 'keywords',
      change: `Leave out ${unsupported.length} target term${unsupported.length === 1 ? '' : 's'} nothing in the document supports`,
      detail: unsupported.slice(0, 8).map((f) => String(f.data?.term)).join(', ') + (unsupported.length > 8 ? ` +${unsupported.length - 8}` : ''),
      targetSection: 'Skills',
      projectedGain: 0,
      enabled: true,
      findingIds: unsupported.map((f) => f.id),
      lineRefs: [],
      data: { terms: unsupported.map((f) => String(f.data?.term)), informational: true },
    });
  }

  const projectedScore = projectScore(baseline, items);
  return { plan: items, projectedScore };
}

export function projectScore(baseline: number, items: PlanItem[]): number {
  const total = items.filter((i) => i.enabled).reduce((n, i) => n + i.projectedGain, 0);
  return Math.min(MAX_SCORE, Math.round((baseline + total) * 10) / 10);
}
