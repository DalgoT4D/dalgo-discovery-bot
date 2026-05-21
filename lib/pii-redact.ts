const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(\+?\d[\d\s().-]{6,}\d)/g;

export function redactPii(text: string): string {
  return text
    .replace(EMAIL, '[REDACTED_EMAIL]')
    .replace(PHONE, m => /\d{7,}/.test(m.replace(/\D/g, '')) ? '[REDACTED_PHONE]' : m);
}
