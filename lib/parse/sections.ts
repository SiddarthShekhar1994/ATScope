import type { ResumeLine, Section, Entry, SectionId, ContactInfo } from './types';
import { matchHeading } from './headings';
import { EMAIL_RE, PHONE_RE, URL_RE, LOCATION_RE, STRICT_LOCATION_RE } from './lines';

const MONTH = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;
const DATE_TOKEN = String.raw`(?:${MONTH}\s*'?\d{2,4}|\d{1,2}\/\d{2,4}|(?:19|20)\d{2}|(?:spring|summer|fall|autumn|winter)\s+(?:19|20)\d{2}|${MONTH}\s+\d{1,2},?\s+\d{4})`;
const END_TOKEN = String.raw`(?:${DATE_TOKEN}|present|current|now|today|ongoing)`;
export const DATE_RANGE_RE = new RegExp(String.raw`(${DATE_TOKEN})\s*(?:–|—|-|−|to|until|through|~)\s*(${END_TOKEN})`, 'i');
export const SINGLE_DATE_RE = new RegExp(String.raw`\b(?:expected|anticipated|graduated|class of)?\s*(${DATE_TOKEN})\b`, 'i');
export const YEAR_RE = /\b(19|20)\d{2}\b/;
export const DEGREE_RE = /\b(bachelor|master|b\.?s\.?c?|b\.?a\.?|m\.?s\.?c?|m\.?a\.?|mba|ph\.?d|m\.?d\.?|j\.?d\.?|associate|diploma|certificate program|b\.?eng|m\.?eng|b\.?tech|m\.?tech|university|college|institute|school of|polytechnic|academy)\b/i;
export const TITLE_WORDS = /\b(engineer|developer|manager|analyst|intern|designer|specialist|associate|director|lead|consultant|coordinator|assistant|nurse|teacher|scientist|architect|administrator|officer|representative|technician|accountant|recruiter|writer|editor|marketer|founder|owner|president|vice president|vp|head of|chief|principal|senior|junior|staff|fellow|researcher|clerk|supervisor|planner|strategist|producer|therapist|pharmacist|physician|attorney|paralegal|agent|advisor|adviser|executive|partner|operator|mechanic|electrician|instructor|professor|tutor|trainer|cashier|server|barista|driver|apprentice)\b/i;
const SEPARATOR_RE = /[|•·]|\s[–—-]\s|,/;

const ENTRY_SECTIONS = new Set<SectionId>(['experience', 'projects', 'volunteer', 'education']);

export function assignSections(lines: ResumeLine[]): { sections: Section[]; entries: Entry[]; contact: ContactInfo } {
  const sections: Section[] = [];
  const state: { current: Section | null } = { current: null };
  const preamble: ResumeLine[] = [];
  let sawHeading = false;

  const openSection = (id: SectionId, title: string, headingLine?: ResumeLine, nonStandard = false) => {
    state.current = { id, title, headingLineId: headingLine?.id, lineIds: [], nonStandardHeading: nonStandard };
    sections.push(state.current);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.source === 'footer' || line.source === 'header' || line.source === 'textbox') {
      line.section = classifyLoose(line);
      continue;
    }
    if (line.kind === 'name' && state.current && state.current.id !== 'contact') {
      // A second column (or a second page) restarting with the name: new contact block.
      openSection('contact', 'Contact');
      line.section = 'contact';
      state.current!.lineIds.push(line.id);
      continue;
    }
    if (line.kind === 'heading') {
      const id = matchHeading(line.text);
      if (id) {
        sawHeading = true;
        openSection(id, line.text, line);
        line.section = id;
        line.sectionTitle = line.text;
        continue;
      }
      const inEntrySection = state.current !== null && ENTRY_SECTIONS.has(state.current.id);
      if (!sawHeading || inEntrySection) {
        // Bold job titles under "Experience", or the headline under the name, are not headings.
        line.kind = 'text';
      } else {
        const inferred = inferSectionFromContent(lines, i);
        if (inferred) {
          openSection(inferred, line.text, line, true);
          line.section = inferred;
          line.sectionTitle = line.text;
          continue;
        }
        line.kind = 'text';
      }
    }
    if (!state.current) {
      preamble.push(line);
      continue;
    }
    line.section = state.current.id;
    line.sectionTitle = state.current.title;
    state.current.lineIds.push(line.id);
  }

  // Lines before the first heading: contact block, then possibly an unlabeled summary.
  if (preamble.length) {
    const contactLines: ResumeLine[] = [];
    const summaryLines: ResumeLine[] = [];
    for (const l of preamble) {
      const words = l.text.split(/\s+/).length;
      if (l.kind === 'name' || l.kind === 'contact' || (words <= 6 && summaryLines.length === 0)) contactLines.push(l);
      else summaryLines.push(l);
    }
    if (contactLines.length) {
      const s: Section = { id: 'contact', title: 'Contact', lineIds: contactLines.map((l) => l.id) };
      sections.unshift(s);
      for (const l of contactLines) {
        l.section = 'contact';
        if (l.kind === 'text' && LOCATION_RE.test(l.text)) l.kind = 'contact';
      }
    }
    if (summaryLines.length) {
      const s: Section = { id: 'summary', title: '(unlabeled summary)', lineIds: summaryLines.map((l) => l.id), nonStandardHeading: true };
      sections.splice(contactLines.length ? 1 : 0, 0, s);
      for (const l of summaryLines) l.section = 'summary';
    }
  }

  const entries = detectEntries(lines, sections);
  const contact = extractContact(lines);
  return { sections, entries, contact };
}

