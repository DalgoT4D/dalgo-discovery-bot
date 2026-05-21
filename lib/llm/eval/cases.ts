export interface EvalCase {
  id: string;
  message: string;
  expectKbHitContains?: string;
  forbiddenPhrases?: string[];
  expectedStatus?: 'yes' | 'partial' | 'no' | 'roadmap';
  ngoContext?: { ngo_systems?: string; data_types?: string[] };
}

export const evalCases: EvalCase[] = [
  // 10 YES
  { id: 'kobo',     message: 'Can Dalgo connect to KoboToolbox?', expectKbHitContains: 'KoboToolbox', expectedStatus: 'yes' },
  { id: 'commcare', message: 'Does Dalgo work with CommCare?', expectKbHitContains: 'CommCare', expectedStatus: 'yes' },
  { id: 'bigquery', message: 'Can I use BigQuery as the warehouse?', expectKbHitContains: 'BigQuery', expectedStatus: 'yes' },
  { id: 'pivot',    message: 'Can I make a pivot table in Dalgo?', expectKbHitContains: 'pivot', expectedStatus: 'yes' },
  { id: 'public',   message: 'Can I share a dashboard publicly?', expectKbHitContains: 'public', expectedStatus: 'yes' },
  { id: 'pdf',      message: 'Can I export a chart as PDF?', expectKbHitContains: 'PDF', expectedStatus: 'yes' },
  { id: 'roles',    message: 'What user roles does Dalgo support?', expectKbHitContains: 'roles', expectedStatus: 'yes' },
  { id: 'sched',    message: 'Can I schedule pipelines?', expectKbHitContains: 'schedule', expectedStatus: 'yes' },
  { id: 'chat-data',message: 'Can I ask questions about my data in plain English?', expectKbHitContains: 'natural', expectedStatus: 'yes' },
  { id: 'opensrc',  message: 'Is Dalgo open source?', expectKbHitContains: 'open source', expectedStatus: 'yes' },

  // 8 NO
  { id: 'mobile',   message: 'Does Dalgo have a native mobile app?', expectKbHitContains: 'mobile', expectedStatus: 'no',
    forbiddenPhrases: ['iOS app', 'Android app', 'native mobile application'] },
  { id: 'i18n',     message: 'Does Dalgo support Hindi or French in the UI?', expectKbHitContains: 'languages', expectedStatus: 'no' },
  { id: 'whitelabel', message: 'Can I white-label Dalgo with our colors and logo?', expectKbHitContains: 'white-label', expectedStatus: 'no' },
  { id: 'realtime', message: 'Does Dalgo support real-time streaming data?', expectKbHitContains: 'real-time', expectedStatus: 'no' },
  { id: 'anomaly',  message: 'Does Dalgo detect anomalies automatically?', expectKbHitContains: 'anomaly', expectedStatus: 'no' },
  { id: 'aisql',    message: 'Does Dalgo generate SQL from my questions?', expectKbHitContains: 'AI-generated SQL', expectedStatus: 'no' },
  { id: 'sankey',   message: 'Can I make a sankey diagram in Dalgo?', expectKbHitContains: 'scatter', expectedStatus: 'no',
    forbiddenPhrases: ['yes, Dalgo supports sankey'] },
  { id: 'customchart', message: 'Can I add a custom chart type beyond the built-in ones?', expectKbHitContains: 'custom chart', expectedStatus: 'no' },

  // 5 PARTIAL
  { id: 'clickhouse', message: 'Can I add ClickHouse as a source?', expectKbHitContains: 'ClickHouse', expectedStatus: 'partial' },
  { id: 'redshift',   message: 'Does Dalgo support Redshift?', expectKbHitContains: 'Redshift', expectedStatus: 'partial' },
  { id: 'soc2',       message: 'Is Dalgo SOC2 certified?', expectKbHitContains: 'SOC2', expectedStatus: 'partial' },
  { id: 'reverseetl', message: 'Can Dalgo push data back to systems like Salesforce?', expectKbHitContains: 'reverse', expectedStatus: 'partial' },
  { id: 'scheduledemail', message: 'Can I email a report automatically every week?', expectKbHitContains: 'schedule', expectedStatus: 'partial' },

  // 4 Personalization
  { id: 'personalize-kobo', message: 'How would Dalgo fit a small org like ours?',
    ngoContext: { ngo_systems: 'We use KoboToolbox and Excel', data_types: ['Survey/field data'] },
    expectKbHitContains: 'KoboToolbox' },
  { id: 'personalize-bigquery', message: 'Walk me through a typical pipeline for us.',
    ngoContext: { ngo_systems: 'We have BigQuery and Salesforce', data_types: ['Beneficiary records'] },
    expectKbHitContains: 'BigQuery' },
  { id: 'personalize-on-prem', message: 'Can we run Dalgo on our own servers?',
    ngoContext: { ngo_systems: 'We must keep data on-prem due to compliance' },
    expectKbHitContains: 'self-host', expectedStatus: 'yes' },
  { id: 'personalize-budget', message: 'We are a 3-person org with no IT team. Is Dalgo right?',
    expectKbHitContains: 'NGO',
    forbiddenPhrases: ['enterprise license', 'large engineering team required'] },

  // 3 Out-of-scope
  { id: 'oos-pricing', message: 'How much does Looker cost?',
    forbiddenPhrases: ['Looker costs', '$50,000', '$100,000'] },
  { id: 'oos-debug', message: 'Why is my Postgres query slow?', forbiddenPhrases: [] },
  { id: 'oos-personal', message: 'What\'s the meaning of life?', forbiddenPhrases: [] },
];
