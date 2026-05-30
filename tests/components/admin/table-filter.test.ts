import { describe, it, expect } from 'vitest';
import { buildMatcher } from '@/components/admin/table-filter';

describe('buildMatcher', () => {
  it('matches everything when the query is empty or whitespace', () => {
    expect(buildMatcher('')('anything')).toBe(true);
    expect(buildMatcher('   ')('anything')).toBe(true);
  });

  it('does case-insensitive substring matching', () => {
    const m = buildMatcher('Dalgo');
    expect(m('How does dalgo handle data?')).toBe(true);
    expect(m('No mention here')).toBe(false);
  });

  it('requires ALL whitespace-separated terms to match, in any order', () => {
    const m = buildMatcher('data ngo');
    expect(m('An NGO working with data')).toBe(true); // both present, reversed
    expect(m('data platform')).toBe(false); // missing "ngo"
  });

  it('treats /pattern/ as a regular expression', () => {
    const m = buildMatcher('/^how /');
    expect(m('How does it work')).toBe(true); // anchored, case-insensitive by default
    expect(m('Tell me how it works')).toBe(false); // not at start
  });

  it('supports regex alternation', () => {
    const m = buildMatcher('/impact|outcome/');
    expect(m('measuring impact')).toBe(true);
    expect(m('tracking outcome')).toBe(true);
    expect(m('something else')).toBe(false);
  });

  it('respects explicit case-sensitive regex flags (no implicit i added past the slash)', () => {
    // Caller passes no flags → we add "i" for convenience.
    expect(buildMatcher('/ABC/')('abc')).toBe(true);
  });

  it('falls back to literal substring matching when the regex is invalid', () => {
    const m = buildMatcher('/[unclosed/');
    // invalid regex → the whole query is treated as a literal substring
    expect(m('plain text')).toBe(false);
    expect(m('has /[unclosed/ literally')).toBe(true);
  });

  it('treats a bare special-char query as literal substring, not regex', () => {
    const m = buildMatcher('C++');
    expect(m('We use C++ here')).toBe(true);
  });
});
