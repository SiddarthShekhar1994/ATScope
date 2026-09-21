import type { TargetKeyword } from '../types';
import { lookup } from './dictionary';

export interface RolePreset {
  id: string;
  label: string;
  /** Title fragments used to infer the role from a resume. */
  titles: string[];
  /** term → weight (3 required, 2 expected, 1 nice). */
  keywords: [string, 1 | 2 | 3][];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'software-engineer',
    label: 'Software Engineer',
    titles: ['software engineer', 'software developer', 'swe', 'programmer', 'full stack', 'full-stack', 'fullstack'],
    keywords: [
      ['python', 2], ['java', 2], ['javascript', 2], ['typescript', 2], ['rest api', 3], ['sql', 3], ['git', 3], ['testing', 3], ['ci/cd', 2], ['docker', 2],
      ['aws', 2], ['microservices', 2], ['system design', 2], ['data structures', 2], ['agile', 2], ['code review', 2], ['debugging', 1], ['kubernetes', 1], ['postgresql', 1], ['react', 1],
      ['node.js', 1], ['performance optimization', 1], ['distributed systems', 1], ['cross-functional collaboration', 1], ['documentation', 1], ['monitoring', 1], ['linux', 1],
    ],
  },
  {
    id: 'frontend-engineer',
    label: 'Frontend Engineer',
    titles: ['frontend', 'front-end', 'front end', 'ui engineer', 'web developer'],
    keywords: [
      ['react', 3], ['typescript', 3], ['javascript', 3], ['html', 2], ['css', 2], ['accessibility', 2], ['responsive design', 2], ['web performance', 2], ['testing', 2], ['jest', 1],
      ['next.js', 2], ['rest api', 2], ['graphql', 1], ['design systems', 2], ['git', 2], ['ci/cd', 1], ['webpack', 1], ['tailwind', 1], ['figma', 1], ['agile', 1], ['code review', 1], ['storybook', 1], ['cypress', 1], ['end-to-end testing', 1],
    ],
  },
  {
    id: 'backend-engineer',
    label: 'Backend Engineer',
    titles: ['backend', 'back-end', 'back end', 'platform engineer', 'api engineer', 'server'],
    keywords: [
      ['rest api', 3], ['sql', 3], ['postgresql', 2], ['microservices', 3], ['distributed systems', 2], ['docker', 2], ['kubernetes', 2], ['aws', 2], ['message queues', 2], ['kafka', 1],
      ['caching', 2], ['redis', 1], ['system design', 3], ['testing', 2], ['ci/cd', 2], ['monitoring', 2], ['performance optimization', 2], ['python', 1], ['java', 1], ['go', 1], ['node.js', 1], ['authentication', 1], ['grpc', 1], ['on-call', 1], ['git', 1],
    ],
  },
  {
    id: 'devops-sre',
    label: 'DevOps / SRE',
    titles: ['devops', 'sre', 'site reliability', 'platform', 'infrastructure engineer', 'cloud engineer', 'systems engineer'],
    keywords: [
      ['kubernetes', 3], ['docker', 3], ['terraform', 3], ['ci/cd', 3], ['aws', 3], ['linux', 2], ['monitoring', 3], ['prometheus', 1], ['datadog', 1], ['on-call', 2], ['site reliability', 2], ['infrastructure as code', 2],
      ['bash', 2], ['python', 2], ['networking', 2], ['security', 1], ['ansible', 1], ['github actions', 1], ['jenkins', 1], ['logging', 1], ['azure', 1], ['gcp', 1], ['nginx', 1], ['git', 1], ['performance optimization', 1],
    ],
  },
  {
    id: 'data-scientist',
    label: 'Data Scientist',
    titles: ['data scientist', 'machine learning', 'ml engineer', 'applied scientist', 'research scientist'],
    keywords: [
      ['python', 3], ['machine learning', 3], ['sql', 3], ['statistics', 3], ['pandas', 2], ['scikit-learn', 2], ['a/b testing', 2], ['data visualization', 2], ['deep learning', 2], ['pytorch', 1], ['tensorflow', 1],
      ['nlp', 1], ['spark', 1], ['mlops', 1], ['forecasting', 1], ['data engineering', 1], ['jupyter', 1], ['aws', 1], ['etl', 1], ['communication', 1], ['cross-functional collaboration', 1], ['llms', 1], ['data quality', 1], ['kpis', 1],
    ],
  },
  {
    id: 'data-analyst',
    label: 'Data Analyst',
    titles: ['data analyst', 'business analyst', 'analytics', 'bi analyst', 'business intelligence', 'reporting analyst'],
    keywords: [
      ['sql', 3], ['excel', 3], ['data visualization', 3], ['tableau', 2], ['power bi', 2], ['python', 2], ['statistics', 2], ['a/b testing', 2], ['kpis', 2], ['data analysis', 3], ['data quality', 2],
      ['etl', 1], ['data warehouse', 1], ['forecasting', 1], ['looker', 1], ['r', 1], ['google sheets', 1], ['cross-functional collaboration', 2], ['communication', 1], ['presentations', 1], ['data modeling', 1], ['requirements', 1],
    ],
  },
  {
    id: 'product-manager',
    label: 'Product Manager',
    titles: ['product manager', 'product owner', 'product lead', 'pm', 'group product', 'associate product'],
    keywords: [
      ['product management', 3], ['roadmap', 3], ['user stories', 3], ['go-to-market', 2], ['product analytics', 2], ['a/b testing', 2], ['customer discovery', 2], ['kpis', 3], ['agile', 3], ['cross-functional collaboration', 3],
      ['jira', 1], ['sql', 1], ['data analysis', 2], ['user research', 2], ['prototyping', 1], ['strategic planning', 2], ['presentations', 1], ['market research', 1], ['saas', 1], ['communication', 1], ['prioritization', 1],
    ],
  },
  {
    id: 'ux-designer',
    label: 'UX / Product Designer',
    titles: ['ux designer', 'product designer', 'ui designer', 'ux/ui', 'ui/ux', 'interaction designer', 'visual designer', 'graphic designer'],
    keywords: [
      ['figma', 3], ['ux design', 3], ['ui design', 3], ['user research', 3], ['prototyping', 3], ['design systems', 2], ['interaction design', 2], ['information architecture', 1], ['accessibility', 2], ['a/b testing', 1],
      ['adobe creative suite', 1], ['html', 1], ['css', 1], ['cross-functional collaboration', 2], ['agile', 1], ['presentations', 1], ['branding', 1], ['sketch', 1], ['product analytics', 1], ['usability testing', 2],
    ],
  },
  {
    id: 'marketing-manager',
    label: 'Marketing Manager',
    titles: ['marketing', 'brand manager', 'growth', 'content', 'digital marketing', 'communications'],
    keywords: [
      ['campaign management', 3], ['seo', 2], ['sem', 2], ['content marketing', 3], ['social media', 2], ['email marketing', 2], ['marketing analytics', 3], ['product analytics', 1], ['marketing automation', 2], ['brand management', 2],
      ['market research', 2], ['conversion rate optimization', 2], ['growth marketing', 2], ['budget management', 2], ['crm', 1], ['wordpress', 1], ['event marketing', 1], ['public relations', 1], ['a/b testing', 1], ['kpis', 2], ['cross-functional collaboration', 1], ['presentations', 1], ['project management', 1],
    ],
  },
  {
    id: 'sales-account-executive',
    label: 'Sales / Account Executive',
    titles: ['account executive', 'sales', 'business development', 'bdr', 'sdr', 'account manager'],
    keywords: [
      ['sales', 3], ['quota', 3], ['pipeline management', 3], ['prospecting', 3], ['crm', 3], ['negotiation', 2], ['account management', 2], ['saas', 1], ['presentations', 2], ['customer success', 1],
      ['forecasting', 1], ['kpis', 1], ['cross-functional collaboration', 1], ['communication', 1], ['b2b', 2], ['lead generation', 2], ['closing', 2], ['customer service', 1],
    ],
  },
  {
    id: 'customer-success',
    label: 'Customer Success / Support',
    titles: ['customer success', 'customer support', 'support specialist', 'client success', 'customer service', 'account coordinator'],
    keywords: [
      ['customer success', 3], ['customer service', 3], ['onboarding', 3], ['crm', 2], ['account management', 2], ['saas', 1], ['churn', 2], ['nps', 2], ['communication', 2], ['problem solving', 2],
      ['presentations', 1], ['kpis', 1], ['cross-functional collaboration', 1], ['training delivery', 1], ['zendesk', 1], ['salesforce', 1], ['escalations', 1],
    ],
  },
  {
    id: 'financial-analyst',
    label: 'Financial Analyst',
    titles: ['financial analyst', 'finance', 'fp&a', 'investment', 'accountant', 'controller', 'treasury'],
    keywords: [
      ['financial analysis', 3], ['excel', 3], ['forecasting and budgeting', 3], ['accounting', 2], ['sql', 1], ['power bi', 1], ['tableau', 1], ['kpis', 2], ['erp', 1], ['presentations', 1],
      ['cpa', 1], ['audit', 1], ['data analysis', 2], ['bloomberg', 1], ['python', 1], ['quickbooks', 1], ['accounts payable', 1], ['month-end close', 2], ['variance analysis', 2], ['cross-functional collaboration', 1],
    ],
  },
  {
    id: 'project-manager',
    label: 'Project / Program Manager',
    titles: ['project manager', 'program manager', 'scrum master', 'delivery manager', 'project coordinator', 'pmo'],
    keywords: [
      ['project management', 3], ['agile', 3], ['risk management', 2], ['budget management', 2], ['jira', 2], ['cross-functional collaboration', 3], ['kpis', 2], ['pmp', 1], ['vendor management', 1], ['process improvement', 2],
      ['strategic planning', 1], ['presentations', 1], ['communication', 2], ['scheduling', 1], ['roadmap', 1], ['stakeholder management', 3], ['microsoft office', 1], ['change management', 1], ['requirements', 1],
    ],
  },
  {
    id: 'operations-manager',
    label: 'Operations Manager',
    titles: ['operations', 'ops manager', 'operations coordinator', 'logistics', 'supply chain', 'warehouse'],
    keywords: [
      ['operations', 3], ['process improvement', 3], ['supply chain', 2], ['vendor management', 2], ['budget management', 2], ['kpis', 3], ['erp', 2], ['excel', 2], ['team leadership', 2], ['project management', 2],
      ['quality assurance', 1], ['scheduling', 1], ['data analysis', 1], ['compliance', 1], ['cross-functional collaboration', 1], ['training delivery', 1], ['forecasting', 1], ['inventory management', 2],
    ],
  },
  {
    id: 'hr-recruiter',
    label: 'HR / Recruiter',
    titles: ['recruiter', 'talent', 'human resources', 'hr', 'people operations', 'people ops', 'hrbp'],
    keywords: [
      ['recruiting', 3], ['ats', 2], ['onboarding programs', 2], ['employee relations', 2], ['benefits administration', 1], ['training and development', 1], ['shrm', 1], ['compliance', 1], ['communication', 2], ['kpis', 1],
      ['sourcing', 3], ['interviewing', 2], ['hris', 1], ['linkedin recruiter', 1], ['employer branding', 1], ['cross-functional collaboration', 1], ['presentations', 1],
    ],
  },
  {
    id: 'registered-nurse',
    label: 'Registered Nurse',
    titles: ['nurse', 'rn', 'lpn', 'nursing', 'clinical'],
    keywords: [
      ['patient care', 3], ['ehr', 3], ['rn', 3], ['bls', 2], ['medication administration', 3], ['clinical documentation', 2], ['hipaa', 2], ['care coordination', 2], ['patient education', 2], ['vital signs', 1],
      ['triage', 1], ['infection control', 1], ['communication', 1], ['teamwork', 1], ['time management', 1], ['acute care', 1],
    ],
  },
  {
    id: 'mechanical-engineer',
    label: 'Mechanical Engineer',
    titles: ['mechanical engineer', 'design engineer', 'manufacturing engineer', 'product engineer', 'hardware engineer'],
    keywords: [
      ['cad', 3], ['fea', 2], ['gd&t', 2], ['manufacturing', 3], ['matlab', 1], ['quality assurance', 2], ['prototyping', 2], ['project management', 1], ['plc', 1], ['excel', 1],
      ['python', 1], ['testing', 2], ['documentation', 1], ['cross-functional collaboration', 1], ['thermal analysis', 1], ['tolerance analysis', 1], ['bom', 1], ['dfm', 2],
    ],
  },
  {
    id: 'teacher',
    label: 'Teacher / Educator',
    titles: ['teacher', 'instructor', 'educator', 'professor', 'tutor', 'faculty'],
    keywords: [
      ['curriculum development', 3], ['classroom management', 3], ['lms', 2], ['assessment', 2], ['differentiated instruction', 2], ['communication', 2], ['presentations', 1], ['training delivery', 1], ['data analysis', 1], ['iep', 1],
      ['parent communication', 1], ['google workspace', 1], ['microsoft office', 1], ['teamwork', 1], ['adaptability', 1],
    ],
  },
  {
    id: 'general',
    label: 'General professional',
    titles: [],
    keywords: [
      ['communication', 2], ['project management', 2], ['team leadership', 2], ['data analysis', 2], ['microsoft office', 2], ['excel', 2], ['kpis', 2], ['process improvement', 2], ['cross-functional collaboration', 2], ['problem solving', 1],
      ['customer service', 1], ['presentations', 1], ['budget management', 1], ['training delivery', 1], ['crm', 1], ['time management', 1], ['strategic planning', 1], ['agile', 1],
    ],
  },
];

export function presetById(id: string | undefined): RolePreset {
  return ROLE_PRESETS.find((p) => p.id === id) ?? ROLE_PRESETS[ROLE_PRESETS.length - 1];
}

export function presetKeywords(preset: RolePreset): TargetKeyword[] {
  return preset.keywords.map(([term, weight]) => {
    const e = lookup(term);
    return { term: e?.t ?? term, aliases: e?.a ?? [], weight, category: e?.c ?? 'role' };
  });
}
