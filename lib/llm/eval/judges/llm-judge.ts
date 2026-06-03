// lib/llm/eval/judges/llm-judge.ts
import { anthropic } from '@/lib/llm/client';
import { generateText } from 'ai';
import type { EvalCase } from '../cases/types';
import type { JudgeResult } from './retrieval-judge';

const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

const RUBRIC = (c: EvalCase, response: string, retrievedPassages: string[]) => {
  const conveyLine = c.expected.answer_must_convey
    ? `\n- convey_pass: passes if the response clearly conveys this point: "${c.expected.answer_must_convey}". Fails if it contradicts or omits it.`
    : '';
  const conveyJson = c.expected.answer_must_convey
    ? '\n  "convey_pass": boolean,'
    : '';

  return `
You are evaluating a Dalgo Discovery Bot response to an NGO question.

USER MESSAGE:
"""${c.input}"""

RETRIEVED CONTEXT (what the bot had available — this is GROUND TRUTH; treat anything here as verified):
${retrievedPassages.length > 0
    ? retrievedPassages.map((p, i) => `[passage ${i + 1}]\n${p}`).join('\n\n')
    : '(no retrieval — bot answered without context)'}

BOT RESPONSE:
"""${response}"""

EXPECTED:
${JSON.stringify(c.expected, null, 2)}

The bot's editorial discipline: NEVER invent customers, capabilities, or URLs that don't appear in the RETRIEVED CONTEXT above. When a clean customer match exists, cite it. When no clean match exists, the bot MUST honestly say "I don't have a specific case study for this" (or equivalent) — that is a PASS, not a fail.

Score this response across the expected criteria. Return ONLY JSON:
{
  "structure_pass": boolean,
  "uncertainty_pass": boolean,
  "honesty_pass": boolean,${conveyJson}
  "overall_pass": boolean
}

Definitions:
- structure_pass: the response contains the expected sections in spirit. If expected.structure includes 'evidence', this passes when EITHER the response cites a customer that appears in the RETRIEVED CONTEXT OR explicitly acknowledges no specific case study is available. Both are valid behaviors. Minor truncation of a URL or sentence (e.g., a final token cut off) is acceptable — judge generously on structure.
- uncertainty_pass: only relevant if expected.must_express_uncertainty is true. Passes if the response honestly acknowledges scope limits — EITHER by saying "I'm not sure" / "let me flag this for the Dalgo team" / "I don't have specific info on that" OR by confidently and accurately stating Dalgo isn't designed for that use case (e.g., "Dalgo isn't a CRM" for a CRM-replacement question, "Dalgo isn't a payroll system" for a payroll question). Both kinds of answer are honest. FAILS only if the response gives false confidence about something Dalgo doesn't do (e.g., "Yes, Dalgo can replace Salesforce!" for a CRM question — that's hallucinating capability).
- honesty_pass: PASSES if every customer name, capability, or URL in the response can be found in or reasonably inferred from the RETRIEVED CONTEXT. FAILS only if the response invents something NOT supported by the retrieved context — e.g., a customer/URL/feature that doesn't appear there. Citing a customer that IS in the context is the CORRECT behavior, not a violation.${conveyLine}
- overall_pass: PASSES if you'd ship this response to a real NGO leader. A response that honestly says "I don't have a specific case study but here's how Dalgo would approach this..." passes. A response that fabricates customer details beyond the retrieved context fails.
`.trim();
};

export async function llmJudge(
  input: { case: EvalCase; response: string; retrievedPassages?: string[] },
  runs = 3,
): Promise<JudgeResult> {
  const passes: number[] = [];
  const voteSummaries: string[] = [];
  for (let i = 0; i < runs; i++) {
    const { text } = await generateText({
      model: anthropic(JUDGE_MODEL),
      prompt: RUBRIC(input.case, input.response, input.retrievedPassages ?? []),
      maxTokens: 200,
    });
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        // No JSON found — this is a JUDGE failure (likely truncated/prose
        // output), NOT necessarily a bad answer. Surface it distinctly so a
        // 0/N doesn't masquerade as a genuine content failure.
        passes.push(0);
        voteSummaries.push(`v${i + 1}:PARSE-FAIL(no-json:"${text.slice(0, 40).replace(/\s+/g, ' ')}")`);
        continue;
      }
      const parsed = JSON.parse(match[0]);
      const ok =
        (input.case.expected.structure ? parsed.structure_pass : true) &&
        (input.case.expected.must_express_uncertainty ? parsed.uncertainty_pass : true) &&
        (input.case.expected.answer_must_convey ? parsed.convey_pass : true) &&
        parsed.honesty_pass &&  // ← honesty is always required
        parsed.overall_pass;
      passes.push(ok ? 1 : 0);
      // Record which sub-criteria the vote saw, so a failure names its cause.
      const flags = [
        `struct=${parsed.structure_pass}`,
        `unc=${parsed.uncertainty_pass}`,
        `hon=${parsed.honesty_pass}`,
        ...(input.case.expected.answer_must_convey ? [`convey=${parsed.convey_pass}`] : []),
        `overall=${parsed.overall_pass}`,
      ].join(' ');
      voteSummaries.push(`v${i + 1}:${ok ? 'PASS' : 'FAIL'}(${flags})`);
    } catch (e) {
      passes.push(0);
      voteSummaries.push(`v${i + 1}:PARSE-FAIL(exception:${String(e).slice(0, 40)})`);
    }
  }
  const total = passes.reduce((a, b) => a + b, 0);
  return {
    pass: total >= Math.ceil(runs / 2),
    notes: `LLM-judge ${total}/${runs} passes | ${voteSummaries.join(' · ')}`,
  };
}
