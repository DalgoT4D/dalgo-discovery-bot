// lib/llm/eval/cases/problem-statements.ts
//
// 15 problem-statement eval cases — one per archetype defined in
// `lib/db/seed-data/problem-patterns.ts`. Each case checks that the bot
// matches the archetype, cites at least one of its evidence URLs, does not
// hallucinate URLs, and produces the consultant 3-part structure
// (problem_framing -> dalgo_approach -> evidence).
//
// All URLs below are copied verbatim from problem-patterns.ts. Do not invent
// new URLs in this file — the retrieval judge cross-checks against KB.

import type { EvalCase } from './types';

export const problemStatementCases: EvalCase[] = [
  {
    id: 'ps-01',
    bucket: 'problem-statement',
    input: "We don't have any data system — everything is in Excel and Google Drive.",
    expected: {
      matched_pattern: 'no_data_system',
      must_cite_one_of: [
        'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
        'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-02',
    bucket: 'problem-statement',
    input:
      'Our field teams collect data on Kobo but it just sits there — each program has its own form and nobody pulls it together.',
    expected: {
      matched_pattern: 'scattered_kobo_and_sheets',
      must_cite_one_of: [
        'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
        'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
        'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-03',
    bucket: 'problem-statement',
    input:
      'Our M&E team spends a week each month preparing the monthly report — by the time the report is ready the data is already stale.',
    expected: {
      matched_pattern: 'monthly_offline_reporting',
      must_cite_one_of: [
        'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
        'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-04',
    bucket: 'problem-statement',
    input:
      "Our funders are asking for a dashboard and we don't have one — FCRA renewal is coming and we cannot reconcile our spend and beneficiary numbers.",
    expected: {
      matched_pattern: 'funder_dashboard_demand',
      must_cite_one_of: [
        'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
        'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-05',
    bucket: 'problem-statement',
    input:
      'We run the same program in multiple countries and cannot roll it up — each region has its own tools and definitions.',
    expected: {
      matched_pattern: 'multi_country_program_aggregation',
      must_cite_one_of: [
        'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
        'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-06',
    bucket: 'problem-statement',
    input:
      'Our caseworkers handle sensitive beneficiary data — we need each field officer to only see their own caseload, not the whole org-wide view.',
    expected: {
      matched_pattern: 'caseworker_field_data_security',
      must_cite_one_of: [
        'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
        'https://projecttech4dev.org/flushing-out-inefficiencies-shri-dalgos-data-driven-approach-to-better-quality-sanitation/',
        'https://projecttech4dev.org/dalgo-2-0-from-pipelines-to-actionable-insights/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-07',
    bucket: 'problem-statement',
    input:
      'We are a small NGO and cannot hire a data engineer — our M&E team knows Excel but not SQL or Python.',
    expected: {
      matched_pattern: 'cant_build_internal_data_team',
      must_cite_one_of: [
        'https://projecttech4dev.org/dalgo-product-roadmap/',
        'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
        'https://projecttech4dev.org/whats-special-about-a-data-bootcamp-for-nonprofits/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-08',
    bucket: 'problem-statement',
    input:
      'Every funder wants a different cut of the same program — we rebuild the same numbers in three formats for three donors every quarter.',
    expected: {
      matched_pattern: 'donor_specific_reporting_metrics',
      must_cite_one_of: [
        'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
        'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-09',
    bucket: 'problem-statement',
    input:
      'We want next-day insights instead of a monthly cycle — by the time we know there is a problem at a site, the cohort has moved on.',
    expected: {
      matched_pattern: 'real_time_field_insights',
      must_cite_one_of: [
        'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
        'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-10',
    bucket: 'problem-statement',
    input:
      'We track outputs but we cannot show outcomes or impact — our theory of change is on paper but our data is just attendance.',
    expected: {
      matched_pattern: 'theory_of_change_metrics',
      must_cite_one_of: [
        'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
        'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-11',
    bucket: 'problem-statement',
    input:
      'We have attendance in one system and assessments in another and cannot join them — we need a single beneficiary record across all the tools we use.',
    expected: {
      matched_pattern: 'attendance_and_outcomes_join',
      must_cite_one_of: [
        'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
        'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
        'https://projecttech4dev.org/maximising-impact-ummeed-dalgos-approach-to-data-driven-trans-disciplinary-clinical-care/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-12',
    bucket: 'problem-statement',
    input:
      'We run a volunteer program and a beneficiary program — our volunteer database is in Zoho and our beneficiary data is in Sheets and they are tracked separately.',
    expected: {
      matched_pattern: 'volunteer_program_tracking',
      must_cite_one_of: [
        'https://projecttech4dev.org/lessons-from-bhumi-closing-the-data-to-decision-gap-with-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-13',
    bucket: 'problem-statement',
    input:
      'We run MCH programs in urban informal settlements — our data is in Kobo plus qualitative focus-group notes and we need to anonymise before analysis.',
    expected: {
      matched_pattern: 'maternal_child_health_kobo',
      must_cite_one_of: [
        'https://projecttech4dev.org/harnessing-real-time-data-for-social-impact-snehas-journey-with-dalgo/',
        'https://projecttech4dev.org/making-the-invisible-visible-learn-how-baala-is-finding-a-path-to-data-insights/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-14',
    bucket: 'problem-statement',
    input:
      'We already have a cloud Postgres and we are running Airbyte and Power BI on AWS — the bill is too high and our M&E team still cannot get insights out of it.',
    expected: {
      matched_pattern: 'fragmented_donor_data_postgres',
      must_cite_one_of: [
        'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
        'https://projecttech4dev.org/data-transformation-journey-lahis-collaboration-with-dalgo/',
        'https://projecttech4dev.org/fueling-success-antarangs-data-breakthrough-with-goalkeep-and-dalgo/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'ps-15',
    bucket: 'problem-statement',
    input:
      "What happens to our data stack if Dalgo goes away? We're worried about being locked in to another vendor and need to know we can sustain this long-term.",
    expected: {
      matched_pattern: 'sustainability_after_dalgo_engagement',
      must_cite_one_of: [
        'https://projecttech4dev.org/shining-hope-from-within-shofcos-empowerment-story-with-dalgo/',
        'https://projecttech4dev.org/from-data-burden-to-strategic-insight-how-stir-transformed-data-across-multiple-countries-with-dalgo/',
        'https://projecttech4dev.org/anushas-experience-at-the-dalgo-sprint/',
      ],
      must_not_hallucinate_urls: true,
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
];
