// lib/db/seed-data/problem-patterns.ts
//
// Hand-curated NGO problem archetypes — the "consultant brain" layer the
// discovery bot pattern-matches against during a discovery conversation.
//
// Editorial voice: a Dalgo consultant on a discovery call. Move the NGO from
// symptom to root cause. Name actual tools in dalgo_response (Airbyte, dbt,
// Postgres warehouse, Superset/Metabase, RLS, Tech4Dev consulting). Avoid
// marketing speak.
//
// All evidence_urls MUST exist in lib/db/seed-data/case-studies.ts (or
// mission.ts / limitations.ts). No invented URLs.

export interface ProblemPatternSeed {
  archetype: string;
  problem_phrasing: string[];
  consultant_framing: string;
  dalgo_response: string;
  evidence_urls: string[];
}

export const problemPatterns: ProblemPatternSeed[] = [
  {
    archetype: 'no_data_system',
    problem_phrasing: [
      "We don't have a system, everything is in Excel and Drive",
      "We don't really track data right now",
      "Our data is all in someone's head",
      'We are starting from zero on data',
    ],
    consultant_framing:
      'The NGO is at zero data maturity — no warehouse, no canonical metrics, each program team in its own spreadsheet. The cost is invisible until a funder asks for an outcome they cannot produce, or leadership cannot answer "how many beneficiaries did we reach this year" without two weeks of reconciliation.',
    dalgo_response:
      "Dalgo onboards from this exact state regularly. A Dalgo consulting call maps existing sources (Kobo, Google Sheets, Excel, CRM). Step 2: ingestion via Airbyte connectors into a managed Postgres warehouse. Step 3: dbt transforms produce canonical tables, and a starter Superset dashboard lands within ~2 weeks. The NGO never builds or maintains pipelines themselves — Dalgo's data team owns the stack end-to-end as part of the Tech4Dev partnership model.",
    evidence_urls: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
    ],
  },
  {
    archetype: 'scattered_kobo_and_sheets',
    problem_phrasing: [
      'Our field teams collect data on Kobo but it just sits there',
      'We have Kobo forms and Google Sheets but no way to combine them',
      'Each program has its own Kobo form and nobody pulls it together',
      "We use Kobo Toolbox but can't get an org-wide view",
    ],
    consultant_framing:
      'Collection is solved; aggregation is not. Kobo gives each program a clean form, but every form is an island. The M&E lead ends up exporting CSVs every month and re-stitching them by hand in Excel — which is exactly the work that should be automated, not the collection.',
    dalgo_response:
      'Dalgo treats Kobo as a first-class source. Airbyte connectors pull every form on a schedule into the managed Postgres warehouse. dbt models join forms across programs, deduplicate beneficiaries, and produce one canonical analysis layer. Superset dashboards sit on top so the M&E team queries one place instead of five exports. Field teams keep their existing Kobo forms — nothing changes for them.',
    evidence_urls: [
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
      'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
    ],
  },
  {
    archetype: 'monthly_offline_reporting',
    problem_phrasing: [
      'We compile reports manually every month from paper and Excel',
      'Our M&E team spends a week each month preparing the monthly report',
      'By the time the report is ready the data is already stale',
      'We do offline statistical analysis once a month and that becomes the report',
    ],
    consultant_framing:
      'The reporting cadence is a month behind reality because the pipeline is human. By the time leadership sees a number, the program decision window has already closed. The team is not short on data — they are short on time, because every report is rebuilt from scratch.',
    dalgo_response:
      'Dalgo collapses the monthly cycle into a next-day cycle. Airbyte schedules source syncs (Kobo, Sheets, CRM, CommCare) overnight; dbt rebuilds the analysis layer; Superset dashboards refresh automatically. SNEHA went from monthly offline reports to next-day visibility this way. STiR cut monthly review prep from one week to one hour, and annual reviews from a week to a day, on the same architecture.',
    evidence_urls: [
      'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
    ],
  },
  {
    archetype: 'funder_dashboard_demand',
    problem_phrasing: [
      "Our funders are asking for a dashboard and we don't have one",
      'A donor wants outcome metrics we cannot currently produce',
      'We need to show impact numbers for a grant renewal',
      'FCRA renewal is coming up and we cannot reconcile our spend and beneficiary numbers',
    ],
    consultant_framing:
      "The funder is not really asking for a dashboard — they are asking for a credible, auditable number. The NGO can't produce it because the underlying data has never been canonicalised. The dashboard is the visible artifact; the missing piece is one source of truth that survives a funder's audit question.",
    dalgo_response:
      'Dalgo builds the source of truth first, dashboard second. Airbyte ingests financial and program data into the warehouse, dbt produces auditable metric definitions (beneficiaries reached, spend per program, attendance), and Superset dashboards expose them to leadership and funders. Bhumi used exactly this path to make FCRA renewals tractable — leadership now answers "how many students did we impact" from one trusted figure instead of reconciling years of sheets.',
    evidence_urls: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
    ],
  },
  {
    archetype: 'multi_country_program_aggregation',
    problem_phrasing: [
      'We run the same program in multiple countries and cannot roll it up',
      'Each region has its own tools and definitions — we cannot compare them',
      'Our country teams report in different formats and the global team re-keys everything',
      'We need cross-geography dashboards but every region is on a different stack',
    ],
    consultant_framing:
      'The root issue is not the geography — it is the lack of a shared metric definition. Each region collects what it needs locally; nobody owns the canonical "what counts as an active teacher" or "what counts as a coached school". Without a shared layer, every rollup is a fresh argument.',
    dalgo_response:
      'Dalgo unifies multi-region programs into one warehouse with shared dbt models. STiR runs across 6 regions with ~25,000 records × 100 columns each — Dalgo replaced their patchwork (POI Mapper, SurveyCTO, Mammoth, Zoho Analytics, Data Studio) with one platform and per-region self-service Superset dashboards. Monthly review prep dropped from a week to an hour. SHOFCO runs the same architecture serving 2.4M+ people across Kenyan urban slums with role-based access per program.',
    evidence_urls: [
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
    ],
  },
  {
    archetype: 'caseworker_field_data_security',
    problem_phrasing: [
      'Our caseworkers handle sensitive beneficiary data and we cannot put it in a shared dashboard',
      'We need each field officer to only see their own caseload',
      'GBV/health data is too sensitive for an org-wide BI tool',
      'Different teams should see different rows of the same table',
    ],
    consultant_framing:
      'The blocker is not visualisation — it is access control. The NGO already knows what numbers it wants; it cannot expose them in a tool where every viewer sees every row. Without row-level security the data ends up back in paper registers and personal sheets, which is where SHOFCO\'s caseworkers reverted before Dalgo.',
    dalgo_response:
      "Dalgo ships row-level security on Superset dashboards. SHOFCO's caseworkers across Safehouse, WASH, Gender, and Education only see their own caseload — the same dashboard, scoped per user. Dalgo ingests from CommCare, Google Sheets, and APIs via Airbyte, transforms with dbt, and applies RLS at the warehouse layer. SHRI follows a similar pattern for sanitation-site data. The Dalgo team handles RLS configuration as part of onboarding; the NGO does not write policy code.",
    evidence_urls: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
      'https://projecttech4dev.org/dalgo-2-0-from-pipelines-to-actionable-insights/',
    ],
  },
  {
    archetype: 'cant_build_internal_data_team',
    problem_phrasing: [
      'We are a small NGO and cannot hire a data engineer',
      'Our M&E team knows Excel but not SQL or Python',
      'We tried hiring a tech person and they left in six months',
      "We can't justify a full-time data role on grant budgets",
    ],
    consultant_framing:
      "Most NGOs in this bucket have tried hiring an internal data person at least once. The role is unsustainable on grant funding, and the person leaves with all the institutional knowledge. The real need is not a hire — it's a managed stack where someone else owns the plumbing and the M&E team owns the questions.",
    dalgo_response:
      'Dalgo is explicitly designed for "NGO staff with M&E experience but basic or no SQL skills." The Dalgo consulting team (or a partner consultancy like Goalkeep) implements and maintains Airbyte connectors, the Postgres warehouse, dbt models, and Superset dashboards. The NGO\'s M&E team interacts with finished dashboards, not pipelines. Antarang\'s implementation was delivered entirely through Goalkeep — no internal engineer required.',
    evidence_urls: [
      'https://projecttech4dev.org/dalgo-product-roadmap/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
      'https://projecttech4dev.org/whats-special-about-a-data-bootcamp-for-nonprofits/',
    ],
  },
  {
    archetype: 'donor_specific_reporting_metrics',
    problem_phrasing: [
      'Every funder wants a different cut of the same program',
      'We rebuild the same numbers in three different formats for three different donors',
      'One donor wants outcomes by district, another wants by age band, another by gender',
      'Donor reporting takes the M&E team out of program work for two weeks every quarter',
    ],
    consultant_framing:
      'The work is being done at the wrong layer. The NGO is re-cutting the same underlying data into bespoke spreadsheets per donor, when the underlying data is the same — only the slice differs. The fix is to canonicalise the data once and produce donor-specific views on top, not re-extract per report.',
    dalgo_response:
      'Dalgo separates the canonical layer (dbt models in the Postgres warehouse) from the presentation layer (Superset dashboards per donor). Each donor gets their own dashboard or filtered view over the same governed tables — district, age band, gender become filters, not new spreadsheets. STiR\'s per-region dashboards work this way; the M&E team configures slices rather than rebuilding reports. The Dalgo consulting team helps define the canonical metric definitions during onboarding.',
    evidence_urls: [
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
  },
  {
    archetype: 'real_time_field_insights',
    problem_phrasing: [
      'We want next-day insights instead of a monthly cycle',
      'Field teams need to see data the day after they collect it',
      'Leadership wants to drill into program performance mid-cycle, not after',
      'By the time we know there is a problem at a site, the cohort has moved on',
    ],
    consultant_framing:
      'Decision latency is the real cost. When data is monthly, programs cannot be corrected mid-cycle — the team only learns about a low-performing site after the cohort has moved on. Cutting the cycle from monthly to next-day changes how the program runs, not just how it reports.',
    dalgo_response:
      'Dalgo runs scheduled Airbyte syncs (typically nightly), dbt rebuilds the analysis layer, and Superset dashboards refresh — yielding next-day visibility. SNEHA\'s Anindita: "Once we enter the work today, by tomorrow we can already see it reflected." Bhumi\'s programme managers now drill down by school and city mid-cycle on Superset. Note: Dalgo is not a true real-time streaming platform — pipelines are scheduled or webhook-triggered, not sub-second.',
    evidence_urls: [
      'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
  },
  {
    archetype: 'theory_of_change_metrics',
    problem_phrasing: [
      'We track outputs but we cannot show outcomes or impact',
      "We know how many sessions we ran but we don't know if behaviour changed",
      'Our theory of change is on paper but our data is just attendance',
      'We want to move from counting activities to measuring impact',
    ],
    consultant_framing:
      "The NGO knows what it wants to prove but the data architecture doesn't support it. Outputs are easy because they fall out of attendance forms; outcomes require joining attendance with assessments, follow-ups, and qualitative notes across time. Without a warehouse that joins those, the theory of change stays a slide deck.",
    dalgo_response:
      "Dalgo's dbt layer is where theory-of-change joins live. Ummeed maps child journeys across multi-disciplinary clinical and training services by joining their Clinical and Training Management Systems in the Postgres warehouse — previously impossible because the systems were siloed. Antarang joins Salesforce program data with endline assessments to answer \"are students improving?\". Dalgo's consulting call early in onboarding maps the theory of change to the data model so dashboards reflect outcomes, not just activity counts.",
    evidence_urls: [
      'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
    ],
  },
  {
    archetype: 'attendance_and_outcomes_join',
    problem_phrasing: [
      'We have attendance in one system and assessments in another and cannot join them',
      'Kobo has the survey data, our CRM has the beneficiary master, we want both in one view',
      'Our LMS and our M&E spreadsheets do not talk to each other',
      "We need a single beneficiary record across all the tools we use",
    ],
    consultant_framing:
      "The unify-the-beneficiary problem. Each tool has its own ID space — Kobo has its submission IDs, Salesforce has contact IDs, the LMS has student IDs. Without a deduplication and join layer, the org cannot say \"this is one student's full journey\". This is what the warehouse is for; spreadsheets cannot solve it.",
    dalgo_response:
      'Dalgo pulls all sources into the Postgres warehouse via Airbyte connectors (Kobo, Salesforce, CommCare, Google Sheets, Lighthouse, etc.) and uses dbt models to dedupe beneficiaries and join attendance, assessments, and CRM into one canonical view. LAHI joins Sheets + Kobo + Lighthouse this way across 10,000+ schools. Antarang joins Salesforce + assessments to answer endline mastery. The join logic lives in dbt and is owned by the Dalgo team, not the NGO.',
    evidence_urls: [
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
      'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
    ],
  },
  {
    archetype: 'volunteer_program_tracking',
    problem_phrasing: [
      'We run a volunteer program and a beneficiary program and they are tracked separately',
      'Our volunteer database is in Zoho and our beneficiary data is in Sheets',
      'We cannot connect which volunteer worked with which student',
      'We need to track volunteers across multiple cities and link them to program outcomes',
    ],
    consultant_framing:
      'Volunteer-led NGOs run two data systems in parallel — one for the volunteers themselves (recruitment, attendance, retention) and one for the beneficiaries they serve. When those are not joined, leadership cannot answer "which volunteer cohorts are producing the strongest outcomes?", which is exactly the question that should drive volunteer training investment.',
    dalgo_response:
      "Bhumi is the canonical example: their data lived in Excel, Google Sheets, and Zoho Creator across volunteer ops and program delivery. Dalgo auto-pulled from all sources via Airbyte, structured the data through dbt, and built Superset dashboards. Programme managers now drill down by school, city, and metric mid-cycle. Field teams kept their existing workflows — no change-management burden on volunteers. The Tech4Dev partnership model means Dalgo owns the stack ongoing.",
    evidence_urls: [
      'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
    ],
  },
  {
    archetype: 'maternal_child_health_kobo',
    problem_phrasing: [
      'We run MCH programs and our data is in Kobo plus qualitative focus-group notes',
      'We do home visits, collect health forms, and also gather narrative case stories',
      'Our maternal health data has both survey numbers and field-worker observations',
      'We work in urban informal settlements with sensitive health data and need to anonymise before analysis',
    ],
    consultant_framing:
      'MCH and adolescent-health programs generate both structured (Kobo forms, anthropometry, screenings) and unstructured (focus-group transcripts, case notes) data. The unstructured side gets lost because it lives in Drive folders nobody analyses. The fix is one analysis layer that holds both, with anonymisation applied before visualisation given the sensitivity.',
    dalgo_response:
      "SNEHA — a 25-year-old NGO working in Mumbai/Maharashtra urban informal settlements on maternal/child health, violence against women, and adolescent well-being — uses Dalgo to feed real-time Apache Superset dashboards from their data systems, with records anonymised before visualisation. Baala consolidated Kobo Toolbox + Sheets + qualitative focus-group notes from urban and rural India into one analysis layer without changing field collection. dbt models hold both quantitative and qualitative joins; the Dalgo team configures anonymisation.",
    evidence_urls: [
      'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
      'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
    ],
  },
  {
    archetype: 'fragmented_donor_data_postgres',
    problem_phrasing: [
      'We already have a cloud Postgres but no dashboards or transforms',
      "We have a database but we cannot get insights out of it",
      'Our developers built a Postgres but our M&E team cannot query it',
      'We are running Airbyte and Power BI on AWS and the bill is too high',
    ],
    consultant_framing:
      "These NGOs are not at zero — they have a database, maybe even pipelines. The problem is the analysis layer never got built, or the existing stack is over-engineered and expensive. The team has plumbing but no dashboards their M&E people can actually use, and the cloud bill is funded out of programme grants.",
    dalgo_response:
      "Dalgo replaces the over-engineered stack with a managed equivalent. SHOFCO had been running Airbyte–dbt–Power BI on AWS at high cost; Dalgo took over ingestion (CommCare, Sheets, Mobiwater APIs), dbt transforms, and Superset dashboards with RLS — MEL teams went from 12+ hours/week of data work to ~2 hours/week. LAHI migrated their CPMU dashboard from Power BI to Superset on Dalgo. Antarang moved from Salesforce + Sheets + Looker Studio to Salesforce → BigQuery → Looker Studio via Dalgo's incremental sync.",
    evidence_urls: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
    ],
  },
  {
    archetype: 'sustainability_after_dalgo_engagement',
    problem_phrasing: [
      'What happens to our data stack if Dalgo goes away?',
      'How do we sustain this after the onboarding period?',
      "We're worried about being locked in to another vendor",
      'Will we be able to maintain the dashboards ourselves long-term?',
    ],
    consultant_framing:
      'A reasonable, well-trained skepticism — NGOs have been burned by tech projects that left them with an unmaintainable artifact. The honest answer is that Dalgo is a managed service, not a hand-off: the Tech4Dev team owns the stack ongoing, with training so the NGO team can use it confidently. The underlying components (Postgres, dbt, Superset, Airbyte) are open-source, so the data and models are portable.',
    dalgo_response:
      'Dalgo is built on open-source components — Postgres, dbt, Apache Superset, Airbyte — so the NGO\'s data and transformations are portable, not locked in. The Tech4Dev consulting team supports the stack ongoing; SHOFCO received 40+ hours of in-person training during onboarding. STiR\'s leadership now describes the dependency frankly: "If Dalgo were to disappear tomorrow, it could actually cause a huge cascading effect" — said after the platform became load-bearing for their M&E. Dalgo Sprints (2-3 day onboarding events) build the customer team\'s proficiency directly.',
    evidence_urls: [
      'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      'https://projecttech4dev.org/anushas-experience-at-the-dalgo-sprint/',
    ],
  },
];
