// lib/eval-case-templates.ts
//
// Pure data + helpers consumed by the guided eval-case editor.
// No React, no DB. All exports are deterministic from imports.
//
// Field ownership comes from reading lib/llm/eval/judges/*.ts at HEAD:
//   - retrieval-judge: must_cite_one_of, must_not_hallucinate_urls, matched_pattern
//   - llm-judge:       structure, must_express_uncertainty
//   - exact-match:     must_record_unanswered
//
// must_retrieve_blog_mentioning is set on seed tool-names cases but no judge
// currently reads it. Surfaced as 'advisory' so editing those cases round-trips.

import type { EvalCase } from '@/lib/llm/eval/cases/types';
import { citationCases } from '@/lib/llm/eval/cases/citations';
import { guardrailCases } from '@/lib/llm/eval/cases/guardrails';
import { problemStatementCases } from '@/lib/llm/eval/cases/problem-statements';
import { structureCases } from '@/lib/llm/eval/cases/structure';
import { toolNameCases } from '@/lib/llm/eval/cases/tool-names';

export type BucketKey =
  | 'citations'
  | 'guardrails'
  | 'problem-statement'
  | 'structure'
  | 'tool-names';

export type JudgeKey = 'retrieval-judge' | 'llm-judge' | 'exact-match';

export interface BucketTemplate {
  judges: JudgeKey[];
  expected: Record<string, unknown>;
}

export const BUCKET_TEMPLATES: Record<BucketKey, BucketTemplate> = {
  citations: {
    judges: ['retrieval-judge'],
    expected: { must_not_hallucinate_urls: true },
  },
  guardrails: {
    judges: ['retrieval-judge', 'llm-judge'],
    expected: { must_express_uncertainty: true, must_record_unanswered: true },
  },
  'problem-statement': {
    judges: ['retrieval-judge'],
    expected: { matched_pattern: '' },
  },
  structure: {
    judges: ['llm-judge'],
    expected: { structure: ['problem_framing', 'dalgo_approach', 'evidence'] },
  },
  'tool-names': {
    judges: ['llm-judge'],
    expected: {},
  },
};

export const CASE_KEY_PREFIX: Record<BucketKey, string> = {
  citations: 'cit-',
  guardrails: 'gr-',
  'problem-statement': 'ps-',
  structure: 'st-',
  'tool-names': 'tn-',
};

export type FieldKind =
  | 'chip-list'
  | 'toggle'
  | 'text'
  | 'structure-picker';

export interface JudgeField {
  key: string;
  label: string;
  helpText: string;
  kind: FieldKind;
  /** True if no current judge actually consumes this field but cases still set it. */
  advisory?: boolean;
}

export interface JudgeMeta {
  description: string;
  fields: JudgeField[];
  exampleIds: string[];
}

export const JUDGE_META: Record<JudgeKey, JudgeMeta> = {
  'retrieval-judge': {
    description:
      'Looks at which URLs the bot cited and whether they came from the retrieved sources. Also checks pattern-matching surfaced a curated pattern.',
    fields: [
      {
        key: 'must_cite_one_of',
        label: 'URLs the answer must include (at least one)',
        helpText: 'Paste blog or case-study URLs. The judge passes if the response includes ANY one of them.',
        kind: 'chip-list',
      },
      {
        key: 'must_not_hallucinate_urls',
        label: 'Reject any URL the bot invents',
        helpText: 'When on, every URL in the response must come from the retrieved candidates (or the projecttech4dev.org domain).',
        kind: 'toggle',
      },
      {
        key: 'matched_pattern',
        label: 'Expected problem-pattern slug',
        helpText: 'A pattern slug from lib/db/seed-data/problem-patterns.ts. The judge checks the curated pattern surfaced in the top retrieval results.',
        kind: 'text',
      },
      {
        key: 'must_retrieve_blog_mentioning',
        label: 'Retrieved chunk must mention this term',
        helpText: 'Advisory: set on tool-names seed cases but not enforced by the current runner.',
        kind: 'text',
        advisory: true,
      },
    ],
    exampleIds: ['cit-01', 'ps-01'],
  },
  'llm-judge': {
    description:
      'Asks Claude Haiku to score the response against your expectations (uncertainty language, structure sections).',
    fields: [
      {
        key: 'must_express_uncertainty',
        label: "Bot must say 'not sure' or equivalent",
        helpText: 'Use for out-of-scope questions. Passes if the response honestly acknowledges scope limits.',
        kind: 'toggle',
      },
      {
        key: 'structure',
        label: 'Required sections of the 3-part consultant reply',
        helpText: 'Pick which of problem_framing / dalgo_approach / evidence must appear in order.',
        kind: 'structure-picker',
      },
    ],
    exampleIds: ['gr-01', 'st-01'],
  },
  'exact-match': {
    description:
      "Confirms that a row was created in the `unanswered_questions` table for this question (the bot's 'flag for the team' mechanism).",
    fields: [
      {
        key: 'must_record_unanswered',
        label: 'An unanswered_questions row must be created',
        helpText: 'Use for questions the bot should flag for human follow-up rather than answer.',
        kind: 'toggle',
      },
    ],
    exampleIds: ['synthetic-exact-01'],
  },
};

const ALL_SEED_CASES: EvalCase[] = [
  ...citationCases,
  ...guardrailCases,
  ...problemStatementCases,
  ...structureCases,
  ...toolNameCases,
];

const SYNTHETIC_EXAMPLES: Record<string, EvalCase> = {
  'synthetic-exact-01': {
    id: 'synthetic-exact-01',
    bucket: 'guardrails',
    input: 'Can Dalgo replace my CRM?',
    expected: { must_record_unanswered: true },
    judge: ['exact-match'],
  },
};

export interface ExampleCase {
  id: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judge: string[];
}

export function getExamplesForJudge(judge: JudgeKey): ExampleCase[] {
  const ids = JUDGE_META[judge].exampleIds;
  const mapped: Array<ExampleCase | null> = ids.map((id) => {
    const found =
      ALL_SEED_CASES.find((c) => c.id === id) ?? SYNTHETIC_EXAMPLES[id];
    if (!found) return null;
    return {
      id: found.id,
      bucket: found.bucket,
      input: found.input,
      expected: found.expected as Record<string, unknown>,
      judge: [...found.judge],
    };
  });
  return mapped.filter((x): x is ExampleCase => x !== null);
}

export function computeNextCaseKey(prefix: string, existing: string[]): string {
  const re = new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\d+)$`);
  let max = 0;
  for (const k of existing) {
    const m = re.exec(k);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

export function stripEmptyExpected(
  expected: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(expected)) {
    if (v === '' || v === false || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
