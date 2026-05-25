// lib/llm/eval/cases/tool-names.ts
//
// 10 tool-name lexical-retrieval cases. Each names a specific product/tool the
// KB blogs mention; the retrieval judge checks that at least one retrieved
// chunk contains the named term. No URL or structure expectations — these are
// purely "did lexical search fire correctly?" cases.

import type { EvalCase } from './types';

export const toolNameCases: EvalCase[] = [
  {
    id: 'tn-01',
    bucket: 'tool-names',
    input: 'Can Dalgo ingest from Kobo Toolbox?',
    expected: {
      must_retrieve_blog_mentioning: 'Kobo',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-02',
    bucket: 'tool-names',
    input: 'We track our health indicators in DHIS2 — does Dalgo work with that?',
    expected: {
      must_retrieve_blog_mentioning: 'DHIS2',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-03',
    bucket: 'tool-names',
    input: 'Our field teams use ODK forms. Can Dalgo pull that data?',
    expected: {
      must_retrieve_blog_mentioning: 'ODK',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-04',
    bucket: 'tool-names',
    input: 'We currently report through Power BI — how does Dalgo compare?',
    expected: {
      must_retrieve_blog_mentioning: 'Power BI',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-05',
    bucket: 'tool-names',
    input: 'Does Dalgo replace Tableau for NGO dashboards?',
    expected: {
      must_retrieve_blog_mentioning: 'Tableau',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-06',
    bucket: 'tool-names',
    input: 'I read that Dalgo uses Superset for dashboards — is that right?',
    expected: {
      must_retrieve_blog_mentioning: 'Superset',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-07',
    bucket: 'tool-names',
    input: 'How does Dalgo use Airbyte for ingestion?',
    expected: {
      must_retrieve_blog_mentioning: 'Airbyte',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-08',
    bucket: 'tool-names',
    input: 'Does Dalgo use dbt for transformations?',
    expected: {
      must_retrieve_blog_mentioning: 'dbt',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-09',
    bucket: 'tool-names',
    input: 'Is the Dalgo warehouse Postgres? Our team is comfortable with PostgreSQL already.',
    expected: {
      must_retrieve_blog_mentioning: 'Postgres',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
  {
    id: 'tn-10',
    bucket: 'tool-names',
    input: 'Most of our program data lives in Google Sheets — can Dalgo work with that?',
    expected: {
      must_retrieve_blog_mentioning: 'Google Sheets',
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge'],
  },
];
