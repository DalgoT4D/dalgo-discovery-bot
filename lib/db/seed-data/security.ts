import { KbSeed } from './types';

export const security: KbSeed[] = [
  {
    category: 'security',
    question_variants: ['How does Dalgo authenticate API calls?'],
    canonical_answer: 'JWT tokens via `djangorestframework-simplejwt`.',
    status: 'yes',
    evidence: ['DDP_backend/CLAUDE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Where are secrets stored?'],
    canonical_answer:
      'AWS Secrets Manager in production; local file-based secrets for dev (`DEV_SECRETS_DIR`).',
    status: 'yes',
    evidence: [
      'ddpui/utils/secretsmanager',
      'Prefect Secret Blocks for pipeline credentials',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Is Dalgo SOC2 / GDPR / ISO 27001 certified?'],
    canonical_answer:
      "Not found in the repo. Confirm with the Dalgo team. Self-hosted deployments allow you to inherit your own infrastructure's certifications.",
    status: 'partial',
    evidence: ['Not found'],
    notes_for_sales: 'Confirm SOC2 / GDPR / ISO 27001 certification status with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Does Dalgo encrypt data at rest?'],
    canonical_answer:
      'Depends on the warehouse and Postgres deployment you use. Application-level secrets are encrypted via AWS Secrets Manager / Prefect Secret Blocks.',
    status: 'partial',
    evidence: ['Not enforced at app level'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Does Dalgo handle PII?'],
    canonical_answer:
      'Multi-tenancy isolates orgs. Sentry can be configured to mask PII. No explicit PII-handling guarantees documented — confirm with team.',
    status: 'partial',
    evidence: ['SENTRY_SEND_DEFAULT_PII setting'],
    notes_for_sales: 'Confirm PII handling guarantees with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: [
      'Is Dalgo DPDP compliant?',
      'Is Dalgo ready for India\'s data protection law?',
      'Is Dalgo a Digital Public Good?',
      'How does Dalgo handle data privacy and compliance?',
    ],
    canonical_answer:
      'Dalgo is recognised as a Digital Public Good by the Digital Public Goods Alliance (the UN-endorsed registry), it is open-source, and your data stays in your own warehouse. DPDP-readiness (India\'s Digital Personal Data Protection Act) is in progress. Beyond the tool, Dalgo also offers consulting on data-for-decisions and data-for-reporting. Specific certifications such as SOC2, GDPR, or ISO 27001 should be confirmed with the Dalgo team.',
    status: 'partial',
    ngo_framing:
      'Lead with "your data stays in your warehouse" and the Digital Public Good recognition; be honest that DPDP-readiness is in progress, not certified.',
    evidence: [
      'Digital Public Goods Alliance registry',
      'AGPL v3 license',
    ],
    notes_for_sales:
      'DPG status and DPDP-readiness-in-progress confirmed by the Dalgo team (June 2026). SOC2/GDPR/ISO certification status still to confirm per question above.',
    source_audit_date: '2026-06-04',
  },
  {
    category: 'security',
    question_variants: ['Is Dalgo open source?'],
    canonical_answer:
      'Yes — AGPL v3 license. If you modify and deploy a derivative, you must disclose source.',
    status: 'yes',
    evidence: ['webapp/LICENSE', 'DDP_backend/LICENSE'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Where is my data stored?'],
    canonical_answer:
      'Wherever you host it. Dalgo is self-hosted, so you control the data residency entirely (your own Postgres, BigQuery, Snowflake, etc.).',
    status: 'yes',
    evidence: ['Self-hosted architecture'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Does Dalgo log audit events?'],
    canonical_answer:
      'Pipeline run history and notification deliveries are tracked. Explicit audit log feature — confirm scope with the Dalgo team.',
    status: 'partial',
    evidence: ['Partial'],
    notes_for_sales: 'Confirm scope of audit logging with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Is there error monitoring built in?'],
    canonical_answer: 'Yes — Sentry integration with configurable PII masking.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/settings.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'security',
    question_variants: ['Does Dalgo require any data to leave my infrastructure?'],
    canonical_answer:
      'With AI features enabled, prompts/data go to your configured LLM provider. AI features are opt-in per org and can be disabled.',
    status: 'partial',
    evidence: ['org_preferences.enable_llm_request'],
    source_audit_date: '2026-05-21',
  },
];
