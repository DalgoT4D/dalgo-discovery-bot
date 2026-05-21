import { KbSeed } from './types';

export const orchestration: KbSeed[] = [
  {
    category: 'orchestration',
    question_variants: ['Can I schedule data syncs?'],
    canonical_answer:
      'Yes — cron-based daily/hourly/weekly scheduling via Prefect.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/ddpprefect/prefect_service.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can I trigger pipelines manually?'],
    canonical_answer: 'Yes — manual on-demand triggers via UI and API.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/api/pipeline_api.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can external systems trigger Dalgo pipelines via webhook?'],
    canonical_answer:
      'Yes — inbound webhooks supported for triggering pipelines and Airbyte syncs.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/api/webhook_api.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can I chain tasks (run dbt after sync)?'],
    canonical_answer:
      'Yes — task dependencies via `OrgDataFlowv1` and Prefect flows.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/models/org.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can I run custom shell scripts in a pipeline?'],
    canonical_answer:
      'Yes — Prefect shell task type supports arbitrary bash commands.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/ddpprefect/schema.py:PrefectShellTaskSetup'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can I see pipeline logs?'],
    canonical_answer: 'Yes — streaming flow run logs with search.',
    status: 'yes',
    evidence: ['prefect_service.py:get_flow_run_logs()'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Do I get email alerts on failure?'],
    canonical_answer:
      'Yes — email notifications on pipeline success/failure via SES.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/core/notifications/delivery.py:notify_org_managers()',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can pipeline alerts go to Slack?'],
    canonical_answer: 'Yes — Slack notifications supported alongside email.',
    status: 'yes',
    evidence: ['core/notifications/delivery.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can I route different tasks to different compute (e.g., k8s vs EC2)?'],
    canonical_answer:
      'Yes — work queues route tasks to different Prefect work pools.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/models/org.py:queue_config'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'orchestration',
    question_variants: ['Can I see task-level status (running, completed, failed)?'],
    canonical_answer:
      'Yes — per-task state tracking via `PrefectFlowRun` model.',
    status: 'yes',
    evidence: ['PrefectFlowRun model'],
    source_audit_date: '2026-05-21',
  },
];
