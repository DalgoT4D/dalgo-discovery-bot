import { describe, it, expect } from 'vitest';
import { redactPii } from '@/lib/pii-redact';

describe('redactPii', () => {
  it('redacts email addresses', () => {
    expect(redactPii('contact me at jane.doe@example.org soon'))
      .toBe('contact me at [REDACTED_EMAIL] soon');
  });

  it('redacts phone numbers in common formats', () => {
    expect(redactPii('call +91 98765 43210 today')).toContain('[REDACTED_PHONE]');
    expect(redactPii('mobile: (415) 555-0199')).toContain('[REDACTED_PHONE]');
  });

  it('leaves normal text untouched', () => {
    expect(redactPii('We have 50 villages and 12 sub-districts'))
      .toBe('We have 50 villages and 12 sub-districts');
  });
});