function classifyLoose(line: ResumeLine): SectionId {
  if (EMAIL_RE.test(line.text) || PHONE_RE.test(line.text) || URL_RE.test(line.text)) return 'contact';
  return 'other';
}

function inferSectionFromContent(lines: ResumeLine[], headingIdx: number): SectionId | undefined {
  const heading = lines[headingIdx].text.toLowerCase();
  const next = lines.slice(headingIdx + 1, headingIdx + 9).filter((l) => l.kind !== 'heading');
  if (next.length === 0) return undefined;
  if (/project/.test(heading)) return 'projects';
  if (/skill|tool|tech|compet|stack|proficien/.test(heading)) return 'skills';
  if (/educat|academ|degree|school|universit/.test(heading)) return 'education';
  if (/work|career|experience|employ|journey|history|role|position/.test(heading)) return 'experience';
  if (/summar|profile|about|objective|who i am|intro/.test(heading)) return 'summary';
  if (/award|honor|honour|achiev/.test(heading)) return 'awards';
  if (/cert|licen|credential/.test(heading)) return 'certifications';
  if (/volunt|communit|leadership|activit/.test(heading)) return 'volunteer';
  if (/language/.test(heading)) return 'languages';
  if (/interest|hobb/.test(heading)) return 'interests';
  const hasDates = next.some((l) => DATE_RANGE_RE.test(l.text));
  const hasDegree = next.some((l) => DEGREE_RE.test(l.text));
  if (hasDates && hasDegree) return 'education';
  if (hasDates) return 'experience';
  if (hasDegree) return 'education';
  const shortListy = next.filter((l) => l.text.split(/\s+/).length <= 4 || /,/.test(l.text)).length;
  if (shortListy >= Math.ceil(next.length * 0.6)) return 'skills';
  return 'other';
}

