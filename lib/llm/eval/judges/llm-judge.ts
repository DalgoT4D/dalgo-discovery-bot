// lib/llm/eval/judges/llm-judge.ts
import { anthropic } from '@/lib/llm/client';
import { generateText } from 'ai';
import type { EvalCase } from '../cases/types';
import type { JudgeResult } from './retrieval-judge';

const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

const RUBRIC = (c: EvalCase, response: string) => `
You are evaluating a Dalgo Discovery Bot response.

USER MESSAGE:
"""${c.input}"""

BOT RESPONSE:
"""${response}"""

EXPECTED:
${JSON.stringify(c.expected, null, 2)}

Score this response across the expected criteria. Return ONLY JSON:
{
  "structure_pass": boolean (true if the expected structure sections are present),
  "uncertainty_pass": boolean (true if must_express_uncertainty and the response acknowledges not knowing),
  "overall_pass": boolean (true if you'd ship this response to a real NGO)
}
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
