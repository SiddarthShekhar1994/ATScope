import type { CategoryScorer, Finding } from './types';
import { finding, CATEGORY_META, clamp100 } from './types';
import { STANDARD_LABEL } from '../parse/headings';
import { headingLine, nameLine, firstLine, yearsOfExperience, capCosts, lineMap, entryLabel } from './util';

/**
 * Structure & section hygiene: the sections an ATS maps, whether it can find
 * them, whether every role carries dates and content, and overall length.
 */
export const scoreStructure: CategoryScorer = (doc) => {
  const meta = CATEGORY_META.structure;
  const byId = lineMap(doc);
  const groups: Finding[][] = [];
  const has = (id: string) => doc.sections.some((s) => s.id === id && s.lineIds.length > 0);
  const anchor = nameLine(doc) ?? firstLine(doc);
  const years = yearsOfExperience(doc);
  const expEntries = doc.entries.filter((e) => e.section === 'experience');

  const missing: Finding[] = [];
  if (!has('experience')) {
    missing.push(
      finding({
        categoryId: 'structure',
        ruleId: 'missing-experience',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'high',
        pointCost: 30,
        explanation: 'No section maps to Experience / Work History. Every ATS builds its candidate profile from that section; without it the profile is empty.',
        fix: 'Add an "Experience" heading with one dated entry per role.',
        fixKind: 'restructure',
        data: { section: 'experience' },
      }),
    );
  }
  if (!has('education')) {
    missing.push(
      finding({
        categoryId: 'structure',
        ruleId: 'missing-education',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'medium',
        pointCost: 15,
        explanation: 'No Education section found. Knock-out questions about degree level are answered from this section; a blank fails them.',
        fix: 'Add "Education" with degree, school and year.',
        fixKind: 'restructure',
        data: { section: 'education' },
      }),
    );
  }
  if (!has('skills')) {
    missing.push(
      finding({
        categoryId: 'structure',
        ruleId: 'missing-skills',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'medium',
        pointCost: 15,
        explanation: 'No Skills section. Keyword matchers weight a labelled skills list heavily because it is the one place terms appear without prose around them.',
        fix: 'Add "Skills" as a single-column comma-separated list grouped by type.',
        fixKind: 'restructure',
        data: { section: 'skills' },
      }),
    );
  }
  groups.push(missing);

  // Non-standard headings.
  const nonStandard = doc.sections.filter((s) => s.nonStandardHeading && s.headingLineId);
  groups.push(
    capCosts(
      nonStandard.map((s) => {
        const line = byId.get(s.headingLineId!)!;
        const standard = STANDARD_LABEL[s.id] || 'Experience';
        return finding({
          categoryId: 'structure',
          ruleId: 'nonstandard-heading',
          quote: line.text,
          lineRef: line.id,
          severity: 'medium',
          pointCost: 8,
          explanation: `"${line.text}" is not a heading parsers recognise. Section mapping is a lookup against a fixed list; Workday and Taleo file unrecognised sections under "other" or drop them.`,
          fix: `Rename to "${standard}".`,
          fixKind: 'rename-heading',
          data: { from: line.text, to: standard, section: s.id },
        });
      }),
      24,
    ),
  );

  const unlabeled = doc.sections.find((s) => s.id === 'summary' && s.nonStandardHeading && !s.headingLineId);
  if (unlabeled) {
    const line = byId.get(unlabeled.lineIds[0])!;
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'unlabeled-summary',
        quote: line.text,
        lineRef: line.id,
        severity: 'low',
        pointCost: 5,
        explanation: 'A paragraph sits above the first heading with no label. Parsers attach it to the contact block or discard it.',
        fix: 'Put a "Summary" heading above it.',
        fixKind: 'add-line',
      }),
    ]);
  }

  // Dates.
  groups.push(
    capCosts(
      doc.entries
        .filter((e) => (e.section === 'experience' || e.section === 'education') && !e.dateParseable)
        .map((e) => {
          const line = byId.get(e.headerLineIds[0])!;
          return finding({
            categoryId: 'structure',
            ruleId: 'undated-entry',
            quote: line.text,
            lineRef: line.id,
            severity: 'medium',
            pointCost: 6,
            explanation: `${entryLabel(e)} has no date range a parser can read. Tenure and recency are computed fields; this role contributes zero to both.`,
            fix: 'Add "Mon YYYY – Mon YYYY" (or "– Present") on the entry line.',
            fixKind: 'rewrite-line',
            data: { entryId: e.id },
          });
        }),
      18,
    ),
  );
  const formats = new Set(
    expEntries
      .filter((e) => e.dates)
      .map((e) => {
        const d = e.dates!;
        if (/\d{1,2}\/\d{2,4}/.test(d)) return 'numeric';
        if (/[a-z]{3,}\.?\s*'?\d{2,4}/i.test(d)) return 'month-year';
        return 'year';
      }),
  );
  if (formats.size > 1) {
    const a = expEntries.find((e) => e.dates)!;
    const b = expEntries.find((e) => e.dates && classify(e.dates) !== classify(a.dates!))!;
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'mixed-date-formats',
        quote: byId.get(a.headerLineIds[0])!.text,
        lineRef: a.headerLineIds[0],
        relatedLineRefs: [b.headerLineIds[0]],
        severity: 'low',
        pointCost: 5,
        explanation: `Dates are written ${formats.size} different ways ("${a.dates}" vs "${b.dates}"). Some parsers only recognise one pattern per document.`,
        fix: 'Use one format everywhere, ideally "Jan 2022 – Mar 2024".',
        fixKind: 'rewrite-line',
      }),
    ]);
  }

  // Entries without content.
  groups.push(
    capCosts(
      expEntries
        .filter((e) => e.bulletLineIds.length === 0)
        .map((e) => {
          const line = byId.get(e.headerLineIds[0])!;
          return finding({
            categoryId: 'structure',
            ruleId: 'empty-entry',
            quote: line.text,
            lineRef: line.id,
            severity: 'medium',
            pointCost: 5,
            explanation: `${entryLabel(e)} lists a title and dates but nothing you did there.`,
            fix: 'Add two to four bullets, or fold the role into one line under a "Earlier experience" entry if it is old.',
            fixKind: 'add-line',
            data: { entryId: e.id },
          });
        }),
      10,
    ),
  );
  groups.push(
    capCosts(
      expEntries
        .filter((e) => !e.title || !e.org)
        .map((e) => {
          const line = byId.get(e.headerLineIds[0])!;
          return finding({
            categoryId: 'structure',
            ruleId: 'incomplete-entry',
            quote: line.text,
            lineRef: line.id,
            severity: 'low',
            pointCost: 3,
            explanation: `A parser could not separate the job title from the employer on this line (${!e.title ? 'no title found' : 'no employer found'}).`,
            fix: 'Write the entry as "Title — Employer | City, ST | Dates".',
            fixKind: 'rewrite-line',
            data: { entryId: e.id },
          });
        }),
      9,
    ),
  );

  // Order: experienced people with Education before Experience.
  const order = doc.sections.filter((s) => s.lineIds.length).map((s) => s.id);
  const eduIdx = order.indexOf('education');
  const expIdx = order.indexOf('experience');
  if (eduIdx !== -1 && expIdx !== -1 && eduIdx < expIdx && years >= 3) {
    const line = headingLine(doc, 'education')!;
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'section-order',
        quote: line.text,
        lineRef: line.id,
        severity: 'low',
        pointCost: 4,
        explanation: `Education comes before Experience although you have about ${years} years of work. Recruiters read top-down for six seconds; the degree is not the headline any more.`,
        fix: 'Move Experience above Education.',
        fixKind: 'restructure',
      }),
    ]);
  }

  // Length.
  const words = doc.layout.wordCount;
  if (doc.layout.pageCount > 2) {
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'too-long',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'medium',
        pointCost: 8,
        explanation: `${doc.layout.pageCount} pages. Past two, older roles get skimmed and some ATSs truncate the profile.`,
        fix: 'Cut to two pages: compress roles older than ten years to one line each.',
        fixKind: 'restructure',
      }),
    ]);
  } else if (words > 950 && years < 8) {
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'dense',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'low',
        pointCost: 4,
        explanation: `${words} words for roughly ${years} years of experience. Density reads as padding.`,
        fix: 'Trim bullets without a number first.',
        fixKind: 'restructure',
      }),
    ]);
  }
  if (words < 200) {
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'thin',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: words < 120 ? 'medium' : 'low',
        pointCost: words < 120 ? 12 : 6,
        explanation: `Only ${words} words. Keyword matchers work on frequency; there is not enough text here to match anything.`,
        fix: 'Add bullets under each role and a skills list.',
        fixKind: 'add-line',
      }),
    ]);
  }

  // Old-fashioned bits.
  const objective = doc.sections.find((s) => s.id === 'summary' && s.headingLineId && /objective/i.test(byId.get(s.headingLineId)?.text ?? ''));
  if (objective) {
    const line = byId.get(objective.headingLineId!)!;
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'objective-heading',
        quote: line.text,
        lineRef: line.id,
        severity: 'low',
        pointCost: 3,
        explanation: '"Objective" headings date a resume. Recruiters read them as what you want rather than what you offer.',
        fix: 'Rename to "Summary" and rewrite as facts about you.',
        fixKind: 'rename-heading',
        data: { from: line.text, to: 'Summary', section: 'summary' },
      }),
    ]);
  }
  const refs = doc.lines.find((l) => /references (available )?(upon|on) request/i.test(l.text));
  if (refs) {
    groups.push([
      finding({
        categoryId: 'structure',
        ruleId: 'references-line',
        quote: refs.text,
        lineRef: refs.id,
        severity: 'low',
        pointCost: 3,
        explanation: 'This line is assumed. It spends a line saying nothing.',
        fix: 'Delete it.',
        fixKind: 'remove-line',
      }),
    ]);
  }

  const findings = groups.flat().sort((a, b) => b.pointCost - a.pointCost);
  const total = findings.reduce((n, f) => n + f.pointCost, 0);
  const score = clamp100(Math.round(100 - total));
  const present = ['summary', 'experience', 'education', 'skills'].filter(has);
  return {
    id: 'structure',
    label: meta.label,
    weight: meta.weight,
    score,
    summary:
      findings.length === 0
        ? 'All core sections present under standard headings, every role dated.'
        : `${present.length}/4 core sections recognised; ${nonStandard.length} non-standard heading${nonStandard.length === 1 ? '' : 's'}; ${expEntries.filter((e) => !e.dateParseable).length} undated role${expEntries.filter((e) => !e.dateParseable).length === 1 ? '' : 's'}.`,
    findings,
    facts: [
      { label: 'Sections', value: String(doc.sections.filter((s) => s.lineIds.length).length) },
      { label: 'Pages', value: String(doc.layout.pageCount) },
      { label: 'Words', value: String(words) },
      { label: 'Roles', value: String(expEntries.length) },
    ],
  };
};

function classify(d: string): string {
  if (/\d{1,2}\/\d{2,4}/.test(d)) return 'numeric';
  if (/[a-z]{3,}\.?\s*'?\d{2,4}/i.test(d)) return 'month-year';
  return 'year';
}
