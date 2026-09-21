import type { ParsedResume } from '../../parse/types';
import type { TargetKeyword, KeywordMap, KeywordHit, ScoringContext } from '../types';
import { DICTIONARY, lookup, termRegex, impliedBy, escapeRegExp } from './dictionary';
import { ROLE_PRESETS, presetById, presetKeywords, type RolePreset } from './presets';

const STOP = new Set(
  'a an the and or of to in for with on at by from as is are be we you your our this that will can may must have has including etc into over under across within about their they them it its us who what when where how than then also more most other such any all each per via not no nor but if so do does did done being been was were would should could'.split(' '),
);

/**
 * Pull weighted target keywords from a pasted job description.
 * Deterministic: dictionary terms + capitalised proper nouns + acronyms, weighted by
 * where they appear (title / requirements / repeated).
 */
export function extractFromJd(jd: string): { keywords: TargetKeyword[]; title?: string } {
  const text = jd.replace(/\r/g, '');
  const lower = text.toLowerCase();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = lines.find((l) => l.length < 80 && /engineer|manager|analyst|designer|developer|scientist|specialist|director|lead|coordinator|associate|nurse|consultant|representative|architect|administrator/i.test(l));

  // Sections: anything under a "requirements / qualifications / must have" heading is weight 3.
  const reqIdx = lines.findIndex((l) => /^(requirements|qualifications|what you.ll need|what we.re looking for|minimum qualifications|basic qualifications|must have|you have|about you|required skills|skills required)/i.test(l));
  const niceIdx = lines.findIndex((l) => /^(nice to have|preferred|bonus|preferred qualifications|plus|it.s a plus|nice-to-have)/i.test(l));
  const reqText = reqIdx >= 0 ? lines.slice(reqIdx + 1, niceIdx > reqIdx ? niceIdx : reqIdx + 25).join('\n').toLowerCase() : '';
  const niceText = niceIdx >= 0 ? lines.slice(niceIdx + 1, niceIdx + 15).join('\n').toLowerCase() : '';

  const found = new Map<string, TargetKeyword & { hits: number }>();
  const add = (term: string, aliases: string[], hits: number, category: string | undefined, isReq: boolean, isNice: boolean, inTitle: boolean) => {
    const weight: 1 | 2 | 3 = inTitle || isReq ? 3 : isNice ? 1 : hits >= 2 ? 2 : category === 'soft' ? 1 : 2;
    const prev = found.get(term);
    if (prev) {
      prev.weight = Math.max(prev.weight, weight) as 1 | 2 | 3;
      prev.hits += hits;
      return;
    }
    found.set(term, { term, aliases, weight, category, hits });
  };

  for (const e of DICTIONARY) {
    const re = termRegex(e.t, e.a);
    const hits = (text.match(re) ?? []).length;
    if (!hits) continue;
    const reqRe = termRegex(e.t, e.a);
    const isReq = reqText ? reqRe.test(reqText) : false;
    const isNice = niceText ? termRegex(e.t, e.a).test(niceText) && !isReq : false;
    const inTitle = title ? termRegex(e.t, e.a).test(title) : false;
    add(e.t, e.a ?? [], hits, e.c, isReq, isNice, inTitle);
  }

  // Proper nouns / acronyms not in the dictionary (product names, internal tools).
  const acronyms = text.match(/\b[A-Z][A-Z0-9+#.]{1,7}\b/g) ?? [];
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\.[a-z]+|[A-Z][a-z]+)+\b/g) ?? []; // CamelCase like PowerBI, Node.js-ish
  const candidates = [...acronyms, ...properNouns].filter((c) => !STOP.has(c.toLowerCase()) && c.length >= 2 && !/^(AND|OR|THE|US|USA|UK|EU|PM|AM|NYC|LA|SF|DC|ID|OK|NO|YES|TBD|N\/A|PTO|K|M|B)$/.test(c));
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [c, n] of counts) {
    const k = c.toLowerCase();
    if (lookup(k)) continue;
    if (found.has(k)) continue;
    if (n < 1) continue;
    const isReq = reqText.includes(k);
    const isNice = niceText.includes(k) && !isReq;
    add(k, [], n, 'named', isReq, isNice, false);
  }

  // Phrase patterns: "experience with X", "proficiency in X, Y and Z".
  const phraseRe = /(?:experience (?:with|in|using)|proficien(?:t|cy) (?:in|with)|knowledge of|familiarity with|expertise in|background in|skilled in|hands-on with)\s+([^.;\n]{3,80})/gi;
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(text))) {
    const parts = m[1].split(/,|\band\b|\bor\b|\//).map((p) => p.trim().toLowerCase().replace(/^(the|a|an)\s+/, '')).filter((p) => p.length >= 3 && p.length <= 30 && !STOP.has(p));
    for (const p of parts.slice(0, 4)) {
      const e = lookup(p);
      const term = e?.t ?? p;
      if (found.has(term)) {
        found.get(term)!.weight = Math.max(found.get(term)!.weight, 2) as 1 | 2 | 3;
        continue;
      }
      if (!e && p.split(' ').length > 3) continue;
      add(term, e?.a ?? [], 1, e?.c ?? 'phrase', reqText.includes(p), niceText.includes(p), false);
    }
  }

  const keywords = [...found.values()]
    .sort((a, b) => b.weight - a.weight || b.hits - a.hits)
    .slice(0, 40)
    .map(({ term, aliases, weight, category }) => ({ term, aliases, weight, category }));
  void lower;
  return { keywords, title: title?.slice(0, 80) };
}

