import type { CategoryScorer, Finding } from './types';
import { finding, CATEGORY_META, clamp100 } from './types';
import { nameLine, firstLine, lineMap } from './util';

const TECH_ROLES = new Set(['software-engineer', 'frontend-engineer', 'backend-engineer', 'devops-sre', 'data-scientist', 'ux-designer']);

/**
 * Contact & metadata: can the ATS build a contact record, and does it survive
 * the layout (contact details inside a header are invisible to most parsers).
 */
export const scoreContact: CategoryScorer = (doc, ctx) => {
  const meta = CATEGORY_META.contact;
  const c = doc.contact;
  const byId = lineMap(doc);
  const anchor = nameLine(doc) ?? firstLine(doc);
  const contactLine = doc.lines.find((l) => l.section === 'contact' && l.kind === 'contact') ?? anchor;
  const findings: Finding[] = [];

  const missing = (field: string, cost: number, why: string, fix: string) =>
    findings.push(
      finding({
        categoryId: 'contact',
        ruleId: `missing-${field}`,
        quote: contactLine.text,
        lineRef: contactLine.id,
        severity: cost >= 20 ? 'high' : 'medium',
        pointCost: cost,
        explanation: why,
        fix,
        fixKind: 'contact',
        data: { field },
      }),
    );

  if (!c.email) missing('email', 30, 'No email address found anywhere in the document. Most ATSs treat a profile without an email as incomplete and never surface it.', 'Add your email on the line under your name.');
  if (!c.phone) missing('phone', 20, 'No phone number found. Recruiter workflows in Workday and Taleo require a phone field.', 'Add a phone number in the form (555) 555-5555.');
  if (!c.location) missing('location', 15, 'No city/state found. Location filters are among the first knock-outs recruiters apply.', 'Add "City, ST" next to your contact details. No street address needed.');
  if (!c.linkedin) missing('linkedin', 12, 'No LinkedIn URL. Recruiters cross-check it in seconds; parsers map it to a dedicated profile field.', 'Add linkedin.com/in/your-handle.');
  if (!c.name) {
    missing('name', 10, 'No name line was detected at the top of the document.', 'Put your name alone on the first line, larger than the body text.');
  }
  if ((ctx.roleId && TECH_ROLES.has(ctx.roleId)) || ctx.targetKeywords.some((k) => k.term === 'git')) {
    if (!c.github && !c.website) missing('portfolio', 8, 'No GitHub or portfolio link, which technical screeners look for on engineering and design profiles.', 'Add a GitHub or portfolio URL.');
  }

  for (const field of c.inDroppedRegion) {
    const ref = c.lineRefs[field as keyof typeof c.lineRefs];
    const line = ref ? byId.get(ref) : undefined;
    if (!line) continue;
    // If the same field also exists in the body, the header copy is harmless.
    const bodyCopy = doc.lines.some((l) => l.source === 'body' && l.id !== line.id && new RegExp(escape(String(c[field as keyof typeof c] ?? '')), 'i').test(l.text));
    if (bodyCopy) continue;
    const cost = field === 'email' ? 12 : field === 'phone' ? 8 : 4;
    findings.push(
      finding({
        categoryId: 'contact',
        ruleId: `${field}-in-${line.source}`,
        quote: line.text,
        lineRef: line.id,
        severity: cost >= 10 ? 'high' : 'medium',
        pointCost: cost,
        explanation: `Your ${field} sits in the page ${line.source}. Parsers that read the body only (most of them) never see it.`,
        fix: `Move it into the body directly under your name.`,
        fixKind: 'contact',
        data: { field },
      }),
    );
  }

  if (c.email && /(69|420|xxx|hot|sexy|cool|lol|dude|babe|gamer|princess|killer|420)/i.test(c.email.split('@')[0])) {
    const line = byId.get(c.lineRefs.email!)!;
    findings.push(
      finding({
        categoryId: 'contact',
        ruleId: 'email-tone',
        quote: line.text,
        lineRef: line.id,
        severity: 'low',
        pointCost: 5,
        explanation: `"${c.email}" reads as a personal handle. Recruiters notice.`,
        fix: 'Use firstname.lastname@ at a mainstream provider.',
        fixKind: 'contact',
      }),
    );
  }
  const contactLines = doc.lines.filter((l) => l.section === 'contact' && l.source === 'body');
  if (contactLines.length > 4) {
    findings.push(
      finding({
        categoryId: 'contact',
        ruleId: 'contact-sprawl',
        quote: contactLines[4].text,
        lineRef: contactLines[4].id,
        severity: 'low',
        pointCost: 3,
        explanation: `Contact details span ${contactLines.length} lines. Parsers read a contact *block*; scattered lines get mis-filed as body text.`,
        fix: 'Put everything on one or two lines under the name, separated by " · ".',
        fixKind: 'merge-lines',
      }),
    );
  }

  findings.sort((a, b) => b.pointCost - a.pointCost);
  const total = findings.reduce((n, f) => n + f.pointCost, 0);
  const found = ['email', 'phone', 'location', 'linkedin'].filter((f) => c[f as keyof typeof c]);
  return {
    id: 'contact',
    label: meta.label,
    weight: meta.weight,
    score: clamp100(Math.round(100 - total)),
    summary: findings.length === 0 ? 'Name, email, phone, location and LinkedIn all present in the body text.' : `${found.length}/4 core fields found${c.inDroppedRegion.length ? `; ${c.inDroppedRegion.join(', ')} only in a header/footer` : ''}.`,
    findings,
    facts: [
      { label: 'Email', value: c.email ? 'found' : 'missing' },
      { label: 'Phone', value: c.phone ? 'found' : 'missing' },
      { label: 'Location', value: c.location ?? 'missing' },
      { label: 'LinkedIn', value: c.linkedin ? 'found' : 'missing' },
    ],
  };
};

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
