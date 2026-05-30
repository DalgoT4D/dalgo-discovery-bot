import { describe, it, expect } from 'vitest';
import {
  BUCKET_TEMPLATES,
  JUDGE_META,
  CASE_KEY_PREFIX,
  computeNextCaseKey,
  stripEmptyExpected,
  getExamplesForJudge,
} from '@/lib/eval-case-templates';

describe('BUCKET_TEMPLATES', () => {
  it('citations sets retrieval-judge + must_not_hallucinate_urls', () => {
    expect(BUCKET_TEMPLATES.citations).toEqual({
      judges: ['retrieval-judge'],
      expected: { must_not_hallucinate_urls: true },
    });
  });

  it('guardrails sets retrieval-judge + llm-judge + uncertainty + unanswered', () => {
    expect(BUCKET_TEMPLATES.guardrails).toEqual({
      judges: ['retrieval-judge', 'llm-judge'],
      expected: { must_express_uncertainty: true, must_record_unanswered: true },
    });
  });

  it('problem-statement sets retrieval-judge + empty matched_pattern', () => {
    expect(BUCKET_TEMPLATES['problem-statement']).toEqual({
      judges: ['retrieval-judge'],
      expected: { matched_pattern: '' },
    });
  });

  it('structure sets llm-judge + full structure array', () => {
    expect(BUCKET_TEMPLATES.structure).toEqual({
      judges: ['llm-judge'],
      expected: { structure: ['problem_framing', 'dalgo_approach', 'evidence'] },
    });
  });

  it('tool-names sets llm-judge + empty expected', () => {
    expect(BUCKET_TEMPLATES['tool-names']).toEqual({
      judges: ['llm-judge'],
      expected: {},
    });
  });
});

describe('CASE_KEY_PREFIX', () => {
  it('maps each bucket to the conventional prefix', () => {
    expect(CASE_KEY_PREFIX).toEqual({
      citations: 'cit-',
      guardrails: 'gr-',
      'problem-statement': 'ps-',
      structure: 'st-',
      'tool-names': 'tn-',
    });
  });
});

describe('computeNextCaseKey', () => {
  it('returns prefix-01 when no existing keys match', () => {
    expect(computeNextCaseKey('cit-', [])).toBe('cit-01');
    expect(computeNextCaseKey('cit-', ['gr-01', 'ps-99'])).toBe('cit-01');
  });

  it('returns max + 1, zero-padded to 2 digits', () => {
    expect(computeNextCaseKey('cit-', ['cit-01', 'cit-12'])).toBe('cit-13');
    expect(computeNextCaseKey('cit-', ['cit-01', 'cit-02', 'cit-03'])).toBe('cit-04');
  });

  it('handles non-numeric suffixes by ignoring them', () => {
    expect(computeNextCaseKey('cit-', ['cit-01', 'cit-foo', 'cit-12'])).toBe('cit-13');
  });

  it('pads to 2 digits even for max >= 100', () => {
    expect(computeNextCaseKey('cit-', ['cit-99', 'cit-100'])).toBe('cit-101');
  });
});

describe('stripEmptyExpected', () => {
  it('removes empty strings, empty arrays, and false booleans', () => {
    expect(
      stripEmptyExpected({
        matched_pattern: '',
        must_cite_one_of: [],
        must_not_hallucinate_urls: false,
        must_express_uncertainty: true,
        structure: ['evidence'],
      }),
    ).toEqual({
      must_express_uncertainty: true,
      structure: ['evidence'],
    });
  });

  it('keeps non-empty string, non-empty array, true boolean', () => {
    expect(
      stripEmptyExpected({
        matched_pattern: 'ngo_kobo',
        must_cite_one_of: ['https://x.test/a'],
        must_not_hallucinate_urls: true,
      }),
    ).toEqual({
      matched_pattern: 'ngo_kobo',
      must_cite_one_of: ['https://x.test/a'],
      must_not_hallucinate_urls: true,
    });
  });

  it('returns empty object when all fields are falsy/empty', () => {
    expect(stripEmptyExpected({ a: '', b: [], c: false })).toEqual({});
  });
});

describe('JUDGE_META', () => {
  it('has retrieval-judge with the three real fields', () => {
    const fields = JUDGE_META['retrieval-judge'].fields.map((f) => f.key);
    expect(fields).toContain('must_cite_one_of');
    expect(fields).toContain('must_not_hallucinate_urls');
    expect(fields).toContain('matched_pattern');
    expect(fields).toContain('must_retrieve_blog_mentioning');
  });

  it('marks must_retrieve_blog_mentioning as advisory', () => {
    const f = JUDGE_META['retrieval-judge'].fields.find((x) => x.key === 'must_retrieve_blog_mentioning');
    expect(f?.advisory).toBe(true);
  });

  it('has llm-judge with structure + must_express_uncertainty', () => {
    const fields = JUDGE_META['llm-judge'].fields.map((f) => f.key);
    expect(fields).toEqual(['must_express_uncertainty', 'structure']);
  });

  it('has exact-match with only must_record_unanswered', () => {
    const fields = JUDGE_META['exact-match'].fields.map((f) => f.key);
    expect(fields).toEqual(['must_record_unanswered']);
  });
});

describe('getExamplesForJudge', () => {
  it('resolves retrieval-judge example IDs to real seed cases', () => {
    const examples = getExamplesForJudge('retrieval-judge');
    expect(examples.length).toBeGreaterThanOrEqual(2);
    examples.forEach((e) => {
      expect(e.id).toBeTruthy();
      expect(e.input).toBeTruthy();
      expect(e.expected).toBeTypeOf('object');
      expect(e.judge).toContain('retrieval-judge');
    });
  });

  it('resolves llm-judge example IDs to real seed cases', () => {
    const examples = getExamplesForJudge('llm-judge');
    expect(examples.length).toBeGreaterThanOrEqual(2);
    examples.forEach((e) => expect(e.judge).toContain('llm-judge'));
  });

  it('returns a synthetic example for exact-match (no seed cases use it)', () => {
    const examples = getExamplesForJudge('exact-match');
    expect(examples.length).toBeGreaterThanOrEqual(1);
    expect(examples[0].id).toMatch(/^synthetic/);
  });
});
