// lib/llm/eval/cases/structure.ts
//
// 7 problem-statement scenarios where the consultant 3-part structure must
// appear in the response (problem_framing -> dalgo_approach -> evidence).
// Pure structure checks — no URL or pattern-match expectations. The LLM judge
// inspects the response shape only.

import type { EvalCase } from './types';

export const structureCases: EvalCase[] = [
  {
    id: 'st-01',
    bucket: 'structure',
    input:
      "We're 8 people, all data is in Kobo and Sheets, we need to show funders monthly outcomes — what would Dalgo do?",
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
  {
    id: 'st-02',
    bucket: 'structure',
    input:
      "We just started tracking data this quarter. How would Dalgo help us not lose what we've collected?",
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
  {
    id: 'st-03',
    bucket: 'structure',
    input:
      'Our M&E team spends 20 hours a week pulling data from forms — is there a better way?',
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
  {
    id: 'st-04',
    bucket: 'structure',
    input:
      'We run a girls-education program across 4 states with CommCare in the field — how would Dalgo bring that together for our board?',
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
  {
    id: 'st-05',
    bucket: 'structure',
    input:
      'We are a 200-person NGO and our country offices each use a different BI tool — what would a Dalgo onboarding look like for us?',
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
  {
    id: 'st-06',
    bucket: 'structure',
    input:
      'We do livelihood training and have endline assessments in a separate system from our beneficiary master — how would Dalgo connect outcomes back to participants?',
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
  {
    id: 'st-07',
    bucket: 'structure',
    input:
      'Our nutrition program has frontline workers collecting on phones and supervisors reviewing weekly — how would Dalgo help us catch issues earlier in the cycle?',
    expected: {
      structure: ['problem_framing', 'dalgo_approach', 'evidence'],
    },
    judge: ['llm-judge'],
  },
];
