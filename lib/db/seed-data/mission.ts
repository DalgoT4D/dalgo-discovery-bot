import { KbSeed } from './types';

export const mission: KbSeed[] = [
  {
    category: 'mission',
    question_variants: ['Who builds Dalgo?'],
    canonical_answer:
      'Project Tech4Dev — a social-impact organization focused on building tech for NGOs.',
    status: 'yes',
    evidence: ['Dalgo/CLAUDE.md', 'directory structure'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'mission',
    question_variants: ['Who is Dalgo built for?'],
    canonical_answer:
      'NGOs — specifically M&E officers, program managers, and field coordinators. Many target users are Excel-proficient but not SQL-literate.',
    status: 'yes',
    evidence: ['Dalgo/DALGO_LITE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'mission',
    question_variants: ['What problems does Dalgo solve for NGOs?'],
    canonical_answer:
      'M&E reporting, donor reporting, beneficiary tracking, program performance analysis — replacing manual Excel workflows.',
    status: 'yes',
    evidence: ['Dalgo/DALGO_LITE.md'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'mission',
    question_variants: ['Does Dalgo have reference customers?'],
    canonical_answer:
      'Not listed in the codebase. Ask the Dalgo team for case studies.',
    status: 'partial',
    evidence: ['Not found'],
    notes_for_sales: 'Ask the Dalgo team for case studies and reference customers.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'mission',
    question_variants: ['What does "Dalgo" mean?'],
    canonical_answer:
      'Dalgo stands for "Data Logistics" — moving NGO data through a clean pipeline from source to insight.',
    status: 'yes',
    evidence: ['Project tagline'],
    source_audit_date: '2026-05-21',
  },
];
