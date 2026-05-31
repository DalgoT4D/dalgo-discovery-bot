import { describe, it, expect } from 'vitest';
import { WORK_DOMAINS, WORK_DOMAIN_VALUES, workDomainLabel } from '@/lib/work-domains';

describe('work-domains', () => {
  it('has the 6 webapp_v2 values', () => {
    expect(WORK_DOMAIN_VALUES).toEqual([
      'none',
      'monitoring_evaluation',
      'program_manager',
      'data_tech',
      'leadership',
      'field_worker',
    ]);
  });

  it('maps value to label', () => {
    expect(workDomainLabel('monitoring_evaluation')).toBe('Monitoring & Evaluation');
    expect(workDomainLabel('none')).toBe('None / Prefer not to say');
  });

  it('returns a dash for null/unknown', () => {
    expect(workDomainLabel(null)).toBe('—');
    expect(workDomainLabel('bogus')).toBe('—');
  });
});
