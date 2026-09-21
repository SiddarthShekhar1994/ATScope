import type { CategoryScorer, Finding } from './types';
import { finding, CATEGORY_META, clamp100 } from './types';
import { bulletStrength } from './bullet-strength';
import { workBullets, entryLabel, ordinalWord, headingLine, firstLine } from './util';

/**
 * Impact & quantification. Every bullet under a role is scored verb+metric+outcome
 * out of 3. The category score is the mean strength; each weak bullet costs its
 * share, so the findings sum exactly to the missing points.
 */
export const scoreImpact: CategoryScorer = (doc, ctx) => {
  const meta = CATEGORY_META.impact;
  const bullets = workBullets(doc);
  if (bullets.length === 0) {
    const anchor = headingLine(doc, 'experience') ?? firstLine(doc);
    return {
      id: 'impact',
      label: meta.label,
      weight: meta.weight,
      score: 15,
      summary: 'No role bullets were found, so there is nothing that shows what you achieved.',
      findings: [
        finding({
          categoryId: 'impact',
          ruleId: 'no-bullets',
          quote: anchor.text,
          lineRef: anchor.id,
          severity: 'high',
          pointCost: 85,
          explanation: `No bullet points were detected under any role. Recruiters and ranking models look for verb + number + outcome lines; a resume without them reads as a job description, not a track record.`,
          fix: 'Add three to five bullets under each role. Each one: an action verb, a number, and the result.',
          fixKind: 'add-line',
        }),
      ],
      facts: [{ label: 'Bullets found', value: '0' }],
    };
  }
  const strengths = bullets.map((b) => ({ ...b, s: bulletStrength(b.line.id, b.line.text, ctx.placeholderCredit) }));
  const mean = strengths.reduce((n, b) => n + b.s.score, 0) / (3 * strengths.length);
  let score = Math.round(mean * 100);
  const evidencePenalty = strengths.length < 3 ? 100 - 60 : 0;
  if (strengths.length < 3) score = Math.min(score, 60);

  const share = 100 / strengths.length;
  const findings: Finding[] = [];
  for (const b of strengths) {
    if (b.s.score === 3) continue;
    const missing = 3 - b.s.score;
    const cost = (missing / 3) * share * (evidencePenalty ? score / Math.max(1, Math.round(mean * 100)) : 1);
    const label = entryLabel(b.entry);
    const problems: string[] = [];
    if (!b.s.verb) problems.push(/^(responsible|duties|helped|assisted|worked|participated|attended|involved|tasked)/i.test(b.line.text.trim()) ? `opens with "${b.line.text.trim().split(/\s+/).slice(0, 2).join(' ')}" instead of an action verb` : 'has no action verb');
    if (!b.s.metric) problems.push('has no number');
    if (!b.s.outcome) problems.push('states no outcome');
    const fixParts: string[] = [];
    if (!b.s.verb) fixParts.push('start with what you did (Built, Cut, Launched, Negotiated)');
    if (!b.s.metric) fixParts.push('add the scale: how many, how much, how often — use [[number]] if you need to look it up');
    if (!b.s.outcome) fixParts.push('end with what changed because of it');
    findings.push(
      finding({
        categoryId: 'impact',
        ruleId: 'weak-bullet',
        quote: b.line.text,
        lineRef: b.line.id,
        severity: b.s.score === 0 ? 'high' : b.s.score === 1 ? 'medium' : 'low',
        pointCost: cost,
        explanation: `${ordinalWord(b.ordinal)} bullet under ${label} ${joinProblems(problems)}. Strength ${b.s.score}/3.`,
        fix: capitalizeFirst(fixParts.join('; ')) + '.',
        fixKind: 'rewrite-line',
        data: { verb: b.s.verb, metric: b.s.metric, outcome: b.s.outcome, entryId: b.entry?.id ?? '' },
      }),
    );
  }
  if (strengths.length < 3) {
    const anchor = headingLine(doc, 'experience') ?? bullets[0].line;
    findings.push(
      finding({
        categoryId: 'impact',
        ruleId: 'too-few-bullets',
        quote: anchor.text,
        lineRef: anchor.id,
        severity: 'medium',
        pointCost: Math.max(0, Math.round(mean * 100) - score),
        explanation: `Only ${strengths.length} role bullet${strengths.length === 1 ? '' : 's'} in the whole document. Three per role is the floor recruiters expect; the category is capped at 60 until there is more evidence.`,
        fix: 'Add bullets for each role, one per distinct responsibility or result.',
        fixKind: 'add-line',
      }),
    );
  }
  findings.sort((a, b) => b.pointCost - a.pointCost);
  const withNumber = strengths.filter((b) => b.s.metric).length;
  const withVerb = strengths.filter((b) => b.s.verb).length;
  const withOutcome = strengths.filter((b) => b.s.outcome).length;
  return {
    id: 'impact',
    label: meta.label,
    weight: meta.weight,
    score: clamp100(score),
    summary: `${withNumber} of ${strengths.length} bullets contain a number; ${withVerb} open with an action verb; ${withOutcome} state an outcome.`,
    findings,
    facts: [
      { label: 'Bullets scored', value: String(strengths.length) },
      { label: 'With a number', value: `${withNumber}/${strengths.length}` },
      { label: 'With an outcome', value: `${withOutcome}/${strengths.length}` },
      { label: 'Mean strength', value: `${(mean * 3).toFixed(1)}/3` },
    ],
  };
};

function joinProblems(p: string[]): string {
  if (p.length === 1) return p[0];
  if (p.length === 2) return `${p[0]} and ${p[1]}`;
  return `${p.slice(0, -1).join(', ')}, and ${p[p.length - 1]}`;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
