import { KbSeed } from './types';

// Sourced from https://dalgo.org/pricing/ (audited 2026-05-22) and confirmed
// against public blog references to "no-cost bootcamps" and "reduced if
// external vendor handles onboarding".

export const pricing: KbSeed[] = [
  {
    category: 'pricing',
    question_variants: [
      'How much does Dalgo cost?',
      'What is Dalgo\'s pricing?',
      'What does Dalgo charge per year?',
    ],
    canonical_answer:
      'The base Data Platform plan is **₹2,04,000 per year** (covers ingestion, transformation, orchestration infrastructure, and Dalgo support). It can be paid monthly, quarterly, or annually. Superset (visualisation) is a **separate optional add-on at ₹48,000/year**. Setup/onboarding is **₹2,500/hour** (billed by hour based on NGO needs). GST is applicable on all prices. NGOs that bring an external vendor to handle onboarding/support pay a reduced rate.',
    status: 'yes',
    evidence: ['https://dalgo.org/pricing/'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Is Dalgo free?',
      'Does Dalgo offer a free plan?',
    ],
    canonical_answer:
      'No free plan. The base SaaS cost is ₹2,04,000/year. (The Dalgo source code is open-source under AGPL v3 — you could self-host the open-source DDP stack yourself, but you\'d be responsible for hosting, integrations, and support.) Dalgo Data Confidence Bootcamps are free, but they\'re a 2-day diagnostic, not a free product trial.',
    status: 'no',
    evidence: ['https://dalgo.org/pricing/', 'AGPL v3 license'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Is there a free trial?',
      'Can I try Dalgo before paying?',
    ],
    canonical_answer:
      'No explicit free trial is advertised on the pricing page. The closest equivalent is the 2-day **Dalgo Data Confidence Bootcamp** (no-cost) where you bring your own data to assess fit, or a product sprint as an existing partner. The Dalgo codebase does include a FREE_TRIAL plan type internally, but how (or whether) it\'s offered externally needs to be confirmed with the team.',
    status: 'partial',
    notes_for_sales:
      'Confirm whether a true free trial is currently offered, or whether the bootcamp is the de-facto trial path.',
    evidence: [
      'https://dalgo.org/pricing/',
      'https://projecttech4dev.org/whats-special-about-a-data-bootcamp-for-nonprofits/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Is Dalgo free for NGOs?',
      'Do NGOs get a discount on Dalgo?',
    ],
    canonical_answer:
      'No — Dalgo is built for NGOs but is a paid platform (₹2,04,000/year base). The pricing page does note that pricing is **"reduced if an external vendor provides onboarding/support"** instead of Dalgo\'s in-house consulting team. Bootcamps are no-cost for prospective NGOs.',
    status: 'no',
    notes_for_sales:
      'Confirm the exact discount amount when an external vendor (e.g., Goalkeep) provides onboarding.',
    evidence: ['https://dalgo.org/pricing/'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'What does setup or onboarding cost?',
      'Are there implementation fees?',
    ],
    canonical_answer:
      'Setup is billed at **₹2,500/hour** (GST applicable). Total hours depend on the NGO\'s capabilities and needs. You can also bring an external vendor to handle onboarding, in which case Dalgo\'s base plan price is reduced.',
    status: 'yes',
    evidence: ['https://dalgo.org/pricing/'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Can I pay monthly?',
      'Is Dalgo billed monthly or annual?',
    ],
    canonical_answer:
      'The base ₹2,04,000/year SaaS plan can be paid **monthly, quarterly, or annually**.',
    status: 'yes',
    evidence: ['https://dalgo.org/pricing/'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Is Superset included?',
      'Do I have to pay extra for dashboards?',
    ],
    canonical_answer:
      'Superset is an **optional add-on at ₹48,000/year** if you want Dalgo to host and support it. As of October 2025, Dalgo also ships native charts and dashboards inside the platform itself — for many use cases you may not need Superset at all. You can also bring your own visualisation tool.',
    status: 'partial',
    evidence: [
      'https://dalgo.org/pricing/',
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Is GST applicable on Dalgo pricing?',
      'Are the listed prices inclusive of tax?',
    ],
    canonical_answer:
      'Indian GST is applicable on all listed prices (base plan, Superset add-on, and per-hour setup).',
    status: 'yes',
    evidence: ['https://dalgo.org/pricing/'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Are there pricing tiers or plans?',
      'Is there a Pro or Enterprise tier?',
    ],
    canonical_answer:
      'No — pricing is a single SaaS tier (₹2,04,000/year base) with one optional Superset add-on. There are no Free / Standard / Pro / Enterprise tiers advertised. Differences in service level come from how much onboarding time you buy and whether an external vendor handles delivery.',
    status: 'yes',
    evidence: ['https://dalgo.org/pricing/'],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'pricing',
    question_variants: [
      'Can I use Dalgo commercially?',
      'Can I self-host Dalgo?',
    ],
    canonical_answer:
      'Yes — Dalgo\'s code is open-source under AGPL v3, so you can self-host it. If you modify and offer it as a service to others, AGPL requires you to release your modifications. Most NGOs choose the hosted SaaS instead so they don\'t have to operate Postgres, Redis, Airbyte, Prefect, and dbt themselves.',
    status: 'yes',
    evidence: ['AGPL v3 license', 'DDP_backend/LICENSE'],
    source_audit_date: '2026-05-22',
  },
];
