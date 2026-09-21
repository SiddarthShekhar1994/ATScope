import type { CategoryScorer, Finding } from './types';
import { finding, CATEGORY_META, clamp100 } from './types';
import { WEAK_START_RE } from './bullet-strength';
import { workBullets, capCosts, wordCount } from './util';

/**
 * Writing quality: verb strength, filler, redundancy, first person, passive
 * voice, and the generic phrasing that screening tools now flag as
 * machine-written. Every rule quotes the line it fires on.
 */

export const AI_PHRASES: { re: RegExp; label: string; swap: string }[] = [
  { re: /\bspearhead(?:ed|ing|s)?\b/i, label: 'spearheaded', swap: 'led / launched' },
  { re: /\bleverag(?:e|ed|ing|es)\b/i, label: 'leveraged', swap: 'used' },
  { re: /\bsynerg(?:y|ies|istic|ize)\b/i, label: 'synergy', swap: 'worked with / combined' },
  { re: /\butiliz(?:e|ed|ing|es)\b/i, label: 'utilized', swap: 'used' },
  { re: /\bcutting[- ]edge\b/i, label: 'cutting-edge', swap: 'name the technology' },
  { re: /\bresults[- ]driven\b/i, label: 'results-driven', swap: 'state a result' },
  { re: /\bdynamic\b/i, label: 'dynamic', swap: 'cut it' },
  { re: /\bpassionate\b/i, label: 'passionate', swap: 'show it with a result' },
  { re: /\bseasoned\b/i, label: 'seasoned', swap: 'give the years' },
  { re: /\bdelv(?:e|ed|ing)\b/i, label: 'delve', swap: 'analyzed / investigated' },
  { re: /\brobust\b/i, label: 'robust', swap: 'say what it withstands' },
  { re: /\bproven track record\b/i, label: 'proven track record', swap: 'the record itself' },
  { re: /\bgo[- ]getter\b/i, label: 'go-getter', swap: 'cut it' },
  { re: /\bthink(?:s|ing)? outside (?:of )?the box\b/i, label: 'think outside the box', swap: 'cut it' },
  { re: /\bhard[- ]work(?:er|ing)\b/i, label: 'hard worker', swap: 'cut it' },
  { re: /\bteam player\b/i, label: 'team player', swap: 'name the team and what you did with it' },
  { re: /\bdetail[- ]oriented\b/i, label: 'detail-oriented', swap: 'cut it' },
  { re: /\bself[- ]starter\b/i, label: 'self-starter', swap: 'cut it' },
  { re: /\bfast[- ]paced\b/i, label: 'fast-paced', swap: 'cut it' },
  { re: /\bhit the ground running\b/i, label: 'hit the ground running', swap: 'cut it' },
  { re: /\bthought leader(?:ship)?\b/i, label: 'thought leader', swap: 'cite the talk or article' },
  { re: /\bbest[- ]in[- ]class\b/i, label: 'best-in-class', swap: 'give the benchmark' },
  { re: /\bworld[- ]class\b/i, label: 'world-class', swap: 'give the benchmark' },
  { re: /\bstakeholders? buy[- ]in\b/i, label: 'stakeholder buy-in', swap: 'who agreed to what' },
  { re: /\bmeticulous(?:ly)?\b/i, label: 'meticulous', swap: 'cut it' },
  { re: /\bstrong (?:communication|interpersonal|analytical) skills\b/i, label: 'strong … skills', swap: 'evidence, not adjectives' },
  { re: /\bgame[- ]chang(?:er|ing)\b/i, label: 'game-changing', swap: 'give the number' },
  { re: /\bin today'?s\b/i, label: "in today's …", swap: 'cut it' },
  { re: /\bstreamlined? processes\b/i, label: 'streamlined processes', swap: 'which process, by how much' },
];

const FILLER_RE = /\b(various|numerous|a variety of|a wide range of|a range of|several|many|multiple|etc\.?|and more|and other duties|as needed|as required|other tasks|day[- ]to[- ]day|on a daily basis|when necessary|as assigned|miscellaneous)\b/i;
const FIRST_PERSON_RE = /(^|[^a-zA-Z])(I|I'm|I've|my|me|myself|we|our)([^a-zA-Z]|$)/;
const PASSIVE_RE = /\b(was|were|is|are|been|being)\s+(responsible|tasked|involved|asked|assigned|required|expected|chosen|selected)\b/i;
const BUZZ_SUMMARY_RE = /\b(seeking|looking for|opportunity to|challenging position|challenging role|where i can|grow my skills|utilize my skills|leverage my skills|contribute to (?:the )?(?:success|growth))\b/i;

export const scoreWriting: CategoryScorer = (doc) => {
  const meta = CATEGORY_META.writing;
  const bullets = workBullets(doc);
  const prose = doc.lines.filter((l) => (l.source === 'body' || l.source === 'table') && (l.kind === 'bullet' || l.kind === 'text') && l.section !== 'contact' && l.section !== 'skills');
  const groups: Finding[][] = [];

  // Weak openers.
  groups.push(
    capCosts(
      bullets
        .filter((b) => WEAK_START_RE.test(b.line.text.trim()))
        .map((b) => {
          const opener = b.line.text.trim().match(WEAK_START_RE)![0];
          return finding({
            categoryId: 'writing',
            ruleId: 'weak-opener',
            quote: b.line.text,
            lineRef: b.line.id,
            severity: 'high',
            pointCost: 8,
            explanation: `Opens with "${opener}". That phrase describes a duty, not an action, and recruiters skim past it.`,
            fix: `Delete "${opener}" and start with the verb: what did you build, cut, launch or fix?`,
            fixKind: 'rewrite-line',
            data: { opener },
          });
        }),
      40,
    ),
  );

  // Generic / AI phrasing.
  const aiHits: Finding[] = [];
  for (const l of prose) {
    for (const p of AI_PHRASES) {
      const m = l.text.match(p.re);
      if (!m) continue;
      aiHits.push(
        finding({
          categoryId: 'writing',
          ruleId: 'generic-phrase',
          id: `writing-generic-${p.label}-${l.id}`,
          quote: l.text,
          lineRef: l.id,
          severity: 'medium',
          pointCost: 4,
          explanation: `"${m[0]}" is on the generic-phrasing list several screening tools now flag as machine-written filler.`,
          fix: `Replace "${m[0]}" → ${p.swap}.`,
          fixKind: 'rewrite-line',
          data: { phrase: m[0], swap: p.swap },
        }),
      );
    }
  }
  groups.push(capCosts(aiHits, 24));

  // Filler.
  groups.push(
    capCosts(
      prose
        .filter((l) => FILLER_RE.test(l.text))
        .map((l) => {
          const m = l.text.match(FILLER_RE)![0];
          return finding({
            categoryId: 'writing',
            ruleId: 'filler',
            quote: l.text,
            lineRef: l.id,
            severity: 'low',
            pointCost: 3,
            explanation: `"${m}" is filler. It tells the reader nothing they can verify and pads the line.`,
            fix: `Cut "${m}" and name the specific thing (which tasks, how many, which tools).`,
            fixKind: 'rewrite-line',
            data: { phrase: m },
          });
        }),
      15,
    ),
  );

  // First person.
  const fp = prose.find((l) => FIRST_PERSON_RE.test(l.text));
  if (fp) {
    groups.push([
      finding({
        categoryId: 'writing',
        ruleId: 'first-person',
        quote: fp.text,
        lineRef: fp.id,
        severity: 'low',
        pointCost: 5,
        explanation: 'Uses first person. Resume convention is implied subject ("Built…", not "I built…"); parsers and recruiters expect it.',
        fix: 'Remove "I", "my", "we" and start each line with the verb.',
        fixKind: 'rewrite-line',
      }),
    ]);
  }

  // Passive voice.
  groups.push(
    capCosts(
      prose
        .filter((l) => PASSIVE_RE.test(l.text))
        .map((l) =>
          finding({
            categoryId: 'writing',
            ruleId: 'passive',
            quote: l.text,
            lineRef: l.id,
            severity: 'low',
            pointCost: 3,
            explanation: `Passive construction "${l.text.match(PASSIVE_RE)![0]}" hides who did the work.`,
            fix: 'Rewrite in active voice with you as the subject.',
            fixKind: 'rewrite-line',
          }),
        ),
      9,
    ),
  );

  // Repeated openers.
  const openers = new Map<string, typeof bullets>();
  for (const b of bullets) {
    const first = b.line.text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (!first) continue;
    openers.set(first, [...(openers.get(first) ?? []), b]);
  }
  const repeated: Finding[] = [];
  for (const [word, list] of openers) {
    if (list.length < 3 || WEAK_START_RE.test(list[0].line.text)) continue;
    repeated.push(
      finding({
        categoryId: 'writing',
        ruleId: 'repeated-opener',
        quote: list[2].line.text,
        lineRef: list[2].line.id,
        relatedLineRefs: list.map((b) => b.line.id),
        severity: 'low',
        pointCost: 4,
        explanation: `"${capitalize(word)}" opens ${list.length} bullets. Repetition reads as a template and wastes the strongest slot in each line.`,
        fix: `Vary the verbs: keep "${capitalize(word)}" once and pick specific alternatives for the others.`,
        fixKind: 'rewrite-line',
        data: { word, count: list.length },
      }),
    );
  }
  groups.push(capCosts(repeated, 12));

  // Identical structure: most bullets follow the same "Verb-ed X by N%" skeleton.
  if (bullets.length >= 5) {
    // Starting with a verb is normal. The machine-written tell is the *rest* of the
    // skeleton repeating: "… by N%" tails, ", resulting in …" clauses, mirrored lengths.
    const sig = (t: string) => `${/\bby\s+\[?\[?\d/.test(t) || /\bby\s+\[\[/.test(t) ? 'B' : 'x'}${/\d+%|\[\[[^\]]*%/.test(t) ? '%' : 'x'}${/,\s*(resulting|leading|which|driving|enabling)/i.test(t) ? 'R' : 'x'}${/,\s*\[\[result/i.test(t) ? 'P' : 'x'}`;
    const counts = new Map<string, typeof bullets>();
    for (const b of bullets) counts.set(sig(b.line.text), [...(counts.get(sig(b.line.text)) ?? []), b]);
    const [topSig, top] = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const features = topSig.replace(/x/g, '').length;
    if (top.length / bullets.length >= 0.7 && features >= 2) {
      groups.push([
        finding({
          categoryId: 'writing',
          ruleId: 'identical-structure',
          quote: top[0].line.text,
          lineRef: top[0].line.id,
          relatedLineRefs: top.slice(0, 6).map((b) => b.line.id),
          severity: 'medium',
          pointCost: 8,
          explanation: `${top.length} of ${bullets.length} bullets share one sentence skeleton. Screening tools that flag machine-generated prose key on exactly this uniformity.`,
          fix: 'Lead a few bullets with the result, a few with the scope, and vary length; keep the facts.',
          fixKind: 'rewrite-line',
        }),
      ]);
    }
  }

  // Overlong lines and objective-style summaries.
  groups.push(
    capCosts(
      bullets
        .filter((b) => wordCount(b.line.text) > 40)
        .map((b) =>
          finding({
            categoryId: 'writing',
            ruleId: 'overlong',
            quote: b.line.text,
            lineRef: b.line.id,
            severity: 'low',
            pointCost: 2,
            explanation: `${wordCount(b.line.text)} words in one bullet. Anything past ~30 gets skimmed, and ranking models truncate long lines.`,
            fix: 'Split into two bullets or cut the clause that carries no number.',
            fixKind: 'rewrite-line',
          }),
        ),
      8,
    ),
  );
  const summaryLines = doc.lines.filter((l) => l.section === 'summary' && l.kind === 'text');
  const objective = summaryLines.find((l) => BUZZ_SUMMARY_RE.test(l.text));
  if (objective) {
    groups.push([
      finding({
        categoryId: 'writing',
        ruleId: 'objective-summary',
        quote: objective.text,
        lineRef: objective.id,
        severity: 'medium',
        pointCost: 5,
        explanation: `The summary talks about what you are seeking ("${objective.text.match(BUZZ_SUMMARY_RE)![0]}"). Recruiters want what you have done; objectives went out a decade ago.`,
        fix: 'Rewrite the summary as two lines of fact: role, years, domain, one or two headline numbers.',
        fixKind: 'rewrite-line',
      }),
    ]);
  }
  const summaryWords = summaryLines.reduce((n, l) => n + wordCount(l.text), 0);
  if (summaryWords > 90) {
    groups.push([
      finding({
        categoryId: 'writing',
        ruleId: 'summary-long',
        quote: summaryLines[0].text,
        lineRef: summaryLines[0].id,
        severity: 'low',
        pointCost: 4,
        explanation: `The summary runs ${summaryWords} words. Past 60 it stops being a summary.`,
        fix: 'Cut to three sentences.',
        fixKind: 'rewrite-line',
      }),
    ]);
  }

  const findings = groups.flat().sort((a, b) => b.pointCost - a.pointCost);
  const total = findings.reduce((n, f) => n + f.pointCost, 0);
  const score = clamp100(Math.round(100 - total));
  const weakCount = bullets.filter((b) => WEAK_START_RE.test(b.line.text.trim())).length;
  return {
    id: 'writing',
    label: meta.label,
    weight: meta.weight,
    score,
    summary:
      findings.length === 0
        ? 'Clean, active, specific prose with no template phrasing detected.'
        : `${weakCount} weak opener${weakCount === 1 ? '' : 's'}, ${aiHits.length} generic phrase${aiHits.length === 1 ? '' : 's'}, ${groups[2].length} filler word${groups[2].length === 1 ? '' : 's'}.`,
    findings,
    facts: [
      { label: 'Weak openers', value: `${weakCount}/${bullets.length || 0}` },
      { label: 'Generic phrases', value: String(aiHits.length) },
      { label: 'Filler words', value: String(groups[2].length) },
    ],
  };
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