/** Guess the closest role preset from the resume's job titles and skills. */
export function inferRole(doc: ParsedResume): RolePreset {
  const titleText = [
    ...doc.entries.filter((e) => e.section === 'experience').map((e) => e.title ?? ''),
    ...doc.lines.filter((l) => l.section === 'contact' && l.kind === 'text').map((l) => l.text),
  ]
    .join(' | ')
    .toLowerCase();
  const summaryText = doc.lines
    .filter((l) => l.section === 'summary')
    .map((l) => l.text)
    .join(' ')
    .toLowerCase();
  const skillsText = doc.lines
    .filter((l) => l.section === 'skills' || l.section === 'summary')
    .map((l) => l.text)
    .join(' ')
    .toLowerCase();
  let best: { preset: RolePreset; score: number } | null = null;
  for (const preset of ROLE_PRESETS) {
    if (preset.id === 'general') continue;
    let score = 0;
    // Generic titles ("Software Engineer") are a fallback; specific presets win when their skills show up.
    const titleWeight = preset.id === 'software-engineer' ? 6 : 10;
    for (const t of preset.titles) {
      const re = new RegExp(`(?<![a-z])${escapeRegExp(t)}(?![a-z])`, 'i');
      if (re.test(titleText)) score += t.length > 4 ? titleWeight : 4;
      else if (re.test(summaryText)) score += t.length > 4 ? 6 : 2;
    }
    const kws = presetKeywords(preset);
    for (const k of kws) if (termRegex(k.term, k.aliases).test(skillsText)) score += k.weight;
    if (!best || score > best.score) best = { preset, score };
  }
  if (!best || best.score < 8) return presetById('general');
  return best.preset;
}

export function buildContext(doc: ParsedResume, opts: { jd?: string; roleId?: string }): ScoringContext {
  if (opts.jd && opts.jd.trim().length > 60) {
    const { keywords, title } = extractFromJd(opts.jd);
    if (keywords.length >= 3) {
      return { targetLabel: title ? `JD: ${title}` : 'Pasted job description', targetSource: 'jd', targetKeywords: keywords, jdText: opts.jd, roleId: opts.roleId };
    }
  }
  if (opts.roleId) {
    const p = presetById(opts.roleId);
    return { targetLabel: p.label, targetSource: 'role', roleId: p.id, targetKeywords: presetKeywords(p) };
  }
  const p = inferRole(doc);
  return { targetLabel: p.label, targetSource: 'inferred', roleId: p.id, targetKeywords: presetKeywords(p) };
}

/** Match target keywords against the document and build the keyword map. */
export function matchKeywords(doc: ParsedResume, ctx: ScoringContext): KeywordMap {
  const bodyLines = doc.lines.filter((l) => l.source !== 'header' && l.source !== 'footer' && l.source !== 'textbox');
  const present: KeywordHit[] = [];
  const missing: KeywordMap['missing'] = [];
  const presentTerms = new Set<string>();
  for (const k of ctx.targetKeywords) {
    const re = termRegex(k.term, k.aliases);
    let count = 0;
    const lineRefs: string[] = [];
    let matchedAs = '';
    for (const l of bodyLines) {
      const ms = l.text.match(re);
      if (ms) {
        count += ms.length;
        lineRefs.push(l.id);
        if (!matchedAs) matchedAs = ms[0];
      }
    }
    if (count > 0) {
      present.push({ term: k.term, weight: k.weight, count, lineRefs, matchedAs });
      presentTerms.add(k.term);
    }
  }
  // Terms the document supports through implication (e.g. Jenkins ⇒ CI/CD) but never states.
  const docTerms = new Set<string>();
  const allText = bodyLines.map((l) => l.text).join('\n');
  for (const e of DICTIONARY) if (termRegex(e.t, e.a).test(allText)) docTerms.add(e.t);
  for (const k of ctx.targetKeywords) {
    if (presentTerms.has(k.term)) continue;
    const supportedBy = [...docTerms].filter((t) => impliedBy(t).includes(k.term));
    missing.push({ term: k.term, weight: k.weight, category: k.category, supportedBy: supportedBy.length ? supportedBy : undefined });
  }
  const totalWeight = ctx.targetKeywords.reduce((n, k) => n + k.weight, 0) || 1;
  const gotWeight = present.reduce((n, k) => n + k.weight, 0);
  const jdMatchPercent = Math.round((gotWeight / totalWeight) * 100);

  // Overuse: a target term repeated far beyond what a recruiter tolerates.
  const wordCount = Math.max(50, doc.layout.wordCount);
  const overused: KeywordMap['overused'] = [];
  for (const hit of present) {
    const limit = Math.max(4, Math.round(wordCount / 120));
    if (hit.count > limit) overused.push({ term: hit.term, count: hit.count, lineRefs: hit.lineRefs, limit });
  }
  missing.sort((a, b) => b.weight - a.weight || (b.supportedBy ? 1 : 0) - (a.supportedBy ? 1 : 0));
  return { present, missing, overused, jdMatchPercent, targetLabel: ctx.targetLabel, targetSource: ctx.targetSource };
}
