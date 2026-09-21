import type { Entry, ParsedResume } from '../parse/types';
import { WEAK_START_RE, hasMetric, OUTCOME_RE, verbStrength, STRONG_VERBS } from '../score/bullet-strength';
import { AI_PHRASES } from '../score/writing';
import { yearsOfExperience } from '../score/util';

/**
 * Deterministic rewrites used when no model is configured or a model bullet
 * fails verification. They never add facts: every missing number becomes a
 * [[placeholder]] the person fills in.
 */

const IRREGULAR: Record<string, string> = {
  build: 'built',
  run: 'ran',
  write: 'wrote',
  lead: 'led',
  make: 'made',
  drive: 'drove',
  grow: 'grew',
  sell: 'sold',
  teach: 'taught',
  bring: 'brought',
  buy: 'bought',
  meet: 'met',
  hold: 'held',
  win: 'won',
  cut: 'cut',
  oversee: 'oversaw',
  keep: 'kept',
  get: 'got',
  give: 'gave',
  take: 'took',
  do: 'did',
  go: 'went',
  set: 'set',
  put: 'put',
  send: 'sent',
  spend: 'spent',
  begin: 'began',
  choose: 'chose',
  speak: 'spoke',
  understand: 'understood',
};

const FILLER_RE = /\b(various|numerous|a variety of|a wide range of|a range of|several|as needed|as required|etc\.?|and more|and other duties|other tasks|day[- ]to[- ]day|on a daily basis|when necessary|as assigned|miscellaneous)\b\s*/gi;

/**
 * "managing" -> "managed", "planning" -> "planned", "applying" -> "applied",
 * "building" -> "built". English gerunds drop a final e or double a consonant,
 * and the past tense does the same, so stem + "ed" is right for regular verbs.
 */
export function gerundToPast(word: string): string {
  const w = word.toLowerCase();
  if (!w.endsWith('ing') || w.length < 5) return word;
  const stem = w.slice(0, -3);
  if (IRREGULAR[stem]) return IRREGULAR[stem];
  if (IRREGULAR[stem + 'e']) return IRREGULAR[stem + 'e'];
  if (/[^aeiou]y$/.test(stem)) return stem.slice(0, -1) + 'ied';
  if (stem.endsWith('e')) return stem + 'd';
  return stem + 'ed';
}

const OBJECT_VERBS: [RegExp, string][] = [
  [/campaign|newsletter|email/i, 'Produced'],
  [/event|webinar|conference/i, 'Coordinated'],
  [/report|research|analysis|analyses/i, 'Compiled'],
  [/dashboard|pipeline|model|tool|system|website|site|app/i, 'Built'],
  [/account|client|customer|relationship|vendor/i, 'Managed'],
  [/content|copy|blog|post|article|video/i, 'Created'],
  [/meeting|note|minutes|documentation/i, 'Documented'],
  [/data|entry|record|invoice|order/i, 'Processed'],
  [/presentation|demo|training/i, 'Delivered'],
  [/inventory|stock|shelves|shelf|register|sales/i, 'Handled'],
  [/test|qa|bug|defect/i, 'Tested'],
  [/schedule|calendar|travel/i, 'Organized'],
  [/team|staff|volunteer|intern/i, 'Coordinated'],
];

const SCALE_HINTS: [RegExp, string][] = [
  [/account/i, ' across [[number]] accounts'],
  [/campaign|newsletter|email/i, ' ([[number]] campaigns per month to [[audience size]] recipients)'],
  [/event|webinar/i, ' for [[number]] events with [[attendance]] attendees'],
  [/report|dashboard/i, ' used by [[number]] people'],
  [/customer|client|patient|student/i, ' for [[number]] customers per week'],
  [/website|blog|content|post/i, ' ([[number]] pieces per month)'],
  [/data|record|entry|invoice/i, ' ([[volume]] records per week)'],
  [/team|engineer|people|staff/i, ' across a team of [[number]]'],
  [/sales|revenue|store|register/i, ' ([[amount]] in sales)'],
];

