// lib/llm/eval/judges/llm-judge.ts
import { anthropic } from '@/lib/llm/client';
import { generateText } from 'ai';
import type { EvalCase } from '../cases/types';
import type { JudgeResult } from './retrieval-judge';

const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

const RUBRIC = (c: EvalCase, response: string) => `
You are evaluating a Dalgo Discovery Bot response to an NGO question.

USER MESSAGE:
"""${c.input}"""

BOT RESPONSE:
"""${response}"""

EXPECTED:
${JSON.stringify(c.expected, null, 2)}

The bot's editorial discipline: NEVER invent customers, capabilities, or URLs. When a clean customer match exists in retrieval, cite it. When no clean match exists, the bot MUST honestly say "I don't have a specific case study for this" (or equivalent) — that is a PASS, not a fail.

Score this response across the expected criteria. Return ONLY JSON:
{
  "structure_pass": boolean,
  "uncertainty_pass": boolean,
  "honesty_pass": boolean,
  "overall_pass": boolean
}

Definitions:
- structure_pass: the response contains the expected sections in spirit. If expected.structure includes 'evidence', this passes when EITHER the response cites a real customer (with URL) OR explicitly acknowledges no specific case study is available. Both are valid behaviors.
- uncertainty_pass: only relevant if expected.must_express_uncertainty is true. Passes if the response acknowledges not knowing or out-of-scope status.
- honesty_pass: PASSES unless the response invents customer names, capabilities, or URLs that aren't grounded in the retrieved context. FAILS if it fakes a connection ("Bhumi did X" when Bhumi case study doesn't actually say X).
- overall_pass: PASSES if you'd ship this response to a real NGO leader. A response that honestly says "I don't have a specific case study but here's how Dalgo would approach this..." passes. A response that fabricates customer details fails.
`.trim();

export async function llmJudge(
  input: { case: EvalCase; response: string },
  runs = 3,
): Promise<JudgeResult> {
  const passes: number[] = [];
  for (let i = 0; i < runs; i++) {
    const { text } = await generateText({
      model: anthropic(JUDGE_MODEL),
      prompt: RUBRIC(input.case, input.response),
      maxTokens: 200,
    });
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        passes.push(0);
        continue;
      }
      const parsed = JSON.parse(match[0]);
      const ok =
        (input.case.expected.structure ? parsed.structure_pass : true) &&
        (input.case.expected.must_express_uncertainty ? parsed.uncertainty_pass : true) &&
        parsed.honesty_pass &&  // ← honesty is always required
        parsed.overall_pass;
      passes.push(ok ? 1 : 0);
    } catch {
      passes.push(0);
    }
  }
  const total = passes.reduce((a, b) => a + b, 0);
  return {
    pass: total >= Math.ceil(runs / 2),
    notes: `LLM-judge ${total}/${runs} passes`,
  };
}
