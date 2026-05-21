import { KbSeed } from './types';

export const deployment: KbSeed[] = [
  {
    category: 'deployment',
    question_variants: ['Is Dalgo a SaaS or self-hosted?'],
    canonical_answer:
      "Self-hosted only — there's no managed SaaS offering in the codebase. Confirm hosted plans with the Dalgo team.",
    status: 'yes',
    evidence: ['No hosted-tier code; Docker-based deployment only'],
    notes_for_sales: 'Confirm hosted plans with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['Can I deploy Dalgo with Docker?'],
    canonical_answer: 'Yes — Docker Compose deployment for the full stack.',
    status: 'yes',
    evidence: ['DDP_backend/Docker/docker-compose.yml'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['Is Dalgo Kubernetes-ready?'],
    canonical_answer:
      'Yes — Kubernetes manifests present for Airbyte; Dalgo services can be K8s-deployed.',
    status: 'yes',
    evidence: ['Dalgo/airbyte/ K8s configs'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['What infrastructure do I need to run Dalgo?'],
    canonical_answer:
      'Postgres, Redis, Airbyte, Prefect Proxy, the Django backend, and the Next.js frontend. Optionally Superset, dbt, S3, Sentry, AWS Secrets Manager.',
    status: 'yes',
    evidence: [
      'Dalgo/CLAUDE.md',
      'DDP_backend/Docker/docker-compose.yml',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['Can I run Dalgo on-premises (no cloud)?'],
    canonical_answer:
      'Yes — Docker / Linux servers can host the full stack without cloud dependencies, though AWS Secrets Manager / SES / S3 are convenient defaults.',
    status: 'yes',
    evidence: ['Self-hosted architecture'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['What dbt versions does Dalgo support?'],
    canonical_answer:
      'dbt 1.8.7, 1.9.8, and 1.10.19 are supported simultaneously.',
    status: 'yes',
    evidence: ['DDP_backend/README.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['What Airbyte version does Dalgo bundle?'],
    canonical_answer:
      'Airbyte 0.58.0 is the supported version. Upgrade path is not yet documented — confirm with the team.',
    status: 'yes',
    evidence: ['DDP_backend/README.md'],
    notes_for_sales: 'Confirm Airbyte upgrade path with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['Can I deploy on AWS / GCP / Azure?'],
    canonical_answer:
      'Yes — Dalgo is cloud-agnostic via Docker, with first-class AWS integrations (S3, SES, Secrets Manager). GCP/Azure usable but require some config tweaks.',
    status: 'yes',
    evidence: ['AWS env vars', 'Docker portability'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'deployment',
    question_variants: ['Does Dalgo work on a small VM, or do I need a big cluster?'],
    canonical_answer:
      'Minimum-spec guidance is not in the repo. Realistically you need ~8GB RAM minimum for the full stack (Postgres + Redis + backend + Airbyte + Prefect + frontend). Confirm with the Dalgo team.',
    status: 'partial',
    evidence: ['Not explicitly documented'],
    notes_for_sales: 'Confirm minimum infrastructure specs with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
];
