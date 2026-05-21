import { KbSeed } from './types';

export const transforms: KbSeed[] = [
  {
    category: 'transforms',
    question_variants: ['Can I write dbt models in Dalgo?'],
    canonical_answer:
      'Yes — Dalgo is a dbt-native platform. Create, edit, run, and test dbt models from the UI or via Git.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/ddpdbt/dbt_service.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I make a pivot table in Dalgo?'],
    canonical_answer:
      'Yes — pivot/unpivot is a built-in transform operation in the visual SQL builder.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/operations/pivot.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I do joins between tables?'],
    canonical_answer:
      'Yes — multi-table joins with ON conditions via the visual transform UI.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/operations/joins.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I aggregate data (SUM, COUNT, AVG)?'],
    canonical_answer: 'Yes — GROUP BY with SUM/AVG/COUNT/MIN/MAX is built in.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/operations/aggregate.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I flatten nested JSON from APIs?'],
    canonical_answer:
      'Yes — dedicated `flattenairbyte` operation handles nested JSON from Airbyte sources.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/operations/flattenairbyte.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I write raw SQL for complex transforms?'],
    canonical_answer:
      'Yes — raw SQL is a first-class option in the transform builder.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Does Dalgo support dbt tests?'],
    canonical_answer:
      'Yes — singular and generic dbt tests run via `TASK_DBTTEST` with results visible in the UI.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/ddpdbt/dbt_service.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I see data lineage?'],
    canonical_answer:
      'Yes — dbt lineage via Elementary integration and React Flow visual lineage in the transform canvas.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/ddpdbt/elementary_service.py',
      'webapp_v2/.../FlowEditor',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Does Dalgo integrate with Git?'],
    canonical_answer:
      'Yes — GitHub, GitLab, Bitbucket with personal access token auth. Dalgo can also create/manage Git repos for you.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/ddpdbt/dbt_service.py:update_github_pat_storage()',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I use dbt macros?'],
    canonical_answer:
      'Yes — dbt macros supported, plus a standard macro library shipped by Dalgo.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/assets/packages.yml'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Does Dalgo support dbt seeds for static reference data?'],
    canonical_answer: 'Yes — seeds run via `TASK_DBTSEED`.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/seeds/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Can I view dbt-generated documentation?'],
    canonical_answer:
      'Yes — schema documentation generated via `TASK_DOCSGENERATE`.',
    status: 'yes',
    evidence: ['Task constant in dbt_service'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Does Dalgo connect to dbt Cloud?'],
    canonical_answer:
      'Yes — dbt Cloud jobs can be triggered and monitored from Dalgo.',
    status: 'yes',
    evidence: ['TASK_DBTCLOUD_JOB', 'dbtcloud_creds_block'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'transforms',
    question_variants: ['Does Dalgo support case-when / conditional logic in transforms?'],
    canonical_answer: 'Yes — case-when is a first-class visual operation.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/operations/casewhen.py'],
    source_audit_date: '2026-05-21',
  },
];
