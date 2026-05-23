import { KbSeed } from './types';

// Sourced from public Dalgo blog posts at projecttech4dev.org/blogs/?category=dalgo
// and the official 2025 year-in-review. Audited 2026-05-22.

export const caseStudies: KbSeed[] = [
  // ===== Customer roster & numbers =====
  {
    category: 'case_studies',
    question_variants: [
      'Who uses Dalgo?',
      'Which NGOs are Dalgo customers?',
      'Can you give me examples of NGOs using Dalgo?',
    ],
    canonical_answer:
      'By end of 2025, ~25 NGOs use Dalgo. Named customers from public case studies and blog posts include: STiR Education, Bhumi, Baala, Ummeed Child Development Centre, SNEHA, SHOFCO, Make a Difference (MAD), Sanitation and Health Rights in India (SHRI), Durga India, Goonj, Dani Sports Foundation, Noora Health, Antarang, INREM, Lend a Hand India (LAHI), Dost Education, A.T.E. Chandra Foundation (waterbody rejuvenation), and Udhyam.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
      'https://projecttech4dev.org/last-quarter-at-dalgo-october-december-2025/',
      'https://projecttech4dev.org/launching-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: ['How many NGOs use Dalgo?', 'How big is Dalgo\'s customer base?'],
    canonical_answer:
      'About 25 customer NGOs by end of 2025 (up from 17 at the start of 2025). The Dalgo team is 11 people across engineering, consulting, sales, and marketing.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
      'https://projecttech4dev.org/last-quarter-at-dalgo-october-december-2025/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Has Dalgo been used outside India?',
      'Does Dalgo work for NGOs in Africa or other regions?',
      'Can Dalgo work for international NGOs?',
    ],
    canonical_answer:
      'Yes. SHOFCO (Shining Hope for Communities), founded by Kennedy Odede in Kibera, Kenya, runs Dalgo to support 2.4M+ people across Kenyan urban slums — including row-level-security dashboards for caseworkers across Safehouse, WASH, Gender, and Education programs. STiR Education also runs Dalgo across 6 international regions reaching 12+ million children.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },

  // ===== By sector =====
  {
    category: 'case_studies',
    question_variants: ['Does Dalgo work for education NGOs?', 'Has Dalgo been used in education?'],
    canonical_answer:
      'Yes. STiR Education runs Dalgo across 6 regions (12M+ children reached). Bhumi (structured education + civic volunteering, Grade 2 through employment). Lend a Hand India (LAHI) integrates vocational education into 10,000+ government schools reaching 1M+ students with Dalgo. Antarang Foundation supports youth career guidance.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo work for menstrual health, women\'s health, or maternal health NGOs?',
      'Does Dalgo work with sexual and reproductive health programs?',
    ],
    canonical_answer:
      'Yes. Baala (menstrual health across rural and urban India) consolidates Kobo Toolbox forms, Google Sheets, and qualitative focus-group notes into one platform via Dalgo. SNEHA (Society for Nutrition, Education and Health Action) — a 25-year-old NGO in Mumbai/Maharashtra urban informal settlements working on maternal/child health, violence against women, and adolescent well-being — uses Dalgo to get next-day insights instead of monthly offline reports.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
      'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo work for child development or healthcare NGOs?',
      'Has Dalgo been used for clinical or therapy programs?',
    ],
    canonical_answer:
      'Yes. Ummeed Child Development Centre (established 2001) uses Dalgo to integrate previously-siloed Clinical and Training Management Systems. They serve 15,500+ children through 152,000+ clinical sessions, and have trained 11,200 professionals indirectly impacting ~560,000 children. Dalgo built integrated dashboards mapping child journeys across multi-disciplinary services. Make a Difference (MAD, child welfare/orphan support) is also engaged with Dalgo.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
      'https://projecttech4dev.org/a-week-with-mad/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo work for community development or slum-based NGOs?',
    ],
    canonical_answer:
      'Yes. SHOFCO (Shining Hope for Communities), founded 2004 in Kibera, Kenya, reaches 2.4M+ people across urban slums in health, education, WASH, livelihood training, microloans, and community organizing. Goonj (material recycling / community work) is also a Dalgo customer.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/last-quarter-at-dalgo-october-december-2025/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo work for sanitation, water, or WASH NGOs?',
      'Has Dalgo been used by NGOs focused on water and sanitation?',
    ],
    canonical_answer:
      'Yes. Sanitation and Health Rights in India (SHRI) operates 20 community sanitation facilities across Bihar and Jharkhand serving 7,000+ daily users — using Dalgo they now report 99% facility uptime at ₹3.06 ($0.04) per use, and saved 20-25 hours/week of manual data work. INREM (water quality and WASH) was a Dalgo product-sprint partner. A.T.E. Chandra Foundation\'s waterbody rejuvenation project also runs on Dalgo.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
      'https://projecttech4dev.org/waterbody-rejuvenation-project-a-t-e-chandra-foundation/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo work for safety or gender-based-violence NGOs?',
    ],
    canonical_answer:
      'Yes. Durga India — which builds safer, inclusive public spaces in India using Theatre of the Oppressed — attended a Dalgo Bootcamp and is a product-sprint partner, using Dalgo to visualise behaviour-change data from program cohorts.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/from-safety-to-insights-durga-india-at-the-dalgo-bootcamp/',
      'https://projecttech4dev.org/last-quarter-at-dalgo-october-december-2025/',
    ],
    source_audit_date: '2026-05-22',
  },

  // ===== Specific case-study deep dives =====
  {
    category: 'case_studies',
    question_variants: [
      'How did STiR Education use Dalgo?',
      'What did Dalgo do for STiR?',
    ],
    canonical_answer:
      'STiR ran 6 regions with 25,000 records × 100 columns each across fragmented tools (POI Mapper + SurveyCTO for collection; Mammoth, Zoho Analytics, Data Studio for viz). Dalgo unified everything into one platform with self-service per-region dashboards. **Result: 5x reduction in report-prep time — monthly reviews from 1 week → 1 hour, annual reviews from 1 week → 1 day.** M&E team refocused on "strategic data quality improvement" instead of repetitive reporting. Leadership quote: "If Dalgo were to disappear tomorrow, it could actually cause a huge cascading effect across the organization."',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did Bhumi use Dalgo?',
      'What did Dalgo do for Bhumi?',
    ],
    canonical_answer:
      'Bhumi\'s data lived in Excel, Google Sheets, and Zoho Creator — leadership couldn\'t confidently answer "how many students did we impact?" during FCRA renewals. Dalgo auto-pulled from all sources, cleaned/structured, and built Superset dashboards. Field teams kept existing workflows (no change-management burden). Quote: "We have a single source of truth... leading to a stronger culture of being data aware." Programme managers now drill down by school, city, and metric mid-cycle.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did SNEHA use Dalgo?',
      'What did Dalgo do for SNEHA?',
    ],
    canonical_answer:
      'SNEHA\'s M&E unit relied on monthly offline statistical analysis to generate reports — too slow for their fast-moving urban-settlement programs. Dalgo connected their data systems to real-time Apache Superset dashboards. Anindita (SNEHA): "Once we enter the work today, by tomorrow we can already see it reflected. That visibility has brought a lot of meaningful impact to the team." SNEHA records are anonymised before visualisation.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did SHOFCO use Dalgo?',
      'What did Dalgo do for SHOFCO?',
    ],
    canonical_answer:
      'SHOFCO had centralised on CommCare in 2023 but case-workers reverted to "paper records, pinned charts, and ad hoc Google Sheets". They\'d also been running Airbyte–dbt–Power BI on AWS at high cost. Dalgo ingests from CommCare + Google Sheets + APIs (Mobiwater, planned: LMS, Monday.com, Susteq), transforms via dbt, and powers Superset dashboards with **row-level security** for caseworkers. Outcomes: MEL teams went from **12+ hours/week of data work to ~2 hours/week**; caseworkers save ~3 hours/week and reports that took half a day now generate in minutes. Dalgo provided 40+ hours of in-person training.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did Ummeed use Dalgo?',
      'What did Dalgo do for Ummeed?',
    ],
    canonical_answer:
      'Ummeed had two siloed systems: Clinical Management System (15,500+ patient records, 150,000+ sessions) and Training Management System (14,000+ participants) that couldn\'t communicate. Manual processing required full-time staff. Dalgo built automated weekly syncing of both into PostgreSQL, dbt transformations, and Superset dashboards with role-based access. Child-journey mapping across multi-disciplinary services is now possible. Vinodhini Umashankar (Associate Director, M&E): "The introduction of the dashboard has been a game-changer for our team."',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did SHRI use Dalgo?',
      'What did Dalgo do for SHRI?',
    ],
    canonical_answer:
      'SHRI was burning 20-25 hours/week of one full-time employee on manual data cleaning, and their Google Data Studio dashboards (pulling directly from Sheets) were slow and error-prone. Dalgo automated the pipeline from Kobo forms → analysis dashboards, added structured version control, and got dashboard response time down to **1 second**. **Outcomes: 99% facility uptime across 20 community sanitation sites in Bihar/Jharkhand, ₹3.06 ($0.04) per use, serving 7,000+ daily users.** Field worker quote: "SHRI\'s digital tracking systems have made my work productive and error-free compared to manual registers."',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did Baala use Dalgo?',
      'What did Dalgo do for Baala?',
    ],
    canonical_answer:
      'Baala\'s menstrual health data was fragmented across Kobo Toolbox forms, Google Sheets, and qualitative focus-group notes across urban and rural India. Dalgo consolidated every source — quantitative + qualitative — into a single M&E-driven analysis layer **without changing field collection methods**. Goal: a "menstrual intelligence dashboard" for policymakers. Key Baala takeaway: "Don\'t change everything at once. Transform where it creates the most value first."',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did Antarang use Dalgo?',
      'What did Dalgo do for Antarang?',
    ],
    canonical_answer:
      'Antarang Foundation (youth career guidance for marginalised youth in India) had slow dashboards pulling Salesforce data through Google Sheets — hitting row limits. Goalkeep (a partner consultancy) implemented Dalgo for them: incremental Salesforce → BigQuery syncs, dbt pre-calculated tables, and Looker Studio dashboards answering "Are students improving?" and "Are students mastering the endline assessment?". Now dashboards load instantly. User quote: "The dashboard loads so quickly and looks so neat."',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How did Lend a Hand India (LAHI) use Dalgo?',
    ],
    canonical_answer:
      'LAHI integrates vocational education into 10,000+ government schools (1M+ students) and had data scattered across Google Sheets, Kobo Forms, and Lighthouse. Dalgo migrated their CPMU dashboard from Power BI to Superset (Phase 1), then validated using Lighthouse as a backing tool. dbt automation generated SQL, renamed columns, merged tables, and flattened models.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },

  // ===== Common patterns / themes across customers =====
  {
    category: 'case_studies',
    question_variants: [
      'How much time can Dalgo save on M&E reporting?',
      'What efficiency gains have Dalgo customers seen?',
    ],
    canonical_answer:
      'Documented outcomes: **STiR**: 5x reduction (monthly reports 1 week → 1 hour; annual 1 week → 1 day). **SHOFCO**: MEL teams 12+ hrs/week → ~2 hrs/week; caseworker reports half-day → minutes. **SHRI**: 20-25 hrs/week of manual work eliminated; dashboard response 1 second. **Ummeed**: full-time manual processing eliminated. **Antarang**: dashboard load slow → instant. **Bootcamp participant quote**: "We did in two days what would\'ve taken us months."',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Can Dalgo unify Excel and Google Sheets data?',
      'Does Dalgo work with NGOs that live in spreadsheets today?',
    ],
    canonical_answer:
      'Yes — this is the most common starting point. Bhumi (Excel + Sheets + Zoho Creator), Baala (Sheets + Kobo + qualitative), SHOFCO (Sheets + CommCare + APIs), SHRI (Sheets + Kobo), LAHI (Sheets + Kobo + Lighthouse) — all started with spreadsheet chaos and got unified.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Can Dalgo replace Power BI, Looker, or Data Studio?',
      'Can NGOs migrate away from Power BI to Dalgo?',
    ],
    canonical_answer:
      'Yes, and several have. LAHI migrated their CPMU dashboard from Power BI to Superset on Dalgo. SHOFCO replaced an Airbyte–dbt–Power BI-on-AWS stack with Dalgo. Antarang moved from Salesforce + Google Sheets + Looker Studio to Salesforce → BigQuery → Looker Studio via Dalgo\'s incremental sync. Migrations preserve dashboards while replacing the slow/expensive plumbing underneath.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo have row-level security?',
      'Can different users see different data in the same dashboard?',
    ],
    canonical_answer:
      'Yes for some customers — SHOFCO\'s Dalgo deployment ships row-level-security dashboards where each caseworker only sees their own caseload. This is in the Dalgo 2.0 roadmap as a "Fine-grained Access Control (Alpha)" feature; production usage at SHOFCO suggests it\'s available with implementation support.',
    status: 'partial',
    notes_for_sales: 'Confirm whether row-level security is generally available or per-customer custom work.',
    evidence: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/dalgo-2-0-from-pipelines-to-actionable-insights/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Can Dalgo help with FCRA compliance reporting?',
      'Does Dalgo support donor and regulatory reporting for Indian NGOs?',
    ],
    canonical_answer:
      'Yes. Bhumi used Dalgo specifically to make FCRA renewals less painful — leadership now pulls auditable figures ("how much did you spend? how many students did you impact?") from one source of truth instead of reconciling years of sheets.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Can Dalgo work with NGOs that don\'t have a tech team?',
      'Is Dalgo only for technically sophisticated NGOs?',
    ],
    canonical_answer:
      'No — Dalgo explicitly targets "NGO staff with M&E experience but basic or no SQL skills." Implementation is typically done by Dalgo\'s consulting team or a partner consultancy (e.g., Goalkeep), not the NGO\'s own engineers. Dalgo Data Confidence Bootcamps (2-day, no-cost) help NGOs assess fit before adoption. Field teams keep their existing tools — Dalgo sits between collection and insight.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/dalgo-product-roadmap/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
      'https://projecttech4dev.org/whats-special-about-a-data-bootcamp-for-nonprofits/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'How do partner consultancies like Goalkeep work with Dalgo?',
      'Can a third-party consultant deliver Dalgo to my NGO?',
    ],
    canonical_answer:
      'Yes. Dalgo works with partner consultancies (e.g., Goalkeep delivered Antarang\'s implementation). When an external vendor handles onboarding/support, Dalgo\'s base pricing is reduced.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
      'https://dalgo.org/pricing/',
    ],
    source_audit_date: '2026-05-22',
  },

  // ===== Programs offered by Dalgo =====
  {
    category: 'case_studies',
    question_variants: [
      'Does Dalgo offer training programs for NGOs?',
      'What are Dalgo Data Confidence Bootcamps?',
    ],
    canonical_answer:
      'Yes — 2-day, in-person Data Confidence Bootcamps where NGOs bring their own real data and assess whether Dalgo fits before committing. Bangalore (Sep 2025) and Delhi (Jan 2026) held so far. Bootcamps are **no-cost**, but require time + internal alignment from the NGO. Participant quote: "We did in two days what would\'ve taken us months." Bootcamps function as an early-stage diagnostic, not a sales pitch.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/whats-special-about-a-data-bootcamp-for-nonprofits/',
      'https://projecttech4dev.org/reflections-from-leading-phase-2-of-the-dalgo-data-confidence-bootcamps/',
      'https://projecttech4dev.org/from-chaos-to-clarity-my-first-dalgo-bootcamp/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'Are Dalgo bootcamps free?',
      'What does it cost to attend a Dalgo bootcamp?',
    ],
    canonical_answer:
      'The bootcamp itself is no-cost. The Dalgo team notes: "no-cost still demands the most expensive resources NGOs have — time, focus, internal alignment, and accountability." Bootcamps are framed as a diagnostic environment to decide if Dalgo fits, not a sales pitch.',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/reflections-from-leading-phase-2-of-the-dalgo-data-confidence-bootcamps/',
    ],
    source_audit_date: '2026-05-22',
  },
  {
    category: 'case_studies',
    question_variants: [
      'What is a Dalgo Sprint?',
      'What happens at a Dalgo Sprint?',
    ],
    canonical_answer:
      'A Dalgo Sprint is a 2-3 day collaborative onboarding event for existing partner NGOs to co-create, learn, and gain platform proficiency together. Bhumi attended a Bangalore Sprint (Nov 2025) about a month after onboarding. Dalgo ran 2 Sprints in 2025 (Mahabalipuram Jan, Bengaluru Sept).',
    status: 'yes',
    evidence: [
      'https://projecttech4dev.org/anushas-experience-at-the-dalgo-sprint/',
      'https://projecttech4dev.org/dalgo-in-2025-keeping-customers-front-and-centre/',
    ],
    source_audit_date: '2026-05-22',
  },

  // ===== Origin & history =====
  {
    category: 'case_studies',
    question_variants: [
      'When was Dalgo launched?',
      'How old is Dalgo?',
    ],
    canonical_answer:
      'Dalgo v1.0 launched in September 2023, built by the Tech4Dev team with Vinod conceptualising the original idea. It started as an open-source data platform validated through proof-of-concept projects with Dost Education, SNEHA, STiR Education, SHRI, and Antarang. The name "Dalgo" is variously interpreted as Data from Alpha to Omega, Data and Algorithm, or a nod to Dalgona coffee.',
    status: 'yes',
    evidence: ['https://projecttech4dev.org/launching-dalgo/'],
    source_audit_date: '2026-05-22',
  },
];