const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function detectEntries(lines: ResumeLine[], sections: Section[]): Entry[] {
  const entries: Entry[] = [];
  const byId = new Map(lines.map((l) => [l.id, l]));
  for (const section of sections) {
    if (!ENTRY_SECTIONS.has(section.id)) continue;
    const sLines = section.lineIds.map((id) => byId.get(id)!).filter(Boolean);
    const isEdu = section.id === 'education';
    const isProj = section.id === 'projects';

    const hasDate = (l: ResumeLine) => DATE_RANGE_RE.test(l.text) || (isEdu && SINGLE_DATE_RE.test(l.text)) || (!isEdu && YEAR_RE.test(l.text) && SEPARATOR_RE.test(l.text) && wc(l.text) <= 12);
    const isStart = (l: ResumeLine, idx: number, insideEntry: boolean): boolean => {
      if (l.kind === 'bullet' || l.kind === 'heading') return false;
      if (wc(l.text) > 14) return false;
      if (hasDate(l)) return true;
      if (isEdu && DEGREE_RE.test(l.text)) return true;
      if (l.font?.bold && wc(l.text) <= 10 && (isProj || TITLE_WORDS.test(l.text) || DEGREE_RE.test(l.text) || !insideEntry)) return true;
      const next = sLines[idx + 1];
      if (next && wc(l.text) <= 8 && next.kind !== 'bullet' && hasDate(next) && !hasDate(l) && !(l.kind === 'text' && insideEntry && wc(l.text) >= 6 && /[.!]$/.test(l.text))) return true;
      return false;
    };

    let cur: Entry | null = null;
    let i = 0;
    while (i < sLines.length) {
      const line = sLines[i];
      if (line.kind === 'bullet') {
        if (cur) {
          cur.bulletLineIds.push(line.id);
          line.entryIndex = entries.length - 1;
        }
        i++;
        continue;
      }
      if (isStart(line, i, cur !== null && cur.bulletLineIds.length === 0)) {
        const header: ResumeLine[] = [line];
        let j = i + 1;
        // Absorb up to two following short lines that complete the header
        // (org, location, dates) but stop at the next entry's title.
        while (j < sLines.length && header.length < 3) {
          const n = sLines[j];
          if (n.kind === 'bullet' || n.kind === 'heading') break;
          if (wc(n.text) > 12) break;
          const headerHasDate = header.some(hasDate);
          const nHasDate = hasDate(n);
          if (headerHasDate && nHasDate) break; // a new dated entry
          const after = sLines[j + 1];
          const nLooksLikeNewTitle = !!n.font?.bold && TITLE_WORDS.test(n.text) && headerHasDate && !nHasDate;
          if (nLooksLikeNewTitle) break;
          const completes =
            nHasDate ||
            STRICT_LOCATION_RE.test(n.text) ||
            (isEdu && (DEGREE_RE.test(n.text) || /university|college|institute|school/i.test(n.text))) ||
            !headerHasDate ||
            (after && after.kind === 'bullet' && !n.font?.bold);
          if (!completes) break;
          header.push(n);
          j++;
        }
        const parsed = parseEntryHeader(header.map((l) => l.text), isEdu);
        cur = {
          id: `E${entries.length + 1}`,
          section: section.id,
          ...parsed,
          headerLineIds: header.map((l) => l.id),
          bulletLineIds: [],
          dateParseable: parsed.startYear !== undefined,
        };
        entries.push(cur);
        for (const h of header) {
          h.kind = 'entry';
          h.entryIndex = entries.length - 1;
        }
        i = j;
        continue;
      }
      if (cur) {
        cur.bulletLineIds.push(line.id);
        line.entryIndex = entries.length - 1;
        if (line.kind === 'text' && wc(line.text) >= 6) line.kind = 'bullet';
      }
      i++;
    }
  }
  return entries;
}

