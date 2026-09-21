import type { CategoryScorer, Finding, KeywordMap } from './types';
import { finding, CATEGORY_META, clamp100 } from './types';
import { matchKeywords } from './keywords/extract';
import { headingLine, nameLine, firstLine, lineMap, capCosts } from './util';

/**
 * Keyword coverage against the target (pasted JD, chosen role, or inferred
 * role). Score is the weighted share of target terms present. Each missing term
 * costs exactly its share, so the findings reconcile to the score.
 */
export const scoreKeywords: CategoryScorer = (doc, ctx) => {
  const meta = CATEGORY_META.keywords;
  const map = matchKeywords(doc, ctx);
  return { ...buildCategory(doc, ctx.targetLabel, map), id: 'keywords', label: meta.label, weight: meta.weight };
};

export function buildCategory(doc: Parameters<CategoryScorer>[0], targetLabel: string, map: KeywordMap) {
  const byId = lineMap(doc);
  const skillsHeading = headingLine(doc, 'skills');
  const skillsSection = doc.sections.find((s) => s.id === 'skills' && s.lineIds.length);
  const skillsLine = skillsSection ? byId.get(skillsSection.lineIds[0]) : undefined;
  const anchor = skillsLine ?? skillsHeading ?? nameLine(doc) ?? firstLine(doc);
  const totalWeight = map.present.reduce((n, k) => n + k.weight, 0) + map.missing.reduce((n, k) => n + k.weight, 0) || 1;

  const findings: Finding[] = map.missing.map((m) => {
    const share = (m.weight / totalWeight) * 100;
    const supported = m.supportedBy && m.supportedBy.length > 0;
    return finding({
      categoryId: 'keywords',
      ruleId: 'missing-keyword',
      id: `keywords-missing-${m.term.replace(/[^a-z0-9]+/gi, '-')}`,
      quote: anchor.text,
      lineRef: anchor.id,
      severity: m.weight === 3 ? 'high' : m.weight === 2 ? 'medium' : 'low',
      pointCost: share,
      explanation: `"${m.term}" is ${m.weight === 3 ? 'a required term in' : m.weight === 2 ? 'expected for' : 'a nice-to-have for'} ${targetLabel}. It appears nowhere in the document${supported ? `, although you list ${m.supportedBy!.slice(0, 2).join(' and ')}, which implies it` : ''}.`,
      fix: supported
        ? `Add "${m.term}" to the Skills line and, where true, to the bullet that mentions ${m.supportedBy![0]}.`
        : `Add "${m.term}" only if you have actually used it: in Skills, and in the bullet describing where.`,
      fixKind: 'add-keyword',
      data: { term: m.term, weight: m.weight, supportedBy: m.supportedBy ?? [], supported: !!supported },
    });
  });

  const overuse = capCosts(
    map.overused.map((o) => {
      const line = byId.get(o.lineRefs[Math.min(o.lineRefs.length - 1, o.limit)]) ?? anchor;
      return finding({
        categoryId: 'keywords',
        ruleId: 'overused-keyword',
        id: `keywords-overused-${o.term.replace(/[^a-z0-9]+/gi, '-')}`,
        quote: line.text,
        lineRef: line.id,
        relatedLineRefs: o.lineRefs,
        severity: 'low',
        pointCost: 3,
        explanation: `"${o.term}" appears ${o.count} times. Past ${o.limit} mentions, modern rankers stop rewarding it and recruiters read it as keyword stuffing.`,
        fix: `Keep "${o.term}" in Skills and in the two strongest bullets; cut the rest.`,
        fixKind: 'rewrite-line',
        data: { term: o.term, count: o.count },
      });
    }),
    9,
  );

  const all = [...findings, ...overuse].sort((a, b) => b.pointCost - a.pointCost);
  const score = clamp100(Math.round(map.jdMatchPercent - overuse.reduce((n, f) => n + f.pointCost, 0)));
  const required = map.present.filter((k) => k.weight === 3).length + map.missing.filter((k) => k.weight === 3).length;
  const requiredHit = map.present.filter((k) => k.weight === 3).length;
  return {
    score,
    summary: `${map.jdMatchPercent}% weighted match with ${targetLabel}: ${map.present.length} of ${map.present.length + map.missing.length} terms present${required ? `, ${requiredHit}/${required} required` : ''}${map.overused.length ? `; ${map.overused.length} overused` : ''}.`,
    findings: all,
    facts: [
      { label: 'Target', value: targetLabel },
      { label: 'Present', value: `${map.present.length}/${map.present.length + map.missing.length}` },
      { label: 'Required hit', value: required ? `${requiredHit}/${required}` : '—' },
      { label: 'Supported adds', value: String(map.missing.filter((m) => m.supportedBy?.length).length) },
    ],
  };
}
