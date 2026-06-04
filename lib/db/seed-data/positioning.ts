import { KbSeed } from './types';

// lib/db/seed-data/positioning.ts
//
// The "why Dalgo wins" layer. Sourced from the Dalgo Positioning document
// (Marketing Landscape, June 2026): category, Reasons to Believe (RTBs),
// competitive alternatives, and the two-step narrative.
//
// Editorial rules baked into every entry here:
//   - Primary benefit is BETTER DECISION-MAKING. Lead with decisions and
//     storytelling proof; time saved is a SECONDARY proof point.
//   - House style: NO contrast phrasing ("X, not Y" / "more than X, it is Y").
//   - Competitors are never dismissed. Acknowledge the logic of the
//     alternative, then reframe on risk, timeline, lock-in, or fit.
//   - Never attribute a 3rd-party tool's FEATURES to Dalgo (see the
//     dalgo_vs_3rd_party system prompt). These entries are about
//     POSITIONING and differentiation, not feature claims.
//   - Every proof point is real. RTB facts (Digital Public Good status,
//     DPDP-readiness, ecosystem backers, 600+ connectors) are confirmed by
//     the Dalgo team as of June 2026.

export const positioning: KbSeed[] = [
  // ─── CATEGORY / WHAT DALGO IS ────────────────────────────────────────
  {
    category: 'positioning',
    question_variants: [
      'What is Dalgo?',
      'What kind of product is Dalgo?',
      'How would you describe Dalgo in one line?',
      'Is Dalgo a BI tool?',
      'What category does Dalgo fall into?',
    ],
    canonical_answer:
      'Dalgo is a data insights platform built exclusively for nonprofits. It helps NGO teams move from managing data to owning it — so when a funder report or program review comes up, leaders can lead with data they trust. The core idea: most growing nonprofits are data-rich but insight-poor — they collect across many programs and tools but have no reliable way to consolidate, transform, and act on it. Dalgo closes that gap. The primary benefit is better decision-making; saving time and telling impact stories more easily follow from that.',
    status: 'yes',
    ngo_framing:
      'Lead with the decision/credibility benefit. Mention time-saving as a secondary proof point, never the headline.',
    evidence: [
      'https://projecttech4dev.org/launching-dalgo/',
      'https://projecttech4dev.org/dalgo-2-0-from-pipelines-to-actionable-insights/',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── PRIMARY BENEFIT: DECISIONS (RTB #5) ─────────────────────────────
  {
    category: 'positioning',
    question_variants: [
      'What results has Dalgo delivered?',
      'What outcomes do Dalgo customers see?',
      'What is the proof that Dalgo works?',
      'What difference does Dalgo actually make?',
      'Why do NGOs choose Dalgo?',
    ],
    canonical_answer:
      'The most important outcome is better decisions. STiR Education put it well: "irrespective of the questions that come our way — whether from donors or the government — we\'re now able to focus much more on building the story, rather than spending time working on the data to build that story." SNEHA and Noora adopted Dalgo specifically because they wanted to do more with their data. Time saved follows from this: STiR cut monthly review prep from about a week to roughly an hour; SHOFCO\'s MEL team went from 12+ hours a week of data work to about 2; SHRI reduced weekly data-cleaning from 20+ hours to under one. Across 25+ partner NGOs in India and East Africa, churn has stayed under 10%.',
    status: 'yes',
    ngo_framing:
      'Order matters: decision/storytelling proof first, then time saved, then scale. Never open with the time-savings number.',
    evidence: [
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
    ],
    notes_for_sales:
      'Pranesh (RevOps): "Full uptake and value is seen when you use Better Decision Making as the lever." Confirmed with SNEHA and Noora conversions.',
    source_audit_date: '2026-06-04',
  },

  // ─── RTB #1 + #2: BUILT ONLY FOR NONPROFITS / SECTOR EXPERTS ─────────
  {
    category: 'positioning',
    question_variants: [
      'What makes Dalgo different from other data tools?',
      'Why is Dalgo built specifically for nonprofits?',
      'Is Dalgo just a generic platform repackaged for NGOs?',
      'Why should an NGO pick Dalgo over a mainstream tool?',
      'Does Dalgo understand the nonprofit sector?',
    ],
    canonical_answer:
      'Dalgo was built for nonprofits from origin to roadmap, co-designed with them, priced for them, and run by people fluent in M&E, log frames, and funder reporting. It began inside Project Tech4Dev\'s Fractional CxO program in 2022 from a pattern seen across many NGOs, and reached v1.0 in September 2023 co-built with partners like SNEHA, STiR, SHRI, Dost Education, and Antarang. It ships native connectors for tools mainstream platforms ignore — SurveyCTO, CommCare, Kobo, Avni, Glific — and geospatial and field-level reporting features designed for how NGOs actually work. The nonprofit specificity is the product itself: connectors, interface logic, the pricing model, and the community are designed around social-sector realities rather than configured after the fact.',
    status: 'yes',
    ngo_framing:
      'Frame around the org\'s actual sources and M&E setup. Avoid "X not Y" phrasing — state what Dalgo is built around.',
    evidence: [
      'https://projecttech4dev.org/launching-dalgo/',
      'https://projecttech4dev.org/dalgo-product-roadmap/',
      'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── RTB #3 + #6: DATA OWNERSHIP, DPG, ECOSYSTEM ─────────────────────
  {
    category: 'positioning',
    question_variants: [
      'Is Dalgo a Digital Public Good?',
      'Who backs or funds Dalgo?',
      'Is Dalgo open-source?',
      'Can I trust Dalgo with our data?',
      'Who is behind Dalgo and is it credible?',
      'Is Dalgo DPDP compliant?',
    ],
    canonical_answer:
      'Your data stays yours. It lives in your own warehouse, the code is open-source, and Dalgo is recognised as a Digital Public Good by the Digital Public Goods Alliance (the UN-endorsed registry). DPDP-readiness is in progress. Dalgo is built and maintained by Project Tech4Dev, with ecosystem support from the Agency Fund, Goalkeep, and Dasra, and it serves 25+ NGO partners across India and East Africa. Because the underlying components are open-source, your data and transformations stay portable rather than locked to a single vendor.',
    status: 'yes',
    ngo_framing:
      'For data-security or funder-due-diligence questions, lead with "your data stays in your warehouse" and the DPG recognition.',
    evidence: [
      'Digital Public Goods Alliance registry',
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
      'https://dalgot4d.github.io/dalgo_docs/',
    ],
    notes_for_sales:
      'DPDP-readiness is in progress, not certified. SOC2/GDPR/ISO certification status should still be confirmed with the team (see security category).',
    source_audit_date: '2026-06-04',
  },

  // ─── COMPETITIVE: COMMERCIAL BI (Power BI / Tableau / Looker) ────────
  {
    category: 'positioning',
    question_variants: [
      'How is Dalgo different from Power BI?',
      'Why not just use Tableau or Looker?',
      'We already considered Power BI — why Dalgo?',
      'Dalgo vs commercial BI tools',
      'Is Dalgo better than Power BI for an NGO?',
    ],
    canonical_answer:
      'Commercial BI tools like Power BI, Tableau, and Looker are powerful and widely adopted, with large ecosystems — a reasonable choice for an org with IT infrastructure or corporate backing. The friction for nonprofits is three-fold: they price per seat or per row, which penalises an NGO for extending access to more field and program staff; they aren\'t designed for nonprofit data sources like Kobo, CommCare, or SurveyCTO; and they typically need data engineers, with M&E conventions and log frames retrofitted on top. AKRSP found Power BI cost-prohibitive once multiple users needed access. Dalgo is priced and built around those nonprofit realities, and your team works with finished dashboards rather than building the pipeline underneath. If your team already loves Power BI or Tableau, you can also point it at your Dalgo warehouse and keep using it.',
    status: 'yes',
    ngo_framing:
      'Acknowledge the tool\'s real strengths first. Reframe on per-seat pricing, NGO-source fit, and engineering overhead. Never claim a BI tool\'s features are Dalgo\'s.',
    evidence: [
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
    ],
    notes_for_sales:
      'AKRSP (Arghyam) pain point: "Power BI proved to be cost-prohibitive for multiple users accessing the visualization."',
    source_audit_date: '2026-06-04',
  },

  // ─── COMPETITIVE: CUSTOM MIS (Dhwani and similar) ────────────────────
  {
    category: 'positioning',
    question_variants: [
      'How is Dalgo different from a custom MIS?',
      'We are considering building a custom MIS — why Dalgo?',
      'Dalgo vs Dhwani',
      'Should we build our own system instead of using Dalgo?',
      'Why not get a bespoke system built for us?',
    ],
    canonical_answer:
      'A custom MIS (from a vendor like Dhwani, for example) has real appeal: one system can replace several subscriptions, reduce recurring overhead, and the org owns the build. That logic holds, especially for large orgs consolidating many internal systems. The trade-offs to weigh are timeline, cost, and dependence: a bespoke build often takes 6–18 months before it delivers value, carries a high upfront cost, and every later requirement change goes through a development cycle. There\'s usually no community or peer learning, no maintained connectors for nonprofit-specific tools, and the org ends up dependent on the vendor\'s roadmap and availability — which can replace convenience with lock-in. Dalgo is a maintained SaaS platform: value lands in weeks rather than quarters, connectors are kept current for you, and you stay on open-source components your data can leave with.',
    status: 'yes',
    ngo_framing:
      'Per house anti-pattern: never call a custom MIS a "bad choice". Validate the logic ("one system, lower ongoing overhead"), then reframe on timeline, change-cost, and lock-in.',
    evidence: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
    notes_for_sales:
      'TRIF moved to a Dhwani custom MIS citing the complexity of managing multiple tools. Live competitive situation — handle with acknowledge-then-reframe.',
    source_audit_date: '2026-06-04',
  },

  // ─── COMPETITIVE: ZOHO-BASED (EdZola and similar) ────────────────────
  {
    category: 'positioning',
    question_variants: [
      'How is Dalgo different from a Zoho-based setup?',
      'We use Zoho Creator and Zoho Analytics — why Dalgo?',
      'Dalgo vs EdZola',
      'Why move off Zoho for our data?',
      'Is Zoho enough for our M&E reporting?',
    ],
    canonical_answer:
      'Zoho-based implementations (often via partners like EdZola) have a low entry cost — Zoho grants heavily subsidise setup — with familiar branding and a fast path for simple use cases. Where they tend to hit a ceiling is scale and insight: Zoho Creator slows with large datasets and multiple programs, dashboards stay fairly rudimentary, and Zoho Analytics lacks the nonprofit-specific connectors and field-first design NGOs need. It serves basic reporting well; M&E decision-making is where it gets thin. Bhumi is a live example — they built Zoho Creator apps for collection and basic dashboards, and are now migrating to Dalgo for scalable warehousing and proper analytics.',
    status: 'yes',
    ngo_framing:
      'Acknowledge Zoho\'s low cost and speed for simple cases. Reframe on scalability ceiling and the weak insights layer.',
    evidence: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
    notes_for_sales:
      'EdZola is targeting the same bootcamp cohorts Dalgo targets (ILSS DTSI) — a live, emerging competitive threat. Bhumi is migrating from Zoho Creator to Dalgo.',
    source_audit_date: '2026-06-04',
  },

  // ─── COMPETITIVE: DIY SHEETS / LOOKER STUDIO ─────────────────────────
  {
    category: 'positioning',
    question_variants: [
      'Why not just use Google Sheets and Looker Studio?',
      'We manage everything in spreadsheets — do we need Dalgo?',
      'Dalgo vs DIY spreadsheets',
      'Can we keep doing this manually instead?',
      'Is a free Sheets-based setup good enough?',
    ],
    canonical_answer:
      'A do-it-yourself stack of Google Sheets, Looker Studio, and manual consolidation is free, familiar, and has no vendor dependency — which is why budget-constrained and early-stage orgs start there. It tends to break in predictable ways as you grow: it doesn\'t scale much past two programs, cleaning and formatting can consume 40–50% of M&E bandwidth, leadership and field staff have no reliable real-time view, and small data-quality errors compound over time into numbers a funder can question. Sheets became slow for orgs like The Apprentice Project and Bhumi once records grew, so more sheets were created and tracking got harder. Dalgo automates the consolidation and cleaning so that bandwidth goes back to analysis and decisions.',
    status: 'yes',
    ngo_framing:
      'Validate that Sheets is a sensible start. Reframe on the scaling wall and the hidden cost of manual cleaning.',
    evidence: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
    notes_for_sales:
      'Pain point language (Market Landscaping): "Sheets became slow when records increased. Hence, more sheets were created which made it difficult to keep track." — The Apprentice Project, Goonj, Bhumi.',
    source_audit_date: '2026-06-04',
  },

  // ─── TWO-STEP NARRATIVE / WHAT DALGO DOES END TO END ─────────────────
  {
    category: 'positioning',
    question_variants: [
      'How does Dalgo actually help end to end?',
      'What is the journey with Dalgo?',
      'How does Dalgo take us from messy data to decisions?',
      'What does working with Dalgo look like?',
    ],
    canonical_answer:
      'Two moves. First, Dalgo automates the chaos: it pulls data from every tool you already use, brings it into one place, and cleans and combines it automatically — so the manual cycle of cleaning, analysing, and building decks disappears. Second, it illuminates the story: clean data becomes shared dashboards, role-based "Impact at a Glance" views, and ready-to-share reports that drive alignment, funder confidence, and faster decisions. The arc is data automation leading to data storytelling leading to data confidence. The 3 steps in practice: Understand (assess your data setup and M&E ambitions — this is where consulting comes in as the onramp), Automate (pipelines run and dashboards go live), and Learn-Act-Share (real-time insights reach the right people and reports are ready before they\'re asked for).',
    status: 'yes',
    ngo_framing:
      'Use Step 1 (Automate) language with M&E/program staff; Step 2 (Illuminate) language with leadership and decision-makers.',
    evidence: [
      'https://projecttech4dev.org/dalgo-2-0-from-pipelines-to-actionable-insights/',
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
    ],
    source_audit_date: '2026-06-04',
  },
];
