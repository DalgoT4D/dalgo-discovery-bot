// Role / work-domain taxonomy, copied verbatim from webapp_v2's signup flow
// (webapp_v2/app/invitations/page.tsx, `work_domain` field). Keep values in
// sync so the Discovery Bot and the main product agree.
export const WORK_DOMAINS = [
  { value: 'none', label: 'None / Prefer not to say' },
  { value: 'monitoring_evaluation', label: 'Monitoring & Evaluation' },
  { value: 'program_manager', label: 'Program Manager' },
  { value: 'data_tech', label: 'Data & Tech' },
  { value: 'leadership', label: 'Leadership (COO, Founder, CTO etc.)' },
  { value: 'field_worker', label: 'Field worker' },
] as const;

export type WorkDomain = (typeof WORK_DOMAINS)[number]['value'];

export const WORK_DOMAIN_VALUES = WORK_DOMAINS.map((d) => d.value) as WorkDomain[];

export function workDomainLabel(value: string | null | undefined): string {
  const found = WORK_DOMAINS.find((d) => d.value === value);
  return found ? found.label : '—';
}
