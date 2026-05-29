// lib/llm/eval/cases/guardrails.ts
//
// 8 out-of-scope / clear-no scenarios. The bot SHOULD express uncertainty
// ("I'm not sure", "Dalgo doesn't do this", etc.) AND the runner should
// record a row in `unanswered_questions` for analyst review.

import type { EvalCase } from './types';

export const guardrailCases: EvalCase[] = [
  {
    id: 'gr-01',
    bucket: 'guardrails',
    input: 'Can Dalgo do real-time fraud detection for fintech companies?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-02',
    bucket: 'guardrails',
    input: 'Does Dalgo train computer vision models?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-03',
    bucket: 'guardrails',
    input: 'Can Dalgo replace Salesforce?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-04',
    bucket: 'guardrails',
    input: 'Does Dalgo handle payroll?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-05',
    bucket: 'guardrails',
    input: 'Will Dalgo run my Hadoop cluster?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-06',
    bucket: 'guardrails',
    input: 'Does Dalgo provide HIPAA compliance for hospitals?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-07',
    bucket: 'guardrails',
    input: 'Can Dalgo build mobile apps?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
  {
    id: 'gr-08',
    bucket: 'guardrails',
    input: 'Is Dalgo a CRM?',
    expected: {
      must_express_uncertainty: true,
      must_record_unanswered: true,
    },
    judge: ['retrieval-judge', 'llm-judge'],
  },
];