/** Strip openers, swap generic phrases, past-tense the verb, add placeholders for scale and outcome. */
export function rewriteBulletFallback(text: string): string {
  let t = text.trim().replace(/\s+/g, ' ').replace(/[.;]+$/, '');
  const weak = t.match(WEAK_START_RE);
  if (weak) {
    t = t
      .slice(weak[0].length)
      .trim()
      .replace(/^(the|a|an|for|with|in|on|of|to)\s+/i, '')
      // "helped the team with research" -> "research"
      .replace(/^(?:the\s+)?(?:team|manager|managers|department|staff|clients?|customers?|leadership|engineers?|colleagues)\s+(?:with|on|in|by)\s+/i, '')
      .replace(/^(the|a|an)\s+/i, '');
    const first = t.split(' ')[0];
    const firstLower = first.toLowerCase().replace(/[^a-z]/g, '');
    if (/ing$/i.test(first)) {
      t = capitalize(gerundToPast(first)) + t.slice(first.length);
    } else if (!(STRONG_VERBS.has(firstLower) || /ed$/.test(firstLower))) {
      // After "Responsible for" / "Helped with", what remains is an object, not a verb.
      const verb = OBJECT_VERBS.find(([re]) => re.test(t))?.[1] ?? 'Delivered';
      t = `${verb} ${lowerFirst(t)}`;
    }
  } else if (!verbStrength(t)) {
    const first = t.split(' ')[0];
    if (/ing$/i.test(first)) t = capitalize(gerundToPast(first)) + t.slice(first.length);
    else {
      const verb = OBJECT_VERBS.find(([re]) => re.test(t))?.[1] ?? 'Delivered';
      t = `${verb} ${lowerFirst(t)}`;
    }
  }
  t = t.replace(FILLER_RE, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  for (const p of AI_PHRASES) {
    if (!p.re.test(t)) continue;
    const swap = p.swap.split(' / ')[0];
    if (/^(used|led|launched|analyzed|investigated|worked with|combined)$/.test(swap)) {
      t = t.replace(new RegExp(p.re.source, 'gi'), (m) => matchCase(m, swap));
    } else {
      t = t.replace(new RegExp(p.re.source + '\\s*,?\\s*', 'gi'), '').replace(/\s{2,}/g, ' ');
    }
  }
  t = t.replace(/\b(I|my|our|we)\b\s*/g, '').replace(/\s{2,}/g, ' ');
  t = capitalize(t.trim());
  // Existing placeholders count: a [[number]] is a number to fill, a [[result]] is an outcome to fill.
  if (!hasMetric(t, true)) {
    const hint = SCALE_HINTS.find(([re]) => re.test(t))?.[1] ?? ' ([[quantity or scale]])';
    t = t + hint;
  }
  if (!OUTCOME_RE.test(t) && !/\[\[(result|outcome|impact|improv)/i.test(t)) t = t + ', [[result: what improved and by how much]]';
  return t.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',') + '.';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
function matchCase(original: string, replacement: string): string {
  return /^[A-Z]/.test(original) ? capitalize(replacement) : replacement;
}

/** Two lines of fact drawn from the entries, with placeholders for headline numbers. */
export function summaryFallback(doc: ParsedResume, roleLabel: string): string[] {
  const years = yearsOfExperience(doc);
  const exp = doc.entries.filter((e) => e.section === 'experience');
  const title = exp[0]?.title ?? roleLabel;
  const orgs = exp.map((e) => e.org).filter(Boolean).slice(0, 3) as string[];
  const skills = doc.lines
    .filter((l) => l.section === 'skills' && l.kind !== 'heading')
    .flatMap((l) => l.text.split(/[,|•·]/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 30)
    .slice(0, 4);
  const orgList = orgs.length > 1 ? `${orgs.slice(0, -1).join(', ')} and ${orgs[orgs.length - 1]}` : orgs[0];
  const skillList = skills.length > 1 ? `${skills.slice(0, -1).join(', ')} and ${skills[skills.length - 1]}` : skills[0];
  const first = `${title}${years >= 1 ? ` with ${years}+ years` : ''}${orgList ? ` across ${orgList}` : ''}${skillList ? `; hands-on with ${skillList}` : ''}.`;
  const second = `Known for [[one headline result with a number, e.g. "growing newsletter open rate 12 points"]].`;
  return [first, second];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function normalizeDates(dates: string | undefined): string {
  if (!dates) return '[[Mon YYYY – Mon YYYY]]';
  const norm = (tok: string): string => {
    const t = tok.trim();
    if (/present|current|now|today|ongoing/i.test(t)) return 'Present';
    const season = t.match(/(spring|summer|fall|autumn|winter)\s+((?:19|20)\d{2})/i);
    if (season) return `${capitalize(season[1].toLowerCase())} ${season[2]}`;
    const my = t.match(/([a-z]{3,})\.?\s*'?(\d{2,4})/i);
    if (my) {
      const m = MONTHS.find((x) => my[1].toLowerCase().startsWith(x.toLowerCase()));
      const y = my[2].length === 2 ? `20${my[2]}` : my[2];
      return m ? `${m} ${y}` : y;
    }
    const num = t.match(/(\d{1,2})\/(\d{2,4})/);
    if (num) {
      const m = MONTHS[Math.max(0, Math.min(11, parseInt(num[1], 10) - 1))];
      const y = num[2].length === 2 ? `20${num[2]}` : num[2];
      return `${m} ${y}`;
    }
    const y = t.match(/(19|20)\d{2}/);
    return y ? y[0] : t;
  };
  const parts = dates.split(/\s*(?:–|—|-|−|to|until|through|~)\s*/i).filter(Boolean);
  if (parts.length >= 2) return `${norm(parts[0])} – ${norm(parts[parts.length - 1])}`;
  return norm(parts[0] ?? dates);
}

export function entryHeadline(entry: Entry, isEdu: boolean): string {
  const dates = normalizeDates(entry.dates);
  if (isEdu) {
    const bits = [entry.title, entry.org].filter(Boolean).join(' — ');
    return `${bits || '[[Degree — School]]'} | ${dates}`;
  }
  const title = entry.title ?? '[[Job title]]';
  const org = entry.org ?? '[[Employer]]';
  // "Austin TX" -> "Austin, TX"
  const location = entry.location?.replace(/^([A-Za-z. ]+?)\s([A-Z]{2})$/, '$1, $2');
  return [`${title} — ${org}`, location, dates].filter(Boolean).join(' | ');
}
