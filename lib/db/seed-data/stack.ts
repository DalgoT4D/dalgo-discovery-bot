import { KbSeed } from './types';

export const stack: KbSeed[] = [
  {
    category: 'stack',
    question_variants: ['What languages are used in Dalgo?'],
    canonical_answer:
      'Python (Django backend, dbt transforms), TypeScript (Next.js frontend), SQL (warehouse + dbt).',
    status: 'yes',
    evidence: ['Dalgo/CLAUDE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'stack',
    question_variants: ['What does my team need to deploy Dalgo?'],
    canonical_answer:
      'A devops/SRE person comfortable with Docker, Postgres, and Linux. Python/Django and React/TypeScript familiarity helps for any customizations.',
    status: 'yes',
    evidence: ['Architecture docs'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'stack',
    question_variants: ['Do I need to know SQL to use Dalgo?'],
    canonical_answer:
      'For dashboards and visual transforms, no — drag-drop covers most cases. For advanced transforms or AI chat-with-data, basic SQL helps. Dalgo Lite (in planning) targets pure no-SQL users.',
    status: 'partial',
    evidence: ['Visual transform UI', 'DALGO_LITE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'stack',
    question_variants: ['What charting library does Dalgo use under the hood?'],
    canonical_answer: 'ECharts is the primary charting library.',
    status: 'yes',
    evidence: ['webapp_v2/components/charts/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'stack',
    question_variants: ['What database does Dalgo run on internally?'],
    canonical_answer:
      'PostgreSQL for application state; Redis as the Celery broker; your chosen warehouse (Postgres/BigQuery/Snowflake) for analytical data.',
    status: 'yes',
    evidence: ['Dalgo/CLAUDE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'stack',
    question_variants: ['Does Dalgo expose a public API?'],
    canonical_answer:
      'Yes — Django Ninja REST API with auto-generated docs at `/api/docs`; plus public-share endpoints for embedding dashboards and chart data.',
    status: 'yes',
    evidence: ['Dalgo/CLAUDE.md', 'ddpui/api/public_api.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'stack',
    question_variants: ['Can I extend Dalgo with custom code?'],
    canonical_answer:
      'Yes — the codebase is open-source. Custom Airbyte connectors, custom dbt macros, custom Prefect tasks, and custom frontend pages are all extensible.',
    status: 'yes',
    evidence: ['Open-source AGPL', 'custom connector support'],
    source_audit_date: '2026-05-21',
  },
];
