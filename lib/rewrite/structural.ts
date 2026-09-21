import type { ParsedResume, ResumeLine, Entry, SectionId } from '../parse/types';
import type { PlanItem } from '../schema/analysis';
import type { RewriteLine, Hunk, RewriteOutput } from '../schema/rewrite';
import type { ScoringContext } from '../score/types';
import { STANDARD_LABEL, normalizeHeading } from '../parse/headings';
import { DICTIONARY, termRegex, lookup } from '../score/keywords/dictionary';
import { rewriteBulletFallback, summaryFallback, entryHeadline } from './fallback';
import { AI_PHRASES } from '../score/writing';

/**
 * Deterministic document builder. Takes the parsed upload, the enabled plan
 * items and (optionally) model-written prose, and produces the rewritten
 * document as lines that all point back at the lines they came from. The
 * output is always single-column plain text — that is the point.
 */

export interface StructuralBuild {
  lines: RewriteLine[];
  sections: { id: string; title: string; lineIds: string[] }[];
  hunks: Hunk[];
  notes: string[];
}

const SECTION_ORDER: SectionId[] = ['contact', 'summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'other'];

export function buildStructure(doc: ParsedResume, plan: PlanItem[], enabledIds: Set<string>, model: RewriteOutput | null, ctx: ScoringContext): StructuralBuild {
  const enabled = plan.filter((p) => enabledIds.has(p.id) || p.locked);
  const on = (kind: PlanItem['kind'], pred?: (p: PlanItem) => boolean) => enabled.find((p) => p.kind === kind && (!pred || pred(p)));
  const byId = new Map(doc.lines.map((l) => [l.id, l]));
  const notes: string[] = [];
  const lines: RewriteLine[] = [];
  const sections: StructuralBuild['sections'] = [];
  const hunks: Hunk[] = [];
  let n = 0;
  const nextId = () => `R${++n}`;
  let currentSection: StructuralBuild['sections'] | null = null;

  const startSection = (id: string, title: string) => {
    const s = { id, title, lineIds: [] as string[] };
    sections.push(s);
    currentSection = [s];
    return s;
  };
  const add = (partial: Omit<RewriteLine, 'id'>, hunk: { kind: Hunk['kind']; reason: string; planItemId?: string; findingIds?: string[]; originalLineIds?: string[] }): RewriteLine => {
    const line: RewriteLine = { id: nextId(), ...partial };
    lines.push(line);
    const s = currentSection?.[0];
    if (s) s.lineIds.push(line.id);
    const originals = hunk.originalLineIds ?? partial.originLineIds;
    hunks.push({
      id: `H${hunks.length + 1}`,
      kind: hunk.kind,
      originalLineIds: originals,
      rewriteLineIds: [line.id],
      reason: hunk.reason,
      planItemId: hunk.planItemId,
      findingIds: hunk.findingIds ?? [],
      accepted: true,
      section: partial.section,
    });
    return line;
  };
  const keep = (l: ResumeLine, section: string, kind: RewriteLine['kind'] = l.kind === 'blank' ? 'text' : (l.kind as RewriteLine['kind'])) =>
    add({ text: l.text, kind, section, originLineIds: [l.id], entryId: l.entryIndex !== undefined ? doc.entries[l.entryIndex]?.id : undefined }, { kind: 'same', reason: 'Unchanged.' });
  const findingsFor = (item: PlanItem | undefined, lineIds: string[]) => (item ? item.findingIds.filter((fid) => lineIds.some((lid) => fid.endsWith(`-${lid}`) || fid.includes(lid))) : []);

  const headingItem = on('heading');
  // The rebuilt document uses the canonical heading for every section. A
  // heading that only differs in case ("EDUCATION" → "Education") is not a change.
  const heading = (id: SectionId, sectionOriginal?: { headingLineId?: string; title: string; nonStandardHeading?: boolean }) => {
    const original = sectionOriginal?.headingLineId ? byId.get(sectionOriginal.headingLineId) : undefined;
    const standard = STANDARD_LABEL[id] || 'Additional';
    const keepOriginal = original && sectionOriginal?.nonStandardHeading && !headingItem;
    const text = keepOriginal ? original!.text : standard;
    const sameName = original && normalizeHeading(original.text) === normalizeHeading(text);
    add(
      { text, kind: 'heading', section: id, originLineIds: original ? [original.id] : [] },
      original && !sameName
        ? {
            kind: 'modify',
            reason: sectionOriginal?.nonStandardHeading ? `Heading renamed from “${original.text}” so parsers map the section.` : `“${original.text}” written as the canonical “${text}”.`,
            planItemId: sectionOriginal?.nonStandardHeading ? headingItem?.id : undefined,
            findingIds: sectionOriginal?.nonStandardHeading ? findingsFor(headingItem, [original.id]) : [],
          }
        : original
          ? { kind: 'same', reason: 'Unchanged.' }
          : { kind: 'insert', reason: `Added a “${text}” heading so the block is filed correctly.`, planItemId: headingItem?.id ?? on('structure')?.id },
    );
  };

  // ---------------------------------------------------------------- Contact
  const contactSec = startSection('contact', 'Contact');
  const nameLine = doc.contact.lineRefs.name ? byId.get(doc.contact.lineRefs.name) : undefined;
  const contactMissing = on('contact', (p) => Array.isArray(p.data?.fields));
  if (nameLine) keep(nameLine, 'contact', 'name');
  else if (contactMissing) add({ text: '[[Your full name]]', kind: 'name', section: 'contact', originLineIds: [] }, { kind: 'insert', reason: 'No name line was detected; fill it in.', planItemId: contactMissing.id });

  const headlineLine = doc.lines.find((l) => l.section === 'contact' && l.kind === 'text' && l.source === 'body' && l.id !== nameLine?.id && l.text.split(/\s+/).length <= 6 && !/\d/.test(l.text));
  const headline = model?.headline?.trim() || headlineLine?.text;
  if (headline) {
    add(
      { text: headline, kind: 'text', section: 'contact', originLineIds: headlineLine ? [headlineLine.id] : [] },
      headlineLine && headlineLine.text === headline ? { kind: 'same', reason: 'Unchanged.' } : { kind: headlineLine ? 'modify' : 'insert', reason: 'Professional headline under the name.' },
    );
  }
  const c = doc.contact;
  const fields: string[] = [];
  const missingFields = new Set((contactMissing?.data?.fields as string[] | undefined) ?? []);
  if (c.location) fields.push(c.location);
  else if (missingFields.has('location')) fields.push('[[City, ST]]');
  if (c.email) fields.push(c.email);
  else if (missingFields.has('email')) fields.push('[[email]]');
  if (c.phone) fields.push(c.phone);
  else if (missingFields.has('phone')) fields.push('[[phone]]');
  if (c.linkedin) fields.push(c.linkedin.replace(/^https?:\/\/(www\.)?/, ''));
  else if (missingFields.has('linkedin')) fields.push('[[linkedin.com/in/handle]]');
  if (c.github) fields.push(c.github.replace(/^https?:\/\/(www\.)?/, ''));
  if (c.website) fields.push(c.website.replace(/^https?:\/\/(www\.)?/, ''));
  if (!c.github && !c.website && missingFields.has('portfolio')) fields.push('[[portfolio or GitHub URL]]');
  const contactOrigins = [...new Set(Object.values(c.lineRefs).filter((id) => id && id !== c.lineRefs.name) as string[])];
  const otherContactLines = doc.lines.filter((l) => l.section === 'contact' && (l.kind === 'contact' || l.source === 'header') && !contactOrigins.includes(l.id) && l.id !== nameLine?.id && l.id !== headlineLine?.id);
  const allOrigins = [...contactOrigins, ...otherContactLines.map((l) => l.id)];
  if (fields.length) {
    const moved = allOrigins.some((id) => byId.get(id)?.source !== 'body');
    const merged = allOrigins.length > 1;
    const contactItem = on('contact');
    add(
      { text: fields.join(' · '), kind: 'contact', section: 'contact', originLineIds: allOrigins },
      allOrigins.length === 1 && byId.get(allOrigins[0])?.text === fields.join(' · ')
        ? { kind: 'same', reason: 'Unchanged.' }
        : {
            kind: allOrigins.length ? 'modify' : 'insert',
            reason: moved ? 'Contact details moved from the header into the body where every parser reads them.' : merged ? 'Contact details merged onto one line.' : missingFields.size ? 'Missing contact fields added as fill-ins.' : 'Contact line normalized.',
            planItemId: contactItem?.id,
            findingIds: contactItem?.findingIds ?? [],
          },
    );
  }
  void contactSec;

  // ---------------------------------------------------------------- Order
  const present = new Map<SectionId, typeof doc.sections>();
  for (const s of doc.sections) {
    if (s.id === 'contact' || s.id === 'unknown') continue;
    if (s.lineIds.length === 0 && !s.headingLineId) continue;
    present.set(s.id, [...(present.get(s.id) ?? []), s]);
  }
  const originalOrder = [...new Set(doc.sections.map((s) => s.id))].filter((id) => present.has(id));
  const moveExpUp = !!on('structure', (p) => /Move Experience above Education/.test(p.change));
  let order: SectionId[];
  if (moveExpUp) {
    order = SECTION_ORDER.filter((id) => present.has(id));
  } else {
    // Keep the author's order but pull summary right after contact and skills before certifications.
    order = [...originalOrder];
    if (order.includes('summary')) order = ['summary', ...order.filter((id) => id !== 'summary')];
  }
  if (!present.has('summary') && model && model.summary.length) order.unshift('summary');
  const addSkills = on('structure', (p) => /Skills section/.test(p.change));
  if (!present.has('skills') && addSkills) order.push('skills');

  const summaryItem = on('summary');
  const datesItem = on('structure', (p) => /Normalize every role line/.test(p.change));
  const keywordsItem = on('keywords', (p) => Array.isArray(p.data?.terms) && !p.data?.informational);
  const trimItem = on('keywords', (p) => /Trim overused/.test(p.change));
  const refsItem = on('structure', (p) => /references/.test(p.change));

  for (const id of order) {
    const secs = present.get(id) ?? [];
    const first = secs[0];
    startSection(id, STANDARD_LABEL[id]);
    heading(id, first);
    switch (id) {
      case 'summary': {
        const original = secs.flatMap((s) => s.lineIds.map((lid) => byId.get(lid)!).filter((l) => l && l.kind !== 'heading'));
        if (summaryItem || (model && model.summary.length && original.length === 0)) {
          const text = model && model.summary.length ? model.summary : summaryFallback(doc, ctx.targetLabel.replace(/^JD: /, ''));
          text.forEach((t, i) => {
            const origins = i === 0 ? original.map((l) => l.id) : [];
            add({ text: scrubPhrases(t), kind: 'text', section: 'summary', originLineIds: origins }, { kind: origins.length ? 'modify' : 'insert', reason: i === 0 ? 'Summary rewritten as facts: role, years, domain, numbers.' : 'Second summary line: the headline result.', planItemId: summaryItem?.id, findingIds: summaryItem?.findingIds ?? [] });
          });
        } else {
          for (const l of original) keep(l, 'summary');
        }
        break;
      }
      case 'experience':
      case 'projects':
      case 'volunteer':
      case 'education': {
        const entries = doc.entries.filter((e) => e.section === id);
        const sectionLineIds = new Set(secs.flatMap((s) => s.lineIds));
        const entryLineIds = new Set(entries.flatMap((e) => [...e.headerLineIds, ...e.bulletLineIds]));
        // Lines in the section that belong to no entry (intro text) stay verbatim.
        for (const lid of sectionLineIds) {
          const l = byId.get(lid)!;
          if (!entryLineIds.has(lid) && l.kind !== 'heading' && entries.length === 0) keep(l, id);
        }
        for (const e of entries) writeEntry(e, id);
        // Section lines not in any entry, after entries (rare: trailing notes).
        for (const lid of sectionLineIds) {
          const l = byId.get(lid)!;
          if (!entryLineIds.has(lid) && l.kind !== 'heading' && entries.length > 0) {
            if (refsItem && /references (available )?(upon|on) request/i.test(l.text)) {
              hunks.push({ id: `H${hunks.length + 1}`, kind: 'delete', originalLineIds: [l.id], rewriteLineIds: [], reason: 'Deleted: “references available on request” says nothing.', planItemId: refsItem.id, findingIds: refsItem.findingIds, accepted: true, section: id });
              continue;
            }
            keep(l, id);
          }
        }
        break;
      }
      case 'skills': {
        const original = secs.flatMap((s) => s.lineIds.map((lid) => byId.get(lid)!).filter((l) => l && l.kind !== 'heading'));
        const originIds = original.map((l) => l.id);
        const bodyText = doc.lines.filter((l) => l.source === 'body' || l.source === 'table').map((l) => l.text).join('\n');
        let groups: { group: string; items: string[] }[];
        const dropped: string[] = [];
        if (model && model.skills.length) {
          groups = model.skills.map((g) => ({ group: g.group, items: dedupe(g.items).filter((it) => !isBuzzword(it)) })).filter((g) => g.items.length);
        } else {
          const raw = dedupe(original.flatMap((l) => l.text.replace(/^[^:]{1,25}:\s*/, '').split(/\s*[,|•·;]\s*|\s{3,}/)).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40));
          const items = raw.filter((it) => {
            if (isBuzzword(it)) {
              dropped.push(it);
              return false;
            }
            return true;
          });
          if (items.length === 0) {
            for (const e of DICTIONARY) if (e.c !== 'soft' && termRegex(e.t, e.a).test(bodyText)) items.push(displayTerm(e.t));
          }
          groups = groupSkills(items);
        }
        if (dropped.length) notes.push(`Dropped from Skills: ${dropped.join(', ')} — traits, not skills; recruiters and screening tools discount them.`);
        if (keywordsItem) {
          const terms = (keywordsItem.data!.terms as string[]).map(displayTerm);
          const have = new Set(groups.flatMap((g) => g.items.map((i) => i.toLowerCase())));
          const fresh = terms.filter((t) => !have.has(t.toLowerCase()));
          if (fresh.length) {
            const target = groups.find((g) => /tool|tech|platform|software/i.test(g.group)) ?? groups[0];
            if (target) target.items.push(...fresh);
            else groups.push({ group: 'Tools & methods', items: fresh });
          }
        }
        if (trimItem) notes.push('Overused terms are kept in Skills and the strongest bullets only.');
        groups.forEach((g, i) => {
          const text = g.items.length ? (groups.length === 1 && g.group === 'Skills' ? g.items.join(', ') : `${g.group}: ${g.items.join(', ')}`) : g.group;
          const origins = i === 0 ? originIds : [];
          const same = original.length === 1 && original[0].text === text;
          add(
            { text, kind: 'text', section: 'skills', originLineIds: origins },
            same
              ? { kind: 'same', reason: 'Unchanged.' }
              : {
                  kind: origins.length ? 'modify' : 'insert',
                  reason:
                    original.length === 0
                      ? 'Skills section built from tools already named in the document.'
                      : i === 0
                        ? keywordsItem
                          ? `Skills regrouped as plain lines; added supported terms: ${(keywordsItem.data!.terms as string[]).join(', ')}.${dropped.length ? ` Dropped ${dropped.join(', ')}.` : ''}`
                          : `Skills flattened to plain comma-separated lines a parser can split.${dropped.length ? ` Dropped ${dropped.join(', ')}.` : ''}`
                        : `Skills grouped by type: ${g.group}.`,
                  planItemId: keywordsItem?.id ?? addSkills?.id,
                  findingIds: i === 0 ? [...(keywordsItem?.findingIds ?? []), ...(addSkills?.findingIds ?? [])] : [],
                },
          );
        });
        break;
      }
      default: {
        const sectionLines = secs.flatMap((s) => s.lineIds.map((lid) => byId.get(lid)!).filter((l) => l && l.kind !== 'heading'));
        for (const l of sectionLines) {
          if (refsItem && /references (available )?(upon|on) request/i.test(l.text)) {
            hunks.push({ id: `H${hunks.length + 1}`, kind: 'delete', originalLineIds: [l.id], rewriteLineIds: [], reason: 'Deleted: “references available on request” says nothing.', planItemId: refsItem.id, findingIds: refsItem.findingIds, accepted: true, section: id });
          }
        }
        const kept = sectionLines.filter((l) => !(refsItem && /references (available )?(upon|on) request/i.test(l.text)));
        for (const m of mergeWrapped(kept)) {
          const first = byId.get(m.ids[0])!;
          if (m.ids.length === 1) keep(first, id);
          else add({ text: m.text, kind: first.kind === 'bullet' ? 'bullet' : 'text', section: id, originLineIds: m.ids }, { kind: 'modify', reason: 'Wrapped fragments rejoined into one line.' });
        }
      }
    }
  }

  // Lines from the upload that nothing in the rewrite references: footers, page numbers, decoration.
  const referenced = new Set(lines.flatMap((l) => l.originLineIds));
  const deleted = new Set(hunks.filter((h) => h.kind === 'delete').flatMap((h) => h.originalLineIds));
  for (const l of doc.lines) {
    if (referenced.has(l.id) || deleted.has(l.id)) continue;
    if (l.kind === 'heading' && !doc.sections.some((s) => s.headingLineId === l.id && s.lineIds.length === 0)) continue;
    const reason =
      l.source === 'footer'
        ? 'Footer text dropped; parsers skip it and the export has no footer.'
        : l.source === 'header'
          ? 'Header text folded into the contact line.'
          : l.source === 'textbox'
            ? 'Text box content moved into the body.'
            : l.kind === 'heading'
              ? 'Empty heading removed.'
              : 'Line not carried over.';
    hunks.push({ id: `H${hunks.length + 1}`, kind: 'delete', originalLineIds: [l.id], rewriteLineIds: [], reason, findingIds: [], accepted: true, section: l.section });
  }

  return { lines, sections, hunks: mergeSameRuns(hunks), notes };

  // ------------------------------------------------------------ entries
  function writeEntry(e: Entry, sectionId: SectionId) {
    const isEdu = sectionId === 'education';
    const headerLines = e.headerLineIds.map((id) => byId.get(id)!).filter(Boolean);
    const bulletsItem = on('bullets', (p) => p.data?.entryId === e.id) ?? on('bullets', (p) => /remaining bullets/.test(p.change) && e.bulletLineIds.some((id) => p.lineRefs.includes(id)));
    if (datesItem || headerLines.length > 1) {
      const text = entryHeadline(e, isEdu);
      const same = headerLines.length === 1 && headerLines[0].text === text;
      add(
        { text, kind: 'entry', section: sectionId, originLineIds: headerLines.map((l) => l.id), entryId: e.id },
        same ? { kind: 'same', reason: 'Unchanged.' } : { kind: 'modify', reason: headerLines.length > 1 ? 'Title, employer and dates merged onto one line in a fixed order.' : 'Role line normalized to Title — Employer | Location | Dates.', planItemId: datesItem?.id, findingIds: findingsFor(datesItem, headerLines.map((l) => l.id)) },
      );
    } else {
      for (const l of headerLines) keep(l, sectionId, 'entry');
    }
    const modelEntry = model?.entries.find((m) => m.entryId === e.id);
    const bulletLines = e.bulletLineIds.map((id) => byId.get(id)!).filter(Boolean);
    if (!bulletsItem) {
      for (const l of bulletLines) keep(l, sectionId, l.kind === 'bullet' ? 'bullet' : 'text');
      return;
    }
    const used = new Set<string>();
    if (modelEntry && modelEntry.bullets.length) {
      for (const b of modelEntry.bullets) {
        const origin = b.originLineId && byId.has(b.originLineId) && e.bulletLineIds.includes(b.originLineId) && !used.has(b.originLineId) ? b.originLineId : undefined;
        if (origin) used.add(origin);
        add(
          { text: scrubPhrases(b.text.trim()), kind: 'bullet', section: sectionId, originLineIds: origin ? [origin] : [], entryId: e.id },
          { kind: origin ? 'modify' : 'insert', reason: b.reason || 'Rewritten with an action verb, a number and an outcome.', planItemId: bulletsItem.id, findingIds: origin ? findingsFor(bulletsItem, [origin]) : [] },
        );
      }
      // Original bullets the model did not carry over.
      for (const l of bulletLines) {
        if (used.has(l.id)) continue;
        hunks.push({ id: `H${hunks.length + 1}`, kind: 'delete', originalLineIds: [l.id], rewriteLineIds: [], reason: 'Merged into a neighbouring bullet or dropped as duplicate.', planItemId: bulletsItem.id, findingIds: findingsFor(bulletsItem, [l.id]), accepted: true, section: sectionId });
      }
      return;
    }
    for (const l of bulletLines) {
      const text = rewriteBulletFallback(l.text);
      add(
        { text, kind: 'bullet', section: sectionId, originLineIds: [l.id], entryId: e.id },
        text === l.text ? { kind: 'same', reason: 'Unchanged.' } : { kind: 'modify', reason: 'Weak opener removed, verb first, fill-in fields for the number and the result.', planItemId: bulletsItem.id, findingIds: findingsFor(bulletsItem, [l.id]) },
      );
    }
  }
}

