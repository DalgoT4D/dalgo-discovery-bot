import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { extractPdfText } from '@/lib/pdf';
import { redactPii } from '@/lib/pii-redact';

describe('extractPdfText', () => {
  it('extracts text from a small PDF buffer', async () => {
    const buf = readFileSync('tests/fixtures/sample.pdf');
    const text = await extractPdfText(buf);
    expect(text.toLowerCase()).toContain('hello dalgo');
  });

  it('redacts an injected email when applied to extracted-style text', () => {
    // PDF text content with email is run through the same redactor extractPdfText uses.
    const injected = 'hello dalgo - contact admin@example.org for details';
    expect(redactPii(injected)).toContain('[REDACTED_EMAIL]');
    expect(redactPii(injected)).not.toContain('admin@example.org');
  });
});
