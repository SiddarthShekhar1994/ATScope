import type { SectionId } from './types';

/**
 * Heading names an ATS recognises. Anything else that *looks* like a heading is
 * treated as non-standard and classified by the content beneath it.
 */
export const HEADING_MAP: Record<string, SectionId> = {};

const table: Record<SectionId, string[]> = {
  contact: ['contact', 'contact information', 'contact details', 'personal details', 'personal information'],
  summary: [
    'summary',
    'professional summary',
    'career summary',
    'executive summary',
    'profile',
    'professional profile',
    'personal profile',
    'about',
    'about me',
    'objective',
    'career objective',
    'professional objective',
    'overview',
    'career overview',
    'summary of qualifications',
    'qualifications summary',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'employment',
    'employment history',
    'work history',
    'career history',
    'relevant experience',
    'professional background',
    'career experience',
    'professional history',
    'internships',
    'internship experience',
    'research experience',
    'teaching experience',
    'clinical experience',
    'military experience',
  ],
  education: ['education', 'academic background', 'academics', 'education and training', 'educational background', 'education & training', 'academic history', 'academic qualifications', 'training and education'],
  skills: [
    'skills',
    'technical skills',
    'core competencies',
    'competencies',
    'technologies',
    'tech stack',
    'technical proficiencies',
    'areas of expertise',
    'expertise',
    'tools',
    'tools and technologies',
    'tools & technologies',
    'skills and tools',
    'skills & tools',
    'key skills',
    'core skills',
    'technical summary',
    'skills summary',
    'professional skills',
    'technical expertise',
    'skills and abilities',
    'software',
    'programming languages',
    'languages and tools',
    'technical competencies',
    'skills and interests',
  ],
  projects: ['projects', 'personal projects', 'selected projects', 'key projects', 'academic projects', 'side projects', 'portfolio', 'technical projects', 'relevant projects', 'project experience'],
  certifications: ['certifications', 'certificates', 'licenses', 'licenses and certifications', 'licenses & certifications', 'certifications and licenses', 'certifications & licenses', 'professional certifications', 'credentials', 'certification', 'professional development', 'training'],
  awards: ['awards', 'honors', 'honours', 'honors and awards', 'honors & awards', 'awards and honors', 'awards & honors', 'achievements', 'accomplishments', 'recognition', 'awards and recognition', 'key achievements', 'scholarships'],
  publications: ['publications', 'papers', 'research', 'presentations', 'talks', 'conferences', 'patents', 'publications and presentations'],
  volunteer: ['volunteer', 'volunteering', 'volunteer experience', 'volunteer work', 'community involvement', 'community service', 'leadership', 'activities', 'extracurricular activities', 'leadership and activities', 'leadership & activities', 'extracurriculars', 'affiliations', 'professional affiliations', 'memberships', 'associations'],
  languages: ['languages', 'language skills', 'spoken languages'],
  interests: ['interests', 'hobbies', 'hobbies and interests', 'hobbies & interests', 'personal interests', 'additional information', 'additional', 'other', 'miscellaneous', 'references'],
  other: [],
  unknown: [],
};

for (const [id, names] of Object.entries(table) as [SectionId, string[]][]) {
  for (const n of names) HEADING_MAP[n] = id;
}

export const SECTION_HEADINGS = new Set(Object.keys(HEADING_MAP));

export function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_:|•·\-–—]+$/g, '')
    .replace(/[^a-z&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match a heading line to a section id. Returns undefined for non-standard headings. */
export function matchHeading(text: string): SectionId | undefined {
  const norm = normalizeHeading(text);
  if (!norm) return undefined;
  if (HEADING_MAP[norm]) return HEADING_MAP[norm];
  // "Professional Experience & Internships" -> experience
  for (const [name, id] of Object.entries(HEADING_MAP)) {
    if (name.length >= 6 && norm.length <= name.length + 14 && (norm.startsWith(name + ' ') || norm.endsWith(' ' + name))) return id;
  }
  return undefined;
}

export const STANDARD_LABEL: Record<SectionId, string> = {
  contact: 'Contact',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  awards: 'Awards',
  publications: 'Publications',
  volunteer: 'Volunteer Experience',
  languages: 'Languages',
  interests: 'Interests',
  other: 'Additional',
  unknown: '',
};
