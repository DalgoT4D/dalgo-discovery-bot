export type KbStatus = 'yes' | 'partial' | 'no' | 'roadmap';

// Single source of truth for KB categories. Reference this everywhere a
// category list is needed (zod enums in admin routes, the search tool) so the
// set can't drift. MUST stay in sync with the CHECK constraint in schema.sql.
export const KB_CATEGORIES = [
  'data_sources', 'transforms', 'dashboards', 'orchestration',
  'ai', 'sharing', 'rbac', 'security', 'deployment',
  'pricing', 'mission', 'stack', 'limitations', 'case_studies',
  'community', 'positioning', 'kpis',
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

export interface KbSeed {
  category: KbCategory;
  question_variants: string[];
  canonical_answer: string;
  status: KbStatus;
  ngo_framing?: string;
  evidence?: string[];
  notes_for_sales?: string;
  source_audit_date?: string;
}
