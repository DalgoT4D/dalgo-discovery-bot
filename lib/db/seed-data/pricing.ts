import { KbSeed } from './types';

export const pricing: KbSeed[] = [
  {
    category: 'pricing',
    question_variants: ['Is Dalgo free?'],
    canonical_answer:
      'The source is open-source under AGPL v3 — free to download and self-host. Hosted/managed pricing, NGO discounts, and support tiers need confirmation from the Dalgo team.',
    status: 'partial',
    evidence: ['LICENSE files'],
    notes_for_sales:
      'Confirm hosted/managed pricing, NGO discounts, and support tiers with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'pricing',
    question_variants: ['Are there paid plans?'],
    canonical_answer:
      'The code includes `OrgPlanType` with FREE_TRIAL and DALGO tiers and feature flags per plan, suggesting commercial offerings exist. Pricing details — confirm with sales.',
    status: 'partial',
    evidence: ['DDP_backend/ddpui/models/org_plans.py'],
    notes_for_sales: 'Confirm pricing details with sales.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'pricing',
    question_variants: ['Is there a free trial?'],
    canonical_answer:
      'Yes — `OrgPlanType.FREE_TRIAL` is a built-in plan type with start/end dates.',
    status: 'yes',
    evidence: ['ddpui/models/org_plans.py:OrgPlanType.FREE_TRIAL'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'pricing',
    question_variants: ['Is Dalgo free for NGOs?'],
    canonical_answer:
      "Dalgo's mission is explicitly to serve NGOs, but NGO-specific pricing isn't in the code. Confirm with the Dalgo team.",
    status: 'partial',
    evidence: ['Mission docs; no pricing logic for NGO eligibility'],
    notes_for_sales: 'Confirm NGO-specific pricing with the Dalgo team.',
    source_audit_date: '2026-05-21',
  },
  {
    category: 'pricing',
    question_variants: ['Can I use Dalgo commercially?'],
    canonical_answer:
      'Yes, under AGPL v3 terms. If you modify and offer it as a service, you must release source modifications.',
    status: 'yes',
    evidence: ['AGPL v3 license'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'pricing',
    question_variants: ['Is Superset included or separate?'],
    canonical_answer:
      'Optional. Plans include a `superset_included` flag, so it appears to be a plan-level feature.',
    status: 'partial',
    evidence: ['OrgPlans:superset_included'],
    source_audit_date: '2026-05-21',
  },
];
