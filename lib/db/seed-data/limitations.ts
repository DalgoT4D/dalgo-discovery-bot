import { KbSeed } from './types';

export const limitations: KbSeed[] = [
  {
    category: 'limitations',
    question_variants: ['Does Dalgo have a managed hosted offering?'],
    canonical_answer:
      'Not found in code — self-hosted only. Hosted plans — confirm with sales.',
    status: 'no',
    evidence: ['No hosted-tier code'],
    notes_for_sales: 'Confirm hosted plans with sales.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ['Does Dalgo have a mobile app?'],
    canonical_answer:
      "Web-only. Dashboards are mobile-responsive but there's no native iOS/Android app.",
    status: 'no',
    evidence: ['Not found in repo'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ['Does Dalgo support multiple languages (i18n)?'],
    canonical_answer: 'English-only. No i18n framework in the frontend.',
    status: 'no',
    evidence: ['Not found in webapp_v2'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ["Can I white-label Dalgo with my NGO's logo and colors?"],
    canonical_answer:
      'Not in v2 — Dalgo branding is fixed. Possible via the open-source license + custom build.',
    status: 'no',
    evidence: ['Hardcoded Tailwind colors; no theme switcher'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ['Does Dalgo have real-time / streaming data support?'],
    canonical_answer:
      'Not natively. Pipelines are scheduled (cron) or webhook-triggered.',
    status: 'no',
    evidence: ['Prefect-based orchestration'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ['Does Dalgo do data alerts or anomaly detection?'],
    canonical_answer:
      'Not natively — covered by dbt tests + Elementary, but no dedicated alerting feature.',
    status: 'no',
    evidence: ['Not found'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ['Is Dalgo Lite available?'],
    canonical_answer:
      'A simplified UI for non-SQL M&E officers is in the planning/research phase (per Dalgo Lite docs, January 2025). Not yet shipped.',
    status: 'roadmap',
    evidence: ['Dalgo/DALGO_LITE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'limitations',
    question_variants: ['Does Dalgo support custom chart types beyond the built-in 6?'],
    canonical_answer:
      'Dalgo Native ships 6 chart types: bar, line, pie, number/KPI card, table, choropleth map. For other chart types, point a 3rd-party visualization tool at your Dalgo warehouse — common choices include the Superset add-on (₹48,000/year, hosted by Dalgo, 40+ chart types) or Power BI / Looker / Tableau if your team already uses one.',
    status: 'no',
    evidence: ['webapp_v2/components/charts/'],
    source_audit_date: '2026-05-21',
  },
];
