import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export interface DraftCandidate { kb_id: string; question: string; snippet: string }

export interface DraftFixInput {
  question: string;          // the user's original question
  wrongAnswer: string;       // the assistant answer reported as wrong
  reason: string;            // admin's "what's wrong"
  suggestedAnswer?: string;  // admin's optional correct answer
  candidates: DraftCandidate[]; // KB entries that fed the answer (from retrieval trace)
}

export interface KbDraft {
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing?: string | null;
  evidence?: string[];
  notes_for_sales?: string | null;
}

export interface DraftFixResult {
  action: 'edit' | 'create';
  target_kb_id?: string; // present when action==='edit'
  draft: KbDraft;
}

export async function draftKbFix(input: DraftFixInput): Promise<DraftFixResult> {
  const candidateBlock = input.candidates.length
    ? input.candidates.map((c, i) => `${i + 1}. [kb_id=${c.kb_id}] Q: ${c.question}\n   A: ${c.snippet}`).join('\n')
    : '(no KB entries fed this answer)';

  const prompt = `You maintain the knowledge base for a chatbot that helps NGO leaders evaluate Dalgo.
An admin reported a wrong answer. Produce a corrected KB entry.

ORIGINAL QUESTION: ${input.question}
WRONG ANSWER GIVEN: ${input.wrongAnswer}
WHY IT'S WRONG (admin): ${input.reason}
ADMIN'S SUGGESTED CORRECT ANSWER (may be empty): ${input.suggestedAnswer ?? ''}

KB ENTRIES THAT FED THIS ANSWER:
${candidateBlock}

Decide:
- If one of the KB entries above contains the wrong information, action="edit" and set target_kb_id to that entry's kb_id. Rewrite that entry correctly.
- If no existing entry covers this, action="create" a new entry.

Honesty rules: if Dalgo does NOT do something, status must be "no" and the answer must say so plainly. Never invent customers or URLs. If the admin gave a suggested answer, base the corrected answer on it.

Return ONLY this JSON (no markdown):
{ "action": "edit"|"create", "target_kb_id": "<uuid or omit>", "draft": { "question_variants": ["..."], "canonical_answer": "...", "status": "yes"|"partial"|"no"|"roadmap", "ngo_framing": null, "evidence": [], "notes_for_sales": null } }`;

  const { text } = await generateText({ model: anthropic('claude-sonnet-4-6'), prompt, maxTokens: 1500 });
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned) as DraftFixResult;

  if (parsed.action !== 'edit') parsed.action = 'create';
  if (parsed.action === 'create') delete parsed.target_kb_id;
  parsed.draft.question_variants = (parsed.draft.question_variants ?? []).filter((s) => s && s.trim());
  if (parsed.draft.question_variants.length === 0) parsed.draft.question_variants = [input.question];
  if (!['yes', 'partial', 'no', 'roadmap'].includes(parsed.draft.status)) parsed.draft.status = 'no';
  parsed.draft.evidence = parsed.draft.evidence ?? [];
  return parsed;
}
