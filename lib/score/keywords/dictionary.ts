/**
 * Skill/keyword dictionary used to recognise terms in job descriptions and
 * resumes. `a` = aliases (all lower-case), `c` = category, `implies` = broader
 * terms this one is evidence for (e.g. Jenkins ⇒ CI/CD). Implications are how
 * the rewriter adds keywords honestly: only terms the document already supports.
 */
export interface DictEntry {
  t: string;
  a?: string[];
  c: string;
  implies?: string[];
}

export const DICTIONARY: DictEntry[] = [
  // Languages
  { t: 'python', c: 'language' },
  { t: 'java', c: 'language' },
  { t: 'javascript', a: ['js', 'ecmascript'], c: 'language' },
  { t: 'typescript', a: ['ts'], c: 'language', implies: ['javascript'] },
  { t: 'go', a: ['golang'], c: 'language' },
  { t: 'rust', c: 'language' },
  { t: 'c++', a: ['cpp'], c: 'language' },
  { t: 'c#', a: ['csharp', 'c sharp'], c: 'language', implies: ['.net'] },
  { t: 'c', c: 'language' },
  { t: 'ruby', c: 'language' },
  { t: 'php', c: 'language' },
  { t: 'swift', c: 'language', implies: ['ios'] },
  { t: 'kotlin', c: 'language', implies: ['android'] },
  { t: 'scala', c: 'language' },
  { t: 'r', c: 'language' },
  { t: 'matlab', c: 'language' },
  { t: 'sql', c: 'data' },
  { t: 'bash', a: ['shell scripting', 'shell'], c: 'language' },
  { t: 'html', a: ['html5'], c: 'frontend' },
  { t: 'css', a: ['css3'], c: 'frontend' },
  { t: 'sass', a: ['scss'], c: 'frontend', implies: ['css'] },
  { t: 'dart', c: 'language', implies: ['flutter'] },
  { t: 'objective-c', a: ['objective c'], c: 'language', implies: ['ios'] },
  { t: 'perl', c: 'language' },
  { t: 'vba', c: 'language', implies: ['excel'] },
  { t: 'graphql', c: 'backend', implies: ['api design'] },
  // Frontend
  { t: 'react', a: ['react.js', 'reactjs'], c: 'frontend', implies: ['javascript', 'frontend'] },
  { t: 'next.js', a: ['nextjs', 'next'], c: 'frontend', implies: ['react'] },
  { t: 'vue', a: ['vue.js', 'vuejs'], c: 'frontend', implies: ['javascript', 'frontend'] },
  { t: 'angular', a: ['angularjs'], c: 'frontend', implies: ['typescript', 'frontend'] },
  { t: 'svelte', c: 'frontend', implies: ['javascript'] },
  { t: 'redux', c: 'frontend', implies: ['react'] },
  { t: 'tailwind', a: ['tailwindcss', 'tailwind css'], c: 'frontend', implies: ['css'] },
  { t: 'webpack', c: 'frontend' },
  { t: 'vite', c: 'frontend' },
  { t: 'jest', c: 'testing', implies: ['unit testing'] },
  { t: 'cypress', c: 'testing', implies: ['end-to-end testing'] },
  { t: 'playwright', c: 'testing', implies: ['end-to-end testing'] },
  { t: 'storybook', c: 'frontend' },
  { t: 'accessibility', a: ['a11y', 'wcag'], c: 'frontend' },
  { t: 'responsive design', a: ['responsive'], c: 'frontend' },
  { t: 'frontend', a: ['front-end', 'front end'], c: 'frontend' },
  { t: 'web performance', a: ['core web vitals', 'lighthouse'], c: 'frontend' },
  // Backend
  { t: 'node.js', a: ['node', 'nodejs'], c: 'backend', implies: ['javascript', 'backend'] },
  { t: 'express', a: ['express.js', 'expressjs'], c: 'backend', implies: ['node.js'] },
  { t: 'django', c: 'backend', implies: ['python', 'backend'] },
  { t: 'flask', c: 'backend', implies: ['python', 'backend'] },
  { t: 'fastapi', c: 'backend', implies: ['python', 'rest api'] },
  { t: 'spring', a: ['spring boot', 'springboot'], c: 'backend', implies: ['java', 'backend'] },
  { t: 'rails', a: ['ruby on rails', 'ror'], c: 'backend', implies: ['ruby', 'backend'] },
  { t: 'laravel', c: 'backend', implies: ['php'] },
  { t: '.net', a: ['dotnet', 'asp.net', '.net core'], c: 'backend', implies: ['c#', 'backend'] },
  { t: 'rest api', a: ['rest', 'restful', 'rest apis', 'restful apis', 'apis'], c: 'backend', implies: ['api design'] },
  { t: 'api design', a: ['api development'], c: 'backend' },
  { t: 'grpc', c: 'backend', implies: ['api design'] },
  { t: 'microservices', a: ['micro-services', 'service-oriented architecture', 'soa'], c: 'backend', implies: ['distributed systems'] },
  { t: 'distributed systems', a: ['distributed', 'distributed computing'], c: 'backend' },
  { t: 'backend', a: ['back-end', 'back end', 'server-side'], c: 'backend' },
  { t: 'websockets', a: ['websocket'], c: 'backend' },
  { t: 'authentication', a: ['oauth', 'oauth2', 'sso', 'saml', 'jwt', 'oidc'], c: 'backend' },
  { t: 'caching', a: ['cache'], c: 'backend' },
  { t: 'message queues', a: ['message queue', 'pub/sub', 'pubsub', 'event-driven', 'event driven'], c: 'backend' },
  { t: 'kafka', a: ['apache kafka'], c: 'data', implies: ['message queues', 'distributed systems'] },
  { t: 'rabbitmq', c: 'backend', implies: ['message queues'] },
  { t: 'system design', a: ['systems design', 'architecture', 'software architecture'], c: 'backend' },
  { t: 'unit testing', a: ['unit tests', 'tdd', 'test-driven development'], c: 'testing', implies: ['testing'] },
  { t: 'testing', a: ['automated testing', 'test automation', 'qa', 'unit tests', 'integration tests', 'test coverage', 'tests'], c: 'testing' },
  { t: 'end-to-end testing', a: ['e2e testing', 'e2e', 'integration testing', 'integration tests'], c: 'testing', implies: ['testing'] },
  { t: 'code review', a: ['code reviews', 'peer review'], c: 'engineering' },
  { t: 'agile', a: ['scrum', 'kanban', 'sprint', 'sprints'], c: 'method' },
  { t: 'git', a: ['github', 'gitlab', 'bitbucket', 'version control'], c: 'engineering' },
  { t: 'object-oriented programming', a: ['oop', 'object oriented'], c: 'engineering' },
  { t: 'data structures', a: ['algorithms', 'data structures and algorithms'], c: 'engineering' },
  { t: 'performance optimization', a: ['performance tuning', 'optimization', 'latency'], c: 'engineering' },
  { t: 'debugging', a: ['troubleshooting', 'root cause analysis'], c: 'engineering' },
  { t: 'documentation', a: ['technical documentation', 'technical writing'], c: 'engineering' },
  { t: 'mentoring', a: ['mentored', 'mentorship', 'coaching'], c: 'leadership' },
  { t: 'technical leadership', a: ['tech lead', 'team lead', 'led a team'], c: 'leadership' },
  { t: 'cross-functional collaboration', a: ['cross-functional', 'cross functional', 'stakeholder management', 'stakeholders'], c: 'soft' },
  { t: 'communication', a: ['communication skills', 'written communication', 'verbal communication'], c: 'soft' },
  { t: 'problem solving', a: ['problem-solving', 'analytical', 'analytical skills'], c: 'soft' },
  // Databases
  { t: 'postgresql', a: ['postgres'], c: 'database', implies: ['sql', 'relational databases'] },
  { t: 'mysql', c: 'database', implies: ['sql', 'relational databases'] },
  { t: 'sql server', a: ['mssql', 'microsoft sql server', 't-sql'], c: 'database', implies: ['sql'] },
  { t: 'oracle', a: ['oracle db', 'pl/sql'], c: 'database', implies: ['sql'] },
  { t: 'sqlite', c: 'database', implies: ['sql'] },
  { t: 'mongodb', a: ['mongo'], c: 'database', implies: ['nosql'] },
  { t: 'dynamodb', c: 'database', implies: ['nosql', 'aws'] },
  { t: 'redis', c: 'database', implies: ['caching'] },
  { t: 'elasticsearch', a: ['elastic', 'opensearch'], c: 'database' },
  { t: 'cassandra', c: 'database', implies: ['nosql'] },
  { t: 'nosql', c: 'database' },
  { t: 'relational databases', a: ['rdbms', 'relational database'], c: 'database', implies: ['sql'] },
  { t: 'data modeling', a: ['data modelling', 'schema design', 'database design'], c: 'data' },
  // Cloud / DevOps
  { t: 'aws', a: ['amazon web services'], c: 'cloud', implies: ['cloud'] },
  { t: 'ec2', c: 'cloud', implies: ['aws'] },
  { t: 's3', c: 'cloud', implies: ['aws'] },
  { t: 'lambda', a: ['aws lambda', 'serverless'], c: 'cloud', implies: ['aws'] },
  { t: 'rds', c: 'cloud', implies: ['aws'] },
  { t: 'ecs', a: ['eks', 'fargate'], c: 'cloud', implies: ['aws', 'docker'] },
  { t: 'sqs', a: ['sns'], c: 'cloud', implies: ['aws', 'message queues'] },
  { t: 'azure', a: ['microsoft azure'], c: 'cloud', implies: ['cloud'] },
  { t: 'gcp', a: ['google cloud', 'google cloud platform'], c: 'cloud', implies: ['cloud'] },
  { t: 'cloud', a: ['cloud computing', 'cloud infrastructure'], c: 'cloud' },
  { t: 'docker', a: ['containers', 'containerization'], c: 'devops' },
  { t: 'kubernetes', a: ['k8s'], c: 'devops', implies: ['docker', 'container orchestration'] },
  { t: 'container orchestration', c: 'devops' },
  { t: 'terraform', c: 'devops', implies: ['infrastructure as code'] },
  { t: 'infrastructure as code', a: ['iac', 'cloudformation', 'pulumi'], c: 'devops' },
  { t: 'ansible', a: ['chef', 'puppet'], c: 'devops', implies: ['configuration management'] },
  { t: 'configuration management', c: 'devops' },
  { t: 'ci/cd', a: ['ci cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'build pipelines', 'deployment pipelines'], c: 'devops' },
  { t: 'jenkins', c: 'devops', implies: ['ci/cd'] },
  { t: 'github actions', c: 'devops', implies: ['ci/cd', 'git'] },
  { t: 'gitlab ci', a: ['gitlab ci/cd'], c: 'devops', implies: ['ci/cd'] },
  { t: 'circleci', c: 'devops', implies: ['ci/cd'] },
  { t: 'linux', a: ['unix'], c: 'devops' },
  { t: 'monitoring', a: ['observability', 'alerting'], c: 'devops' },
  { t: 'datadog', c: 'devops', implies: ['monitoring'] },
  { t: 'prometheus', a: ['grafana'], c: 'devops', implies: ['monitoring'] },
  { t: 'splunk', c: 'devops', implies: ['monitoring', 'logging'] },
  { t: 'logging', a: ['elk', 'log analysis'], c: 'devops' },
  { t: 'on-call', a: ['incident response', 'incident management', 'on call'], c: 'devops' },
  { t: 'site reliability', a: ['sre', 'reliability engineering', 'reliability'], c: 'devops' },
  { t: 'nginx', a: ['apache', 'load balancing', 'load balancer'], c: 'devops' },
  { t: 'networking', a: ['tcp/ip', 'dns', 'vpn', 'firewalls', 'network security'], c: 'devops' },
  { t: 'security', a: ['application security', 'appsec', 'cybersecurity', 'information security', 'infosec'], c: 'security' },
  { t: 'penetration testing', a: ['pen testing', 'pentest', 'vulnerability assessment'], c: 'security', implies: ['security'] },
  { t: 'siem', c: 'security', implies: ['security'] },
  { t: 'compliance', a: ['soc 2', 'soc2', 'iso 27001', 'hipaa', 'gdpr', 'pci'], c: 'security' },
  // Data / ML
  { t: 'pandas', c: 'data', implies: ['python', 'data analysis'] },
  { t: 'numpy', c: 'data', implies: ['python'] },
  { t: 'scikit-learn', a: ['sklearn', 'scikit learn'], c: 'ml', implies: ['machine learning', 'python'] },
  { t: 'tensorflow', c: 'ml', implies: ['deep learning', 'machine learning'] },
  { t: 'pytorch', c: 'ml', implies: ['deep learning', 'machine learning'] },
  { t: 'keras', c: 'ml', implies: ['deep learning'] },
  { t: 'machine learning', a: ['ml', 'predictive modeling', 'predictive models'], c: 'ml' },
  { t: 'deep learning', a: ['neural networks', 'cnn', 'rnn', 'transformers'], c: 'ml', implies: ['machine learning'] },
  { t: 'nlp', a: ['natural language processing'], c: 'ml', implies: ['machine learning'] },
  { t: 'computer vision', a: ['image recognition', 'opencv'], c: 'ml', implies: ['machine learning'] },
  { t: 'llms', a: ['llm', 'large language models', 'generative ai', 'genai', 'gpt', 'rag', 'prompt engineering'], c: 'ml', implies: ['machine learning'] },
  { t: 'mlops', a: ['model deployment', 'model serving', 'mlflow'], c: 'ml' },
  { t: 'statistics', a: ['statistical analysis', 'statistical modeling', 'hypothesis testing', 'regression'], c: 'data' },
  { t: 'a/b testing', a: ['ab testing', 'experimentation', 'experiment design', 'split testing'], c: 'data', implies: ['statistics'] },
  { t: 'data analysis', a: ['data analytics', 'analytics', 'analyzing data'], c: 'data' },
  { t: 'data visualization', a: ['data viz', 'dashboards', 'dashboard', 'visualization', 'reporting'], c: 'data' },
  { t: 'tableau', c: 'data', implies: ['data visualization'] },
  { t: 'power bi', a: ['powerbi'], c: 'data', implies: ['data visualization'] },
  { t: 'looker', a: ['looker studio', 'data studio'], c: 'data', implies: ['data visualization'] },
  { t: 'excel', a: ['microsoft excel', 'spreadsheets', 'pivot tables', 'vlookup'], c: 'data' },
  { t: 'google sheets', c: 'data', implies: ['spreadsheets'] },
  { t: 'spreadsheets', c: 'data' },
  { t: 'etl', a: ['elt', 'data pipelines', 'data pipeline'], c: 'data', implies: ['data engineering'] },
  { t: 'data engineering', c: 'data' },
  { t: 'airflow', a: ['apache airflow', 'dagster', 'prefect'], c: 'data', implies: ['etl'] },
  { t: 'spark', a: ['apache spark', 'pyspark'], c: 'data', implies: ['big data'] },
  { t: 'hadoop', a: ['hive', 'mapreduce'], c: 'data', implies: ['big data'] },
  { t: 'big data', c: 'data' },
  { t: 'data warehouse', a: ['data warehousing', 'snowflake', 'redshift', 'bigquery', 'databricks'], c: 'data' },
  { t: 'dbt', c: 'data', implies: ['sql', 'data warehouse'] },
  { t: 'data quality', a: ['data validation', 'data cleaning', 'data cleansing', 'data governance'], c: 'data' },
  { t: 'jupyter', a: ['notebooks'], c: 'data', implies: ['python'] },
  { t: 'forecasting', a: ['time series', 'demand forecasting'], c: 'data', implies: ['statistics'] },
  { t: 'kpis', a: ['kpi', 'metrics', 'okrs', 'okr'], c: 'business' },
  // Mobile
  { t: 'ios', c: 'mobile', implies: ['mobile'] },
  { t: 'android', c: 'mobile', implies: ['mobile'] },
  { t: 'react native', c: 'mobile', implies: ['react', 'mobile'] },
  { t: 'flutter', c: 'mobile', implies: ['mobile'] },
  { t: 'mobile', a: ['mobile development', 'mobile apps'], c: 'mobile' },
  // Design
  { t: 'figma', c: 'design', implies: ['ui design', 'prototyping'] },
  { t: 'sketch', c: 'design', implies: ['ui design'] },
  { t: 'adobe xd', c: 'design', implies: ['ui design'] },
  { t: 'photoshop', a: ['adobe photoshop'], c: 'design', implies: ['adobe creative suite'] },
  { t: 'illustrator', a: ['adobe illustrator'], c: 'design', implies: ['adobe creative suite'] },
  { t: 'indesign', c: 'design', implies: ['adobe creative suite'] },
  { t: 'adobe creative suite', a: ['creative cloud', 'adobe creative cloud'], c: 'design' },
  { t: 'ui design', a: ['ui', 'user interface', 'interface design', 'visual design'], c: 'design' },
  { t: 'ux design', a: ['ux', 'user experience', 'ux/ui', 'ui/ux'], c: 'design' },
  { t: 'user research', a: ['usability testing', 'user interviews', 'user testing'], c: 'design', implies: ['ux design'] },
  { t: 'prototyping', a: ['prototypes', 'wireframes', 'wireframing', 'mockups'], c: 'design' },
  { t: 'design systems', a: ['design system', 'component library'], c: 'design' },
  { t: 'interaction design', a: ['motion design', 'animation'], c: 'design' },
  { t: 'information architecture', c: 'design' },
  { t: 'canva', c: 'design' },
  { t: 'branding', a: ['brand identity', 'brand guidelines', 'brand'], c: 'marketing' },
  // Product / PM
  { t: 'product management', a: ['product manager', 'product owner'], c: 'product' },
  { t: 'roadmap', a: ['product roadmap', 'roadmapping', 'prioritization'], c: 'product' },
  { t: 'user stories', a: ['requirements', 'requirements gathering', 'prd', 'product requirements', 'specifications'], c: 'product' },
  { t: 'go-to-market', a: ['gtm', 'product launch', 'launches', 'launched'], c: 'product' },
  { t: 'product analytics', a: ['amplitude', 'mixpanel', 'google analytics', 'ga4', 'pendo'], c: 'product', implies: ['marketing analytics', 'data analysis'] },
  { t: 'customer discovery', a: ['customer interviews', 'customer research', 'voice of customer'], c: 'product' },
  { t: 'jira', a: ['confluence', 'asana', 'trello', 'linear', 'monday.com'], c: 'tools' },
  { t: 'project management', a: ['project planning', 'project delivery', 'project coordination'], c: 'method' },
  { t: 'pmp', a: ['prince2', 'capm'], c: 'method', implies: ['project management'] },
  { t: 'budget management', a: ['budgeting', 'budgets', 'p&l', 'cost control'], c: 'business' },
  { t: 'risk management', a: ['risk assessment', 'risk mitigation'], c: 'business' },
  { t: 'vendor management', a: ['vendors', 'procurement', 'supplier management', 'suppliers'], c: 'ops' },
  { t: 'process improvement', a: ['process optimization', 'continuous improvement', 'lean', 'six sigma', 'kaizen'], c: 'ops' },
  { t: 'operations', a: ['operations management', 'business operations'], c: 'ops' },
  { t: 'supply chain', a: ['logistics', 'inventory management', 'inventory', 'warehouse'], c: 'ops' },
  { t: 'erp', a: ['sap', 'oracle erp', 'netsuite', 'workday', 'microsoft dynamics'], c: 'ops' },
  { t: 'crm', a: ['salesforce', 'hubspot', 'zoho', 'pipedrive'], c: 'sales' },
  // Marketing
  { t: 'seo', a: ['search engine optimization', 'organic search'], c: 'marketing' },
  { t: 'sem', a: ['ppc', 'paid search', 'google ads', 'adwords', 'paid media', 'paid social'], c: 'marketing' },
  { t: 'content marketing', a: ['content strategy', 'content creation', 'copywriting', 'blog', 'blogging'], c: 'marketing' },
  { t: 'social media', a: ['social media marketing', 'instagram', 'tiktok', 'linkedin marketing', 'facebook ads', 'meta ads'], c: 'marketing', implies: ['content marketing'] },
  { t: 'email marketing', a: ['email campaigns', 'newsletters', 'mailchimp', 'klaviyo', 'drip campaigns'], c: 'marketing', implies: ['campaign management'] },
  { t: 'marketing automation', a: ['marketo', 'pardot', 'hubspot marketing'], c: 'marketing' },
  { t: 'campaign management', a: ['campaigns', 'marketing campaigns', 'campaign'], c: 'marketing' },
  { t: 'brand management', a: ['brand strategy'], c: 'marketing' },
  { t: 'market research', a: ['competitive analysis', 'competitor analysis', 'market analysis'], c: 'marketing' },
  { t: 'conversion rate optimization', a: ['cro', 'conversion optimization', 'landing pages', 'funnel optimization'], c: 'marketing' },
  { t: 'event marketing', a: ['event planning', 'events', 'webinars', 'trade shows'], c: 'marketing', implies: ['campaign management', 'project management'] },
  { t: 'public relations', a: ['pr', 'media relations', 'press releases', 'press'], c: 'marketing' },
  { t: 'wordpress', a: ['cms', 'content management'], c: 'marketing', implies: ['content marketing'] },
  { t: 'growth marketing', a: ['growth', 'demand generation', 'demand gen', 'lead generation', 'lead gen'], c: 'marketing' },
  { t: 'marketing analytics', a: ['attribution', 'utm', 'roas', 'cac'], c: 'marketing', implies: ['data analysis'] },
  // Sales / CS
  { t: 'sales', a: ['selling', 'b2b sales', 'b2c sales', 'inside sales', 'outside sales'], c: 'sales' },
  { t: 'prospecting', a: ['cold calling', 'cold outreach', 'outbound', 'lead qualification'], c: 'sales' },
  { t: 'pipeline management', a: ['sales pipeline', 'pipeline', 'forecast accuracy'], c: 'sales' },
  { t: 'quota', a: ['quota attainment', 'exceeded quota', 'sales targets', 'targets'], c: 'sales' },
  { t: 'negotiation', a: ['contract negotiation', 'negotiations', 'closing'], c: 'sales' },
  { t: 'account management', a: ['key accounts', 'account growth', 'upsell', 'cross-sell', 'renewals'], c: 'sales' },
  { t: 'customer success', a: ['customer retention', 'churn', 'onboarding', 'nps', 'customer satisfaction', 'csat'], c: 'sales' },
  { t: 'customer service', a: ['customer support', 'client relations', 'client management', 'customer relations'], c: 'sales' },
  { t: 'saas', c: 'sales' },
  { t: 'presentations', a: ['presentation skills', 'public speaking', 'demos', 'product demos'], c: 'soft' },
  // Finance / Accounting
  { t: 'financial analysis', a: ['financial modeling', 'financial modelling', 'valuation', 'dcf'], c: 'finance' },
  { t: 'forecasting and budgeting', a: ['fp&a', 'variance analysis', 'financial planning'], c: 'finance', implies: ['financial analysis'] },
  { t: 'accounting', a: ['gaap', 'ifrs', 'general ledger', 'journal entries', 'month-end close', 'reconciliation', 'reconciliations'], c: 'finance' },
  { t: 'cpa', a: ['cfa', 'cma'], c: 'finance' },
  { t: 'quickbooks', a: ['xero', 'sage', 'netsuite accounting'], c: 'finance', implies: ['accounting'] },
  { t: 'accounts payable', a: ['accounts receivable', 'ap/ar', 'invoicing', 'billing'], c: 'finance', implies: ['accounting'] },
  { t: 'audit', a: ['auditing', 'internal controls', 'sox'], c: 'finance' },
  { t: 'tax', a: ['tax preparation', 'tax compliance'], c: 'finance' },
  { t: 'bloomberg', a: ['capital iq', 'factset'], c: 'finance' },
  // HR / Recruiting
  { t: 'recruiting', a: ['talent acquisition', 'sourcing', 'full-cycle recruiting', 'hiring'], c: 'hr' },
  { t: 'ats', a: ['applicant tracking system', 'greenhouse', 'lever', 'workday recruiting', 'icims'], c: 'hr' },
  { t: 'onboarding programs', a: ['employee onboarding', 'orientation'], c: 'hr' },
  { t: 'employee relations', a: ['performance management', 'employee engagement', 'hr policies'], c: 'hr' },
  { t: 'benefits administration', a: ['payroll', 'compensation', 'hris', 'benefits'], c: 'hr' },
  { t: 'training and development', a: ['learning and development', 'l&d', 'training programs', 'training'], c: 'hr' },
  { t: 'shrm', a: ['phr', 'sphr'], c: 'hr' },
  // Healthcare
  { t: 'patient care', a: ['bedside care', 'patient assessment', 'direct patient care'], c: 'health' },
  { t: 'ehr', a: ['emr', 'epic', 'cerner', 'electronic health records', 'meditech'], c: 'health' },
  { t: 'hipaa', c: 'health', implies: ['compliance'] },
  { t: 'bls', a: ['acls', 'cpr', 'pals'], c: 'health' },
  { t: 'rn', a: ['registered nurse', 'lpn', 'cna', 'bsn'], c: 'health' },
  { t: 'medication administration', a: ['iv therapy', 'medications', 'iv'], c: 'health' },
  { t: 'clinical documentation', a: ['charting'], c: 'health' },
  { t: 'care coordination', a: ['discharge planning', 'case management'], c: 'health' },
  // Education
  { t: 'curriculum development', a: ['lesson planning', 'curriculum design', 'instructional design'], c: 'education' },
  { t: 'classroom management', a: ['differentiated instruction', 'student engagement'], c: 'education' },
  { t: 'lms', a: ['canvas lms', 'blackboard', 'moodle', 'google classroom'], c: 'education' },
  // Mechanical / hardware
  { t: 'cad', a: ['solidworks', 'autocad', 'catia', 'fusion 360', 'creo', 'inventor'], c: 'mech' },
  { t: 'fea', a: ['finite element analysis', 'ansys', 'abaqus'], c: 'mech' },
  { t: 'gd&t', a: ['tolerancing', 'geometric dimensioning'], c: 'mech' },
  { t: 'manufacturing', a: ['cnc', 'machining', 'injection molding', 'dfm', 'design for manufacturing'], c: 'mech' },
  { t: 'plc', a: ['plcs', 'ladder logic', 'scada', 'hmi'], c: 'mech' },
  { t: 'pcb design', a: ['altium', 'kicad', 'eagle', 'schematic capture'], c: 'ee' },
  { t: 'embedded systems', a: ['embedded', 'firmware', 'rtos', 'microcontrollers', 'arm', 'stm32', 'arduino'], c: 'ee' },
  { t: 'matlab/simulink', a: ['simulink'], c: 'mech', implies: ['matlab'] },
  { t: 'quality assurance', a: ['quality control', 'iso 9001', 'root cause', 'capa', 'fmea'], c: 'ops' },
  // Legal / admin / general business
  { t: 'contract management', a: ['contracts', 'contract review', 'contract drafting'], c: 'legal' },
  { t: 'regulatory compliance', a: ['regulatory', 'regulations'], c: 'legal' },
  { t: 'microsoft office', a: ['ms office', 'office 365', 'word', 'powerpoint', 'outlook'], c: 'tools' },
  { t: 'google workspace', a: ['g suite', 'gsuite', 'google docs'], c: 'tools' },
  { t: 'scheduling', a: ['calendar management', 'travel arrangements'], c: 'admin' },
  { t: 'data entry', c: 'admin' },
  { t: 'strategic planning', a: ['strategy', 'business strategy', 'strategic initiatives'], c: 'business' },
  { t: 'team leadership', a: ['leadership', 'led', 'managed a team', 'people management', 'supervised', 'direct reports'], c: 'leadership' },
  { t: 'training delivery', a: ['trained', 'onboarded'], c: 'leadership' },
  { t: 'bilingual', a: ['spanish', 'french', 'mandarin', 'german', 'fluent in'], c: 'soft' },
  { t: 'time management', a: ['multitasking', 'prioritizing', 'organized', 'organizational skills'], c: 'soft' },
  { t: 'attention to detail', a: ['detail-oriented', 'detail oriented', 'accuracy'], c: 'soft' },
  { t: 'adaptability', a: ['fast-paced', 'fast paced', 'flexible'], c: 'soft' },
  { t: 'teamwork', a: ['team player', 'collaboration', 'collaborative', 'collaborated'], c: 'soft' },
];

/** Category weights used when scoring soft skills lower than hard skills in generic contexts. */
export const SOFT_CATEGORIES = new Set(['soft']);

const byTerm = new Map<string, DictEntry>();
const byAlias = new Map<string, DictEntry>();
for (const e of DICTIONARY) {
  byTerm.set(e.t, e);
  for (const a of e.a ?? []) byAlias.set(a, e);
}

export function lookup(term: string): DictEntry | undefined {
  const k = term.toLowerCase().trim();
  return byTerm.get(k) ?? byAlias.get(k);
}

export function canonical(term: string): string {
  return lookup(term)?.t ?? term.toLowerCase().trim();
}

/** All terms that `term` is evidence for (transitively). */
export function impliedBy(term: string): string[] {
  const out = new Set<string>();
  const walk = (t: string, depth: number) => {
    if (depth > 3) return;
    const e = lookup(t);
    for (const i of e?.implies ?? []) {
      if (!out.has(i)) {
        out.add(i);
        walk(i, depth + 1);
      }
    }
  };
  walk(term, 0);
  return [...out];
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex that matches a term or any alias as a whole word/phrase.
 * Handles symbols like "c++", "c#", ".net", "node.js".
 */
/** Short words that only count when written the way the technology is written. */
const CASE_SENSITIVE: Record<string, string[]> = { go: ['Go', 'Golang', 'golang'], r: ['R'], c: ['C'] };

export function termRegex(term: string, aliases: string[] = []): RegExp {
  const sensitive = CASE_SENSITIVE[term.toLowerCase()];
  const list = sensitive ?? [term, ...aliases];
  const forms = list.map((f) => {
    const base = sensitive ? f : f.toLowerCase();
    const esc = escapeRegExp(base).replace(/\\\.js$/, '(?:\\.js|js)?').replace(/ /g, '[\\s-]');
    const startsWord = /^[a-z0-9]/i.test(f);
    const endsWord = /[a-z0-9+#]$/i.test(f);
    const end = /[+#]$/.test(f) ? '(?![a-z0-9+#])' : endsWord ? '(?![a-z0-9+#])' : '';
    return `${startsWord ? '(?<![a-z0-9])' : ''}${esc}${end}`;
  });
  return new RegExp(`(?:${forms.join('|')})`, sensitive ? 'g' : 'gi');
}
