export type KbStatus = 'yes' | 'partial' | 'no' | 'roadmap';
export type KbCategory =
  | 'data_sources' | 'transforms' | 'dashboards' | 'orchestration'
  | 'ai' | 'sharing' | 'rbac' | 'security' | 'deployment'
  | 'pricing' | 'mission' | 'stack' | 'limitations' | 'case_studies';

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
