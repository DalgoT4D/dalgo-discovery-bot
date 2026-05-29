// lib/llm/eval/cases/citations.ts
//
// 10 broad capability / case-study questions where the bot is likely to cite
// blog URLs. The single expectation is `must_not_hallucinate_urls: true`:
// every URL the model emits must come from the retrieval candidate set.

import type { EvalCase } from './types';

export const citationCases: EvalCase[] = [
  {
    id: 'cit-01',
    bucket: 'citations',
    input: 'Which NGOs working on maternal health use Dalgo?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-02',
    bucket: 'citations',
    input: 'Has Dalgo worked with NGOs outside India?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-03',
    bucket: 'citations',
    input:
      'Can you give me three examples of NGOs that consolidated their Kobo data with Dalgo?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-04',
    bucket: 'citations',
    input: 'Which NGOs cut their monthly reporting cycle using Dalgo?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-05',
    bucket: 'citations',
    input: 'Has any NGO used Dalgo for sanitation or WASH programs?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-06',
    bucket: 'citations',
    input: 'Which case studies show Dalgo replacing an expensive AWS data stack?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-07',
    bucket: 'citations',
    input: 'Have any volunteer-led NGOs used Dalgo to join volunteer and beneficiary data?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-08',
    bucket: 'citations',
    input: 'Show me NGOs that adopted Dalgo to unify multi-region or multi-country programs.',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-09',
    bucket: 'citations',
    input:
      'Which education NGOs use Dalgo to join Salesforce data with assessment outcomes?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
  {
    id: 'cit-10',
    bucket: 'citations',
    input: 'Which NGOs use Dalgo with row-level security for sensitive beneficiary data?',
    expected: { must_not_hallucinate_urls: true },
    judge: ['retrieval-judge'],
  },
];
