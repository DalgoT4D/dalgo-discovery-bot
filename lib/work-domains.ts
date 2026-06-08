// Role / work-domain taxonomy, based on webapp_v2's signup flow
// (webapp_v2/app/invitations/page.tsx, `work_domain` field). The Discovery
// Bot intentionally diverges: role is a required field here (we want every
// visitor's role), so the "None / Prefer not to say" opt-out is dropped and
// "Other" is offered as the catch-all last option instead.
export const WORK_DOMAINS = [
  { value: 'monitoring_evaluation', label: 'Monitoring & Evaluation' },
  { value: 'program_manager', label: 'Program Manager' },
  { value: 'data_tech', label: 'Data & Tech' },
  { value: 'leadership', label: 'Leadership (COO, Founder, CTO etc.)' },
  { value: 'field_worker', label: 'Field worker' },
  { value: 'other', label: 'Other' },
] as const;

export type WorkDomain = (typeof WORK_DOMAINS)[number]['value'];

export const WORK_DOMAIN_VALUES = WORK_DOMAINS.map((d) => d.value) as WorkDomain[];

export function workDomainLabel(value: string | null | undefined): string {
  const found = WORK_DOMAINS.find((d) => d.value === value);
  return found ? found.label : '—';
}
