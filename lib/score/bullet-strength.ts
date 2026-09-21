import type { BulletStrength } from './types';

/**
 * Verb + metric + outcome. Each bullet earns up to three points. This is the
 * same function the impact scorer, the bullet meter in the UI and the rewrite
 * verifier use, so every number agrees.
 */

export const STRONG_VERBS = new Set(
  `achieved accelerated architected automated boosted built centralized closed coached consolidated created cut decreased delivered deployed designed developed directed doubled drove earned eliminated engineered established exceeded expanded generated grew guided implemented improved increased influenced initiated introduced launched led lowered maintained managed mentored migrated modernized negotiated optimized orchestrated organized overhauled owned partnered piloted planned presented produced programmed published raised rebuilt redesigned reduced refactored released resolved restructured revamped reviewed saved scaled secured shipped shortened simplified slashed sold standardized streamlined strengthened surpassed taught tested trained transformed tripled unified upgraded won wrote analyzed audited authored budgeted calculated coded compiled conducted converted coordinated defined diagnosed documented drafted edited enabled enforced evaluated executed facilitated forecasted formulated founded headed hired identified instituted integrated investigated leveraged lifted marketed measured merged modeled monitored motivated navigated onboarded operated outperformed oversaw prioritized processed procured prototyped quantified recruited remediated reorganized reported researched retained scheduled selected served shaped solved sourced spearheaded specified supervised supported surveyed synthesized tracked translated triaged validated verified visualized`.split(/\s+/),
);

export const WEAK_START_RE = /^(responsible for|responsibilities included|duties included|helped (?:with|to)?|assisted (?:with|in)?|worked (?:on|with|in|as)|participated in|attended|involved in|tasked with|in charge of|handled|dealt with|took part in|was responsible|were responsible|provided support|supported the|support(?:ed)? (?:with|in)|performed various|performed|did|acted as|served as|contributed to|familiar with|exposure to|learned|gained experience|various)\b/i;

export const OUTCOME_RE = /\b(increas|reduc|cut|grew|grow|sav(?:ed|ing)|improv|boost|decreas|accelerat|eliminat|doubl|tripl|rais|lower|shorten|achiev|exceed|won|generat|result(?:ed|ing) in|led to|leading to|enabl|so that|allow(?:ed|ing)|from .{1,40} to|by \d|up \d|down \d|ahead of schedule|under budget|on time|on budget|revenue|cost|latency|churn|retention|conversion|adoption|satisfaction|nps|throughput|uptime|error rate|time[- ]to|productivity|efficien|accuracy|coverage|engagement|attendance|enrollment|sales|profit|margin|roi|market share|headcount|turnaround|sla|slas|zero|missed|incidents|downtime|defects|bugs|promoted|adopted|awarded|recognized|approved|passed|retained)/i;

export const NUMBER_WORDS_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|dozens|hundreds|thousands|millions|half|twice|double|triple)\b/i;
export const PLACEHOLDER_RE = /\[\[[^\]]*\]\]/g;
/** Non-global twin for .test(): a /g regex keeps lastIndex between calls and alternates results. */
export const HAS_PLACEHOLDER_RE = /\[\[[^\]]*\]\]/;

/** Digits that are only dates/years/versions do not count as a metric. */
export function hasMetric(text: string, placeholderCredit = false): boolean {
  let t = text;
  if (placeholderCredit && HAS_PLACEHOLDER_RE.test(t)) return true;
  t = t.replace(PLACEHOLDER_RE, '');
  t = t.replace(/\b(19|20)\d{2}\b/g, ''); // years
  t = t.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ''); // dates
  t = t.replace(/\b(?:v|version)\s?\d+(?:\.\d+)*/gi, ''); // versions
  t = t.replace(/\b\d+(?:st|nd|rd|th)\b/gi, ''); // ordinals
  t = t.replace(/\b(24\/7|9-5|401k|401\(k\)|w-2|1099|k-12|s3|ec2|c\+\+|html5|css3|python ?3|web ?3|es6|utf-?8|iso ?\d+|soc ?2|i\d+|b2b|b2c|d3|3d|2d|h1|h2|q[1-4])\b/gi, '');
  if (/\d/.test(t)) return true;
  return NUMBER_WORDS_RE.test(t) && /\b(users|customers|clients|people|engineers|team|members|reports|accounts|projects|stores|countries|states|markets|products|features|releases|campaigns|events|patients|students|classes|sites|locations|vendors|partners)\b/i.test(t);
}

export function verbStrength(text: string): 0 | 1 {
  const t = text.trim().replace(/^[^a-zA-Z]+/, '');
  if (!t) return 0;
  if (WEAK_START_RE.test(t)) return 0;
  const first = t.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  if (STRONG_VERBS.has(first)) return 1;
  if (/^(i|my|we|our)$/.test(first)) return 0;
  // Regular past tense or third person verbs still count; nouns and gerunds do not.
  if (/ed$/.test(first) && first.length > 3) return 1;
  if (/^(lead|drive|build|design|manage|own|ship|run|write|develop|create|deliver|launch|grow|cut|reduce|increase|improve|analyze|maintain|support|coordinate|plan|train|mentor|negotiate|sell|teach|research|test|deploy|automate|migrate|optimize|architect|scale)s?$/.test(first)) return 1;
  return 0;
}

/** A placeholder that stands for a result ("[[result: what improved]]") counts as an outcome only when credited. */
export const OUTCOME_PLACEHOLDER_RE = /\[\[[^\]]*(result|outcome|impact|improv|sav|reduc|increas|grow|cut)[^\]]*\]\]/i;

export function bulletStrength(lineRef: string, text: string, placeholderCredit = false): BulletStrength {
  // Hint words inside [[placeholders]] never count on their own; only the credit flag does.
  const stripped = text.replace(PLACEHOLDER_RE, ' ');
  const verb = verbStrength(stripped);
  const metric: 0 | 1 = hasMetric(text, placeholderCredit) ? 1 : 0;
  const outcome: 0 | 1 = OUTCOME_RE.test(stripped) || (placeholderCredit && OUTCOME_PLACEHOLDER_RE.test(text)) ? 1 : 0;
  const notes: string[] = [];
  if (!verb) notes.push(WEAK_START_RE.test(text.trim()) ? 'weak opener' : 'no action verb');
  if (!metric) notes.push('no number');
  if (!outcome) notes.push('no outcome');
  return { lineRef, text, verb, metric, outcome, score: verb + metric + outcome, notes };
}