export function parseEntryHeader(texts: string[], isEdu: boolean): Pick<Entry, 'title' | 'org' | 'location' | 'dates' | 'startYear' | 'endYear'> {
  const joined = texts.join(' | ');
  const range = joined.match(DATE_RANGE_RE);
  let dates: string | undefined;
  let startYear: number | undefined;
  let endYear: number | 'present' | undefined;
  if (range) {
    dates = range[0];
    const y1 = range[1].match(/(19|20)\d{2}|'(\d{2})/);
    const y2 = range[2].match(/(19|20)\d{2}|'(\d{2})/);
    startYear = y1 ? toYear(y1[0]) : undefined;
    endYear = /present|current|now|today|ongoing/i.test(range[2]) ? 'present' : y2 ? toYear(y2[0]) : undefined;
  } else {
    const single = joined.match(SINGLE_DATE_RE);
    if (single) {
      dates = single[0].trim();
      const y = single[1].match(/(19|20)\d{2}/);
      if (y) {
        startYear = parseInt(y[0], 10);
        endYear = startYear;
      }
    }
  }
  let rest = dates ? joined.replace(dates, '') : joined;
  let location: string | undefined;
  const loc = rest.match(STRICT_LOCATION_RE);
  if (loc) {
    location = loc[0].replace(/^[,|•·\s–—-]+/, '').trim();
    rest = rest.replace(loc[0], ' ');
  }
  const parts = rest
    .split(/\s*(?:\||•|·|—|–|\s{3,}|\s-\s|,\s|\sat\s|\s@\s)\s*/i)
    .map((p) => p.replace(/^[\s,|\-–—(]+|[\s,|\-–—)]+$/g, '').trim())
    .filter((p) => p.length > 1 && !/^(19|20)\d{2}$/.test(p) && !/^(expected|anticipated|graduated)$/i.test(p));
  let title: string | undefined;
  let org: string | undefined;
  const isSchool = (p: string) => /university|college|institute|school|academy|polytechnic/i.test(p);
  if (isEdu) {
    title = parts.find((p) => DEGREE_RE.test(p) && !isSchool(p)) ?? parts.find((p) => !isSchool(p));
    org = parts.find((p) => isSchool(p)) ?? parts.find((p) => p !== title);
  } else {
    title = parts.find((p) => TITLE_WORDS.test(p));
    org = parts.find((p) => p !== title);
    if (!title) title = parts[0];
    if (org === title) org = parts[1];
  }
  return { title, org, location, dates, startYear, endYear };
}

function toYear(s: string): number {
  if (s.startsWith("'")) return 2000 + parseInt(s.slice(1), 10);
  return parseInt(s, 10);
}

export function extractContact(lines: ResumeLine[]): ContactInfo {
  const info: ContactInfo = { lineRefs: {}, inDroppedRegion: [] };
  const flag = (field: keyof ContactInfo['lineRefs'], line: ResumeLine) => {
    if (info.lineRefs[field]) return;
    info.lineRefs[field] = line.id;
    if (line.source !== 'body' && line.source !== 'table') info.inDroppedRegion.push(field);
  };
  // Prefer body lines so a header copy does not mask a body copy.
  const ordered = [...lines].sort((a, b) => rank(a) - rank(b) || a.index - b.index);
  for (const line of ordered) {
    const t = line.text;
    const email = t.match(EMAIL_RE);
    if (email && !info.email) {
      info.email = email[0];
      flag('email', line);
    }
    const phone = t.match(PHONE_RE);
    if (phone && !info.phone && !/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/.test(phone[0])) {
      info.phone = phone[0].trim();
      flag('phone', line);
    }
    const urls = t.replace(new RegExp(EMAIL_RE.source, 'gi'), '').match(new RegExp(URL_RE.source, 'gi')) ?? [];
    for (const u of urls) {
      if (/linkedin\.com/i.test(u) && !info.linkedin) {
        info.linkedin = u;
        flag('linkedin', line);
      } else if (/github\.com|gitlab\.com/i.test(u) && !info.github) {
        info.github = u;
        flag('github', line);
      } else if (!info.website && !/linkedin|github|gitlab/.test(u)) {
        info.website = u;
        flag('website', line);
      }
    }
    if (!info.location && (line.section === 'contact' || line.kind === 'contact' || line.kind === 'name' || line.index < 6)) {
      const loc = t.match(STRICT_LOCATION_RE) ?? (line.index < 6 || line.section === 'contact' ? t.match(LOCATION_RE) : null);
      if (loc && !TITLE_WORDS.test(loc[0]) && !DEGREE_RE.test(loc[0]) && !/university|college/i.test(loc[0])) {
        info.location = loc[0];
        flag('location', line);
      }
    }
    if (line.kind === 'name' && !info.name) {
      info.name = t;
      flag('name', line);
    }
  }
  if (!info.name) {
    const first = lines.find((l) => l.source === 'body' && l.kind !== 'contact' && l.kind !== 'heading' && !/\d/.test(l.text) && l.text.split(/\s+/).length <= 4);
    if (first && first.index < 4) {
      info.name = first.text;
      info.lineRefs.name = first.id;
      first.kind = 'name';
    }
  }
  return info;
}

function rank(l: ResumeLine): number {
  return l.source === 'body' || l.source === 'table' ? 0 : 1;
}
