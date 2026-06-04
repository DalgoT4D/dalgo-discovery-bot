import { KbSeed } from './types';

// lib/db/seed-data/kpis.ts
//
// Metrics & KPIs — a native Dalgo feature shipped to main (mid-2026) in both
// DDP_backend (ddpui/core/metric, ddpui/core/kpi, models/metric.py) and
// webapp_v2 (app/metrics, app/kpis, components/metrics, components/kpis).
//
// These are GENUINELY native Dalgo features (not Superset / 3rd-party) — so
// answer them with confident "in Dalgo you can...". Evidence is cited as code
// paths (no public blog/docs URL exists yet). Verified against the merged
// code, June 2026 — describe ONLY what the code does; be honest about gaps.
//
// Two honesty anchors baked in here:
//   - There is NO alerting / notification on KPIs. RAG status is display-only,
//     computed live when a user views the KPI. Never claim KPI alerts.
//   - Metrics/KPIs have NO dimensional drill-down or built-in filters; that
//     lives in the separate Charts feature. KPIs break down by ONE time
//     dimension only.

export const kpis: KbSeed[] = [
  // ─── WHAT IS A METRIC ────────────────────────────────────────────────
  {
    category: 'kpis',
    question_variants: [
      'What is a metric in Dalgo?',
      'Can I define reusable measures or calculations?',
      'Does Dalgo have a metrics library?',
      'Can I create a calculation once and reuse it?',
      'How do I define a measure like total beneficiaries?',
    ],
    canonical_answer:
      'Yes. A **metric** in Dalgo is a reusable measurement you define once and reuse across charts and KPIs — for example "Total beneficiaries reached" or "Average attendance". You pick one table from your warehouse, then define the calculation in one of two ways: a **Simple** metric (choose a column and an aggregation) or a **Calculated** metric (write a short formula that returns a single number, e.g. `SUM(present)/COUNT(*)`). Dalgo runs a test query against your data before saving so you know the definition is valid. All your metrics live in a searchable Metrics Library, and each shows where it is "Used By" (which charts and KPIs reference it).',
    status: 'yes',
    ngo_framing:
      'Frame as "define your core M&E measures once, reuse everywhere" — avoids each team redefining the same number differently.',
    evidence: [
      'DDP_backend/ddpui/models/metric.py',
      'DDP_backend/ddpui/core/metric/metric_service.py',
      'webapp_v2/components/metrics/metrics-library.tsx',
    ],
    source_audit_date: '2026-06-04',
  },
  {
    category: 'kpis',
    question_variants: [
      'What aggregations or functions can a metric use?',
      'Does Dalgo support sum, average, count?',
      'Can I do count distinct or a custom formula?',
      'What calculations are available for metrics?',
    ],
    canonical_answer:
      'A Simple metric supports six aggregations: **sum, average, count, minimum, maximum, and count-distinct**. For anything beyond those (e.g. a ratio, a weighted figure, median), use a **Calculated** metric and write a short SQL expression that returns a single number — Dalgo validates it against your warehouse before saving. Note: for non-count aggregations, you select from numeric columns.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/models/metric.py (AGGREGATION_CHOICES)',
      'webapp_v2/types/metrics.ts (AGGREGATION_OPTIONS)',
      'webapp_v2/components/metrics/metric-form-dialog.tsx',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── WHAT IS A KPI ───────────────────────────────────────────────────
  {
    category: 'kpis',
    question_variants: [
      'What is a KPI in Dalgo?',
      'Can I track targets and goals in Dalgo?',
      'Does Dalgo show whether we are on track?',
      'Can I set a target on a measure and monitor it?',
      'How do I track performance against a goal?',
    ],
    canonical_answer:
      'Yes — KPIs are a native Dalgo feature for tracking progress against a target, which directly supports "are we on track?" decisions. A **KPI** takes one of your metrics and adds: a **target value**, a **direction** (higher-is-better or lower-is-better), **status thresholds** (set as a % of target, which drive a Red/Amber/Green "On Track / Needs Attention / Off Track" badge), and a **time view** (a date column plus a grain: daily, weekly, monthly, quarterly, or yearly). Each KPI card then shows the current value, the target, the status badge, the change versus the previous period, and a trend chart. So a metric is the raw measure; a KPI is that measure with a goal and a track-record over time.',
    status: 'yes',
    ngo_framing:
      'This is the decisions/credibility benefit made concrete: leadership and funders see at a glance whether each indicator is on track against its target.',
    evidence: [
      'DDP_backend/ddpui/models/metric.py (KPI model)',
      'DDP_backend/ddpui/core/kpi/kpi_service.py',
      'webapp_v2/components/kpis/kpi-form.tsx',
      'webapp_v2/components/kpis/kpi-card.tsx',
    ],
    source_audit_date: '2026-06-04',
  },
  {
    category: 'kpis',
    question_variants: [
      'How does Dalgo decide if a KPI is on track or off track?',
      'What is the RAG status on a KPI?',
      'Does Dalgo show red/amber/green status?',
      'How are KPI thresholds set?',
    ],
    canonical_answer:
      'Each KPI shows a Red/Amber/Green status — labelled **On Track / Needs Attention / Off Track**. You set two thresholds as a percentage of your target: a green threshold (default 100% of target) and an amber threshold (default 80%); anything past amber shows red. Dalgo compares the current value to the target using your chosen direction (higher-is-better or lower-is-better) and colours the badge accordingly. The status is calculated live when you open the KPI — it is a visual indicator, and you also see the % achievement of target and the change versus the previous period.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/core/kpi/kpi_service.py (compute_rag_status)',
      'webapp_v2/components/kpis/kpi-form.tsx',
      'webapp_v2/types/kpis.ts (RAG bands, DIRECTION_OPTIONS)',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── RESULTS-CHAIN TAGGING (M&E HOOK) ────────────────────────────────
  {
    category: 'kpis',
    question_variants: [
      'Can I organise KPIs by input, output, outcome, and impact?',
      'Does Dalgo support results-chain or logframe indicators?',
      'Can I tag KPIs by program?',
      'Can I group indicators the way our M&E framework does?',
    ],
    canonical_answer:
      'Yes. Each KPI can be tagged with a **results-chain type — input, output, outcome, or impact** — matching how M&E and log-frame frameworks classify indicators. You can also add free-form **program tags** so KPIs can be grouped and filtered by program. On the KPIs page you can then filter by type, by program, and by status (On Track / Needs Attention / Off Track) to see, for example, all outcome indicators for a given program that need attention.',
    status: 'yes',
    ngo_framing:
      'Strong M&E fit: the input/output/outcome/impact tagging mirrors a results chain / theory of change, so the tool speaks the team\'s language.',
    evidence: [
      'webapp_v2/types/kpis.ts (METRIC_TYPE_TAG_OPTIONS)',
      'DDP_backend/ddpui/schemas/kpi_schema.py',
      'webapp_v2/components/kpis/kpi-page.tsx',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── ANNOTATIONS / BENEFICIARY QUOTES ────────────────────────────────
  {
    category: 'kpis',
    question_variants: [
      'Can I add notes explaining why a KPI moved?',
      'Can I annotate a KPI for a specific month?',
      'Can I attach context or a beneficiary quote to a metric?',
      'Does Dalgo let me record why a number changed?',
    ],
    canonical_answer:
      'Yes — on a KPI you can add **notes** tied to a specific time period to explain why a number moved (e.g. "Dip in March due to flooding"). There are two note types: a plain **Note** and a **Beneficiary Quote**, so you can capture qualitative context alongside the numbers. Each note records the value and the period-over-period change at the time it was written, plus the author and timestamp. Notes are added in the KPI\'s detail view. (This applies to KPIs specifically; only the person who wrote a note can delete it.)',
    status: 'yes',
    ngo_framing:
      'Helps the storytelling/credibility benefit — the "why" behind a movement travels with the number into reviews and reports.',
    evidence: [
      'DDP_backend/ddpui/core/kpi/kpi_service.py (annotations)',
      'webapp_v2/components/kpis/kpi-detail-drawer.tsx',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── KPIs ON DASHBOARDS / REPORTS ────────────────────────────────────
  {
    category: 'kpis',
    question_variants: [
      'Can I put KPIs on a dashboard?',
      'Do KPIs show up in shared dashboards or reports?',
      'Can leadership see KPI tiles on a dashboard?',
      'Do KPI tiles respond to dashboard filters?',
    ],
    canonical_answer:
      'Yes. A KPI can be added to a dashboard as a tile (value, target, status badge, % change, and trend), placed and resized in the dashboard builder. KPI tiles respond to dashboard filters and date ranges, so leadership can slice them like the rest of the dashboard. When a dashboard is shared or published as a report, the KPIs it contains are snapshotted into that report. To protect them, a KPI cannot be deleted while it is still used on a dashboard — Dalgo lists the dashboards using it first.',
    status: 'yes',
    evidence: [
      'webapp_v2/components/dashboard/kpi-chart-element.tsx',
      'webapp_v2/components/dashboard/kpi-selector-modal.tsx',
      'DDP_backend/ddpui/core/kpi/kpi_service.py (get_kpi_dashboards)',
    ],
    source_audit_date: '2026-06-04',
  },
  {
    category: 'kpis',
    question_variants: [
      'Can I export or download a KPI?',
      'Can I get a KPI as an image or its data as CSV?',
      'Who can create or edit KPIs and metrics?',
    ],
    canonical_answer:
      'You can download a KPI as a PNG image or export its period data as a CSV. Access is controlled by role: Dalgo has separate view / create / edit / delete permissions for metrics and for KPIs, so an organisation can let M&E staff build them while others only view. Metrics and KPIs are scoped to your organisation — each org only sees its own.',
    status: 'yes',
    evidence: [
      'webapp_v2/components/kpis/kpi-card.tsx',
      'DDP_backend/seed/002_permissions.json',
      'DDP_backend/ddpui/api/kpi_api.py',
    ],
    source_audit_date: '2026-06-04',
  },

  // ─── HONEST LIMITATIONS ──────────────────────────────────────────────
  {
    category: 'kpis',
    question_variants: [
      'Can Dalgo alert me when a KPI goes off track?',
      'Do KPIs send notifications or emails on a threshold?',
      'Can I get notified when a metric crosses a limit?',
      'Is there KPI alerting?',
    ],
    canonical_answer:
      'No — Dalgo does not currently send alerts or notifications when a KPI goes off track. The Red/Amber/Green status is a visual indicator, calculated when someone views the KPI or its dashboard; nothing emails or messages you automatically on a threshold breach. If proactive alerting matters to you, flag it for the Dalgo team — it\'s a common request to track.',
    status: 'no',
    notes_for_sales:
      'No alerting/notification code exists in the KPI/metric modules as of June 2026. Do not imply KPI alerts. Capture interest as a roadmap signal.',
    evidence: [
      'DDP_backend/ddpui/core/kpi/kpi_service.py (no alert/notify code)',
    ],
    source_audit_date: '2026-06-04',
  },
  {
    category: 'kpis',
    question_variants: [
      'Can I compare a KPI to the same period last year?',
      'Can I choose a custom comparison period for a KPI?',
      'Does a KPI compare to last month or a baseline I pick?',
    ],
    canonical_answer:
      'The change shown on a KPI is always versus the previous period at your chosen grain (for example, this month versus last month). There isn\'t a selector yet to compare against a custom baseline such as the same period last year. You can change the time grain and the date range when you open a KPI in detail to look at the trend differently, but the headline "% change" is previous-period only.',
    status: 'partial',
    evidence: [
      'webapp_v2/components/kpis/kpi-page.tsx (computePopChanges)',
      'webapp_v2/components/kpis/kpi-detail-drawer.tsx',
    ],
    source_audit_date: '2026-06-04',
  },
  {
    category: 'kpis',
    question_variants: [
      'Can I break a KPI down by region or category?',
      'Do metrics support filters or group-by?',
      'Can I drill into a KPI by dimension?',
      'Can I slice a metric by program or gender?',
    ],
    canonical_answer:
      'A metric is a single overall number, and a KPI breaks it down by one time dimension (the trend over days/weeks/months). Metrics and KPIs themselves do not have built-in filters or breakdowns by dimensions like region, gender, or category. For that kind of multi-dimensional slicing, use Dalgo\'s **charts**, which can group and filter by dimensions; a chart can also reuse the same saved metric. On a dashboard, filters do apply to KPI tiles, so you get some slicing there.',
    status: 'partial',
    ngo_framing:
      'Be honest: dimensional breakdowns live in charts, not in the metric/KPI definition. Point them to charts for "by region/gender" analysis.',
    evidence: [
      'DDP_backend/ddpui/models/metric.py',
      'webapp_v2/types/metrics.ts',
      'webapp_v2/components/charts/MetricsSelector.tsx',
    ],
    source_audit_date: '2026-06-04',
  },
  {
    category: 'kpis',
    question_variants: [
      'What data can metrics and KPIs run on?',
      'Do KPIs need a warehouse?',
      'Can a KPI work without a date column?',
      'Are KPIs real-time?',
    ],
    canonical_answer:
      'Metrics and KPIs run on the data in your connected Dalgo warehouse (the central place all your sources are brought together), so you need a warehouse set up first. A KPI also needs a date/timestamp column on its table to build the trend over time. Values are calculated live when you view them, against the latest data in the warehouse — they reflect how fresh your pipelines keep that warehouse (typically next-day), rather than streaming in real time.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/core/kpi/kpi_service.py',
      'DDP_backend/ddpui/core/metric/metric_service.py',
      'webapp_v2/components/kpis/kpi-form.tsx',
    ],
    source_audit_date: '2026-06-04',
  },
];