function scrubPhrases(text: string): string {
  let t = text;
  for (const p of AI_PHRASES) {
    if (!p.re.test(t)) continue;
    const swap = p.swap.split(' / ')[0];
    if (/^(used|led|launched|analyzed|investigated|worked with|combined)$/.test(swap)) t = t.replace(new RegExp(p.re.source, 'gi'), (m) => (/^[A-Z]/.test(m) ? swap.charAt(0).toUpperCase() + swap.slice(1) : swap));
  }
  return t;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const k = it.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it.trim());
  }
  return out;
}

const DISPLAY: Record<string, string> = { 'ci/cd': 'CI/CD', sql: 'SQL', aws: 'AWS', gcp: 'GCP', api: 'API', 'rest api': 'REST APIs', html: 'HTML', css: 'CSS', seo: 'SEO', sem: 'SEM', crm: 'CRM', erp: 'ERP', kpis: 'KPIs', etl: 'ETL', nlp: 'NLP', mlops: 'MLOps', ux: 'UX', ui: 'UI', 'a/b testing': 'A/B testing', 'ux design': 'UX design', 'ui design': 'UI design', grpc: 'gRPC', 'node.js': 'Node.js', 'next.js': 'Next.js', 'power bi': 'Power BI', 'sql server': 'SQL Server', postgresql: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', dynamodb: 'DynamoDB', 'github actions': 'GitHub Actions', llms: 'LLMs', ehr: 'EHR', hipaa: 'HIPAA', bls: 'BLS', rn: 'RN', cad: 'CAD', fea: 'FEA', 'gd&t': 'GD&T', plc: 'PLC', 'pcb design': 'PCB design', 'fp&a': 'FP&A', cpa: 'CPA', ats: 'ATS', shrm: 'SHRM', lms: 'LMS', saas: 'SaaS', nps: 'NPS', 'ios': 'iOS', 'c#': 'C#', 'c++': 'C++', '.net': '.NET', php: 'PHP', vba: 'VBA', graphql: 'GraphQL', pmp: 'PMP', 'okrs': 'OKRs', 'b2b': 'B2B' };

export function displayTerm(term: string): string {
  const k = term.toLowerCase();
  if (DISPLAY[k]) return DISPLAY[k];
  const e = lookup(k);
  const t = e?.t ?? term;
  if (DISPLAY[t]) return DISPLAY[t];
  return t.replace(/(^|\s|\/)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

function groupSkills(items: string[]): { group: string; items: string[] }[] {
  if (items.length === 0) return [];
  // Short lists read better as one line; grouping only earns its keep past ~8 items.
  if (items.length <= 8) return [{ group: 'Skills', items }];
  const buckets: Record<string, string[]> = {};
  const labels: Record<string, string> = {
    language: 'Languages',
    frontend: 'Frontend',
    backend: 'Backend',
    database: 'Databases',
    cloud: 'Cloud',
    devops: 'DevOps',
    data: 'Data',
    ml: 'Machine learning',
    testing: 'Testing',
    design: 'Design',
    marketing: 'Marketing',
    sales: 'Sales',
    product: 'Product & analytics',
    tools: 'Tools',
    method: 'Methods',
    finance: 'Finance',
    hr: 'HR',
    health: 'Clinical',
    ops: 'Operations',
    business: 'Business',
    soft: 'Also',
  };
  for (const it of items) {
    const e = lookup(it);
    const key = e ? (labels[e.c] ? e.c : 'tools') : 'other';
    buckets[key] = [...(buckets[key] ?? []), it];
  }
  const out = Object.entries(buckets)
    .filter(([k]) => k !== 'other')
    .map(([k, v]) => ({ group: labels[k] ?? 'Tools', items: v }));
  if (buckets.other?.length) out.push({ group: out.length ? 'Also' : 'Skills', items: buckets.other });
  // Collapse into at most four lines by folding the smallest groups into "Also".
  let also = out.find((g) => g.group === 'Also');
  while (out.length > 4) {
    const candidates = out.filter((g) => g !== also).sort((a, b) => a.items.length - b.items.length);
    const smallest = candidates[0];
    out.splice(out.indexOf(smallest), 1);
    if (also) also.items.push(...smallest.items);
    else {
      also = { group: 'Also', items: smallest.items };
      out.push(also);
    }
  }
  return out;
}

/** Buzzwords have no place in a skills list; the writing scorer flags them in prose for the same reason. */
export function isBuzzword(item: string): boolean {
  return /^(team ?player|hard[- ]?work(er|ing)|detail[- ]oriented|self[- ]starter|go[- ]getter|fast learner|quick learner|results[- ]driven|passionate|motivated|dynamic|multitask(ing|er)?|people person|strong work ethic|positive attitude|reliable|dependable|punctual|flexible|adaptable|creative|hardworking|problem solver|leadership skills|interpersonal skills|communication skills|organizational skills)$/i.test(item.trim());
}

/** Wrapped paragraph fragments ("Photography, travel," / "yoga, podcasts") rejoin into one line. */
export function mergeWrapped(lines: ResumeLine[]): { text: string; ids: string[] }[] {
  const out: { text: string; ids: string[] }[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const continues = prev && l.kind === 'text' && !l.bullet && (/[,;]$/.test(prev.text) || (!/[.!?:]$/.test(prev.text) && /^[a-z]/.test(l.text)));
    if (continues) {
      prev.text = `${prev.text} ${l.text}`;
      prev.ids.push(l.id);
    } else out.push({ text: l.text, ids: [l.id] });
  }
  return out;
}

/** Consecutive "same" hunks in one section collapse into one row. */
function mergeSameRuns(hunks: Hunk[]): Hunk[] {
  const out: Hunk[] = [];
  for (const h of hunks) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === 'same' && h.kind === 'same' && prev.section === h.section) {
      prev.originalLineIds.push(...h.originalLineIds);
      prev.rewriteLineIds.push(...h.rewriteLineIds);
      continue;
    }
    out.push({ ...h, originalLineIds: [...h.originalLineIds], rewriteLineIds: [...h.rewriteLineIds] });
  }
  return out.map((h, i) => ({ ...h, id: `H${i + 1}` }));
}
