import { KbSeed } from './types';

export const sharing: KbSeed[] = [
  {
    category: 'sharing',
    question_variants: ['Can I share a dashboard publicly without a login?'],
    canonical_answer:
      'Yes — public dashboard tokens generate read-only shareable URLs.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/api/public_api.py:get_public_dashboard()',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can I export a chart as PNG?'],
    canonical_answer: 'Yes — PNG export via chart export dropdown.',
    status: 'yes',
    evidence: ['webapp_v2/.../ChartExport.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can I export a chart as PDF?'],
    canonical_answer: 'Yes — PDF export supported.',
    status: 'yes',
    evidence: ['webapp_v2/.../ChartExport.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can I download table data as CSV?'],
    canonical_answer:
      'Yes — CSV export from charts and via public chart endpoints.',
    status: 'yes',
    evidence: [
      'ChartExportDropdown.tsx',
      'download_public_chart_data_csv()',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can I create a static report snapshot?'],
    canonical_answer:
      'Yes — frozen point-in-time reports via `CreateSnapshotDialog`.',
    status: 'yes',
    evidence: ['webapp_v2/.../reports/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can I email a report to stakeholders?'],
    canonical_answer: 'Yes — `ShareViaEmailDialog` for reports.',
    status: 'yes',
    evidence: ['webapp_v2/.../ShareViaEmailDialog'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can stakeholders comment on reports?'],
    canonical_answer:
      'Yes — in-dashboard comments with @-mention notifications.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/models/comment.py',
      'core/reports/mention_service.py',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'sharing',
    question_variants: ['Can I schedule reports to be emailed automatically?'],
    canonical_answer:
      'Not found in the frontend; may exist as a backend-only feature. Confirm with the Dalgo team.',
    status: 'partial',
    evidence: ['Not found in webapp_v2'],
    notes_for_sales: 'Confirm scheduled report emailing with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
];
