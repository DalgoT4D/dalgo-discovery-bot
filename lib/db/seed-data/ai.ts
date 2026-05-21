import { KbSeed } from './types';

export const ai: KbSeed[] = [
  {
    category: 'ai',
    question_variants: ['Does Dalgo have AI features?'],
    canonical_answer:
      'Yes — Dalgo includes opt-in LLM features: chat-with-data, log summarization, and long-text summarization. Per-org toggle.',
    status: 'yes',
    evidence: [
      'DDP_backend/ddpui/models/llm.py',
      'org_preferences.enable_llm_request',
    ],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'ai',
    question_variants: ['Can I ask questions about my data in natural language?'],
    canonical_answer:
      'Yes — chat-with-data feature lets you query datasets in natural language.',
    status: 'yes',
    evidence: ['ddpui/models/llm.py:LlmSession'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'ai',
    question_variants: ['Does Dalgo have AI-generated SQL?'],
    canonical_answer:
      'Not as a dedicated feature in the current codebase. Chat-with-data provides similar value via natural-language Q&A.',
    status: 'no',
    evidence: ['Not found'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'ai',
    question_variants: ['Can Dalgo summarize pipeline errors?'],
    canonical_answer:
      'Yes — `LOG_SUMMARIZATION` assistant produces AI summaries of pipeline failure logs.',
    status: 'yes',
    evidence: ['LlmAssistantType.LOG_SUMMARIZATION'],
    source_audit_date: '2026-05-21',
  },
  {
    category: 'ai',
    question_variants: ['Does Dalgo do anomaly detection?'],
    canonical_answer:
      "Not natively. dbt tests + Elementary cover data-quality monitoring; anomaly detection isn't a separate feature.",
    status: 'no',
    evidence: ['Not found'],
    source_audit_date: '2026-05-21',
  },
];
