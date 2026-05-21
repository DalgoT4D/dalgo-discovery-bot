import { KbSeed } from './types';

export const dashboards: KbSeed[] = [
  {
    category: 'dashboards',
    question_variants: ["How does Dalgo's dashboard builder work?"],
    canonical_answer:
      'Drag-and-drop canvas with a 12-column responsive grid. Add charts, text, filters; arrange freely.',
    status: 'yes',
    evidence: [
      'webapp_v2/components/dashboard/dashboard-builder-v2.tsx (react-grid-layout)',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['What chart types are available?'],
    canonical_answer:
      'Bar, line, pie, number/KPI card, table, and choropleth map — 6 core types. Tables support drill-down and column formatting.',
    status: 'yes',
    evidence: ['webapp_v2/components/charts/'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I make a choropleth (geographic) map?'],
    canonical_answer:
      'Yes — choropleth maps with multi-level geographic hierarchy (country → region → district drill-down).',
    status: 'yes',
    evidence: ["webapp_v2/components/charts/ (chart_type: 'map')"],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Are there scatter plots / treemaps / sankey diagrams / heatmaps?'],
    canonical_answer:
      'Not in v2. Current chart palette is 6 types (bar/line/pie/number/table/map). Suggest workaround via embedded Superset for advanced visuals.',
    status: 'no',
    evidence: ['webapp_v2/components/charts/ — no scatter/treemap/sankey found'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I add filters that affect multiple charts?'],
    canonical_answer:
      'Yes — global dashboard filters with value, numerical, and datetime types affect all linked charts.',
    status: 'yes',
    evidence: ['webapp_v2/components/dashboard/unified-filters-panel.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I have per-chart filters?'],
    canonical_answer:
      'Yes — independent chart-level filters supported alongside global filters.',
    status: 'yes',
    evidence: ['ChartFiltersConfiguration.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I drill down from a summary to detail?'],
    canonical_answer:
      'Yes — table charts support drill-down, and maps support geographic drill-down.',
    status: 'yes',
    evidence: [
      'Table `dimensions[]` with `enable_drill_down: true`',
      '`geographic_hierarchy` for maps',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I have multiple tabs/sections in a dashboard?'],
    canonical_answer: 'Yes — TabBar component for multi-tab dashboards.',
    status: 'yes',
    evidence: ['webapp_v2/components/dashboard/tabs/TabBar.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Is there autosave?'],
    canonical_answer:
      'Yes — autosave with manual save fallback. Undo/redo also supported.',
    status: 'yes',
    evidence: ['useDashboard hook', 'useUndoRedo'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I clone or duplicate a dashboard?'],
    canonical_answer:
      'Yes — `duplicateDashboard()` clones an entire dashboard with all settings.',
    status: 'yes',
    evidence: ['webapp_v2/.../dashboard-list-v2.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I lock a dashboard against accidental edits?'],
    canonical_answer: 'Yes — dashboard lock/unlock controls.',
    status: 'yes',
    evidence: ['webapp_v2/components/dashboard/dashboard-builder-v2.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Do dashboards work on mobile?'],
    canonical_answer:
      'Yes — responsive 12-column grid layout adapts to screen size.',
    status: 'yes',
    evidence: [
      'react-grid-layout responsive config',
      'responsive-dashboard-actions.tsx',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I rename metrics (alias)?'],
    canonical_answer:
      'Yes — metrics support an `alias` field (e.g., "Total Revenue" instead of "SUM(amount)").',
    status: 'yes',
    evidence: ['ChartMetric.alias field'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I sort and paginate chart data?'],
    canonical_answer: 'Yes — sorting and pagination configurable per chart.',
    status: 'yes',
    evidence: [
      'ChartSortConfiguration.tsx',
      'ChartPaginationConfiguration.tsx',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I format columns (currency, percent, dates)?'],
    canonical_answer:
      'Yes — per-column formatting: type, precision, prefix, suffix.',
    status: 'yes',
    evidence: ['column_formatting in chart config'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I embed a Superset dashboard?'],
    canonical_answer:
      'Yes — Superset embedded dashboards via guest tokens supported as an optional add-on.',
    status: 'yes',
    evidence: [
      'webapp_v2/.../superset-embed.tsx (uses @superset-ui/embedded-sdk)',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I preview a chart while building it?'],
    canonical_answer: 'Yes — real-time chart preview updates as you configure.',
    status: 'yes',
    evidence: ['ChartPreview.tsx'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'dashboards',
    question_variants: ['Can I see raw data before charting it?'],
    canonical_answer: 'Yes — Data preview shows columns, types, and sample rows.',
    status: 'yes',
    evidence: ['DataPreview.tsx'],
    source_audit_date: '2026-05-21',
  },
];
