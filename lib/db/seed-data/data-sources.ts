import { KbSeed } from './types';

export const dataSources: KbSeed[] = [
  {
    category: 'data_sources',
    question_variants: [
      'Can Dalgo connect to KoboToolbox?',
      'Can I pull KoboToolbox survey data?',
      'Does Dalgo support ODK/Kobo?',
    ],
    canonical_answer:
      "Yes — KoboToolbox is a first-class custom source built by Dalgo on top of Airbyte. Survey responses sync into your warehouse on a schedule.",
    status: 'yes',
    ngo_framing:
      "Most field NGOs collect data via Kobo — Dalgo's native connector saves you from CSV exports.",
    evidence: ['DDP_backend/ddpui/settings.py:AIRBYTE_CUSTOM_SOURCES'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: [
      'Does Dalgo work with CommCare?',
      'Can I sync CommCare case data?',
    ],
    canonical_answer:
      'Yes — CommCare is a Dalgo custom source for syncing case and form data from CommCare HQ.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/settings.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can Dalgo ingest from Avni?'],
    canonical_answer: 'Yes — Avni mobile data collection is a supported custom source.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/settings.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Does Dalgo support SurveyCTO?'],
    canonical_answer: 'Yes — SurveyCTO custom connector available (T4D-built version).',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/settings.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I connect Glific?'],
    canonical_answer: 'Yes — Glific conversation/messaging data has a dedicated connector.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/settings.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Does Dalgo work with greytHR for payroll/HR data?'],
    canonical_answer: 'Yes — greytHR is a Dalgo custom source.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/settings.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can Dalgo connect to ClickHouse as a source?'],
    canonical_answer:
      "Not as a native first-class source, but ClickHouse may be reachable through Airbyte's standard connector library. We can confirm specifics.",
    status: 'partial',
    evidence: ['Not found as custom source. Airbyte ecosystem may include it.'],
    notes_for_sales: 'Confirm ClickHouse availability with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Does Dalgo support PostgreSQL as a data source?'],
    canonical_answer:
      'Yes — via standard Airbyte Postgres connector. Also supported as a warehouse destination.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/ddpairbyte/airbyte_service.py'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I use MySQL?'],
    canonical_answer: 'Yes, via standard Airbyte MySQL connector.',
    status: 'yes',
    evidence: ['Airbyte ecosystem'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I pull Google Sheets data?'],
    canonical_answer: 'Yes — Google Sheets is supported via standard Airbyte.',
    status: 'yes',
    evidence: ['Airbyte ecosystem'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I upload CSVs to Dalgo?'],
    canonical_answer:
      'Yes — CSV files supported via Airbyte and dbt seeds for static lookup data.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/core/dbt_automation/seeds/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I bring my own custom Airbyte connector?'],
    canonical_answer: 'Yes — Dalgo supports custom Airbyte connectors via Docker images.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/ddpairbyte/airbytehelpers.py:add_custom_airbyte_connector()',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['How many data sources does Dalgo support in total?'],
    canonical_answer:
      '6 NGO-specific custom sources (Kobo, CommCare, Avni, SurveyCTO, Glific, greytHR) plus access to all 400+ standard Airbyte connectors.',
    status: 'yes',
    evidence: ['Airbyte 0.58.0 + custom sources in settings'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['What data warehouses does Dalgo support?'],
    canonical_answer:
      'PostgreSQL, BigQuery, and Snowflake are supported as destinations.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/models/org.py:OrgWarehouse'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I use my existing BigQuery warehouse?'],
    canonical_answer: 'Yes — BigQuery is fully supported with configurable location.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/models/org.py:bq_location'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Does Dalgo support Snowflake?'],
    canonical_answer: 'Yes — Snowflake is a supported warehouse destination.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/models/org.py:wtype'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I use my own Postgres database as the warehouse?'],
    canonical_answer:
      'Yes — PostgreSQL is a supported destination with schema-level isolation.',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/models/org.py:OrgWarehouse'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Does Dalgo support Redshift?'],
    canonical_answer:
      'Not natively confirmed. Likely reachable via standard Airbyte destinations. Confirm with the Dalgo team.',
    status: 'partial',
    evidence: ['Not found explicitly'],
    notes_for_sales: 'Confirm Redshift availability with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I sync data on a schedule?'],
    canonical_answer:
      'Yes — Airbyte syncs are scheduled via Prefect (cron-based daily/hourly/weekly).',
    status: 'yes',
    evidence: ['DDP_backend/ddpui/ddpprefect/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Does Dalgo handle schema changes from source systems?'],
    canonical_answer:
      'Yes — Airbyte schema detection plus a dedicated `TASK_AIRBYTE_SCHEMA_UPDATE` task track changes.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/ddpairbyte/airbytehelpers.py',
      'OrgSchemaChange model',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I do incremental syncs?'],
    canonical_answer: 'Yes — full and incremental syncs via Airbyte.',
    status: 'yes',
    evidence: ['Standard Airbyte capability'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'data_sources',
    question_variants: ['Can I push data out to external systems (reverse ETL)?'],
    canonical_answer:
      'Dalgo focuses on ingestion; reverse-ETL would use Airbyte destinations or custom pipelines. Confirm with the Dalgo team for specific destinations.',
    status: 'partial',
    evidence: ['Not found as first-class feature'],
    notes_for_sales: 'Confirm reverse-ETL destination support with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
];
