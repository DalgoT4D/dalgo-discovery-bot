import { KbSeed } from './types';

export const mission: KbSeed[] = [
  {
    category: 'mission',
    question_variants: ['Who builds Dalgo?'],
    canonical_answer:
      'Project Tech4Dev — a social-impact organisation that builds tech for NGOs. The Dalgo team is 11 people across engineering, consulting, sales, and marketing as of late 2025. Dalgo v1.0 launched in September 2023 (Vinod conceptualised it; the Tech4Dev product team led the launch).',
    status: 'yes',
    evidence: [
      'Dalgo/CLAUDE.md',
      'https://projecttech4dev.org/launching-dalgo/',
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'mission',
    question_variants: ['Who is Dalgo built for?'],
    canonical_answer:
      'NGOs — specifically M&E officers, program managers, and field coordinators. Many target users are Excel-proficient but not SQL-literate. Dalgo\'s product roadmap explicitly targets "NGO staff with M&E experience but basic or no SQL skills."',
    status: 'yes',
    evidence: [
      'Dalgo/DALGO_LITE.md',
      'https://projecttech4dev.org/dalgo-product-roadmap/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'mission',
    question_variants: ['What problems does Dalgo solve for NGOs?'],
    canonical_answer:
      'M&E reporting, donor reporting, beneficiary tracking, FCRA compliance, program performance analysis — replacing the manual Excel + Google Sheets workflows most NGOs start with. Documented impact across customers: 5x faster monthly reporting (STiR), MEL teams reducing data work from 12+ hrs/week to ~2 hrs/week (SHOFCO), 99% uptime + 20-25 hrs/week saved (SHRI).',
    status: 'yes',
    evidence: [
      'Dalgo/DALGO_LITE.md',
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'mission',
    question_variants: [
      'Does Dalgo have reference customers?',
      'Can I see a customer list?',
    ],
    canonical_answer:
      'Yes — see the case_studies category for the full list and per-NGO outcomes. Public customers include STiR Education, Bhumi, Baala, SNEHA, SHOFCO, Ummeed, SHRI, Antarang, LAHI, Make a Difference, Goonj, Durga India, and more. Total ~25 customers by end of 2025.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
      'https://projecttech4dev.org/last-quarter-at-dalgo-october-december-2025/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'mission',
    question_variants: [
      'Who funds or backs Dalgo?',
      'What ecosystem supports Dalgo?',
      'Is Dalgo a serious, well-supported initiative?',
      'Who are Dalgo\'s partners and funders?',
    ],
    canonical_answer:
      'Dalgo is a Project Tech4Dev initiative, recognised internationally as a Digital Public Good (UN-endorsed registry), with ecosystem support from the Agency Fund, Goalkeep, and Dasra. It serves 25+ NGO partners across India and East Africa, with endorsements from figures like Jacob Hughey (Agency Fund) and Swapneel Rane (Goalkeep). Goalkeep also acts as an implementation partner — Antarang\'s onboarding was delivered through Goalkeep, for example.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
    ],
    notes_for_sales:
      'Ecosystem backers (Agency Fund, Goalkeep, Dasra) and DPG recognition confirmed by the Dalgo team, June 2026.',
    source_audit_date: '2026-06-04',
  },
  {
    category: 'mission',
    question_variants: ['What does "Dalgo" mean?'],
    canonical_answer:
      'Per the original launch blog, "Dalgo" is variously interpreted as "Data from Alpha to Omega", "Data and Algorithm", a nod to Dalgona coffee, or a Star Wars tribute — take your pick. It\'s sometimes also expanded as "Data Logistics" (moving NGO data from source to insight).',
    status: 'yes',
    evidence: ['https://projecttech4dev.org/launching-dalgo/'],
    source_audit_date: '2026-05-22',
  },
];
