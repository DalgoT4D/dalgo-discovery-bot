import { anthropic } from '@/lib/llm/client';
import { generateText } from 'ai';

export interface HydeRewrites {
  problem_query: string;
  capability_query: string;
  evidence_query: string;
}

export interface HydeDeps {
  generate?: (prompt: string) => Promise<string>;
}

const HYDE_MODEL = 'claude-haiku-4-5-20251001';

const PROMPT = (userMsg: string) => `
You are preparing a retrieval query for a search engine that answers NGO questions about Dalgo (a data platform for NGOs).

The user said:
"""${userMsg}"""

Rewrite this into THREE search queries, returned as JSON:
1. "problem_query": how an NGO might describe the same problem in clearer terms
2. "capability_query": what Dalgo capability would address this
3. "evidence_query": a hypothetical headline of a customer story that matches

Return ONLY valid JSON with these three keys. No prose.
`.trim();

async function defaultGenerate(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(HYDE_MODEL),
    prompt,
    maxTokens: 300,
  });
  return text;
}

export async function rewriteQuery(userMsg: string, deps: HydeDeps = {}): Promise<HydeRewrites> {
  const generate = deps.generate ?? defaultGenerate;
  const fallback: HydeRewrites = {
    problem_query: userMsg,
    capability_query: userMsg,
    evidence_query: userMsg,
  };
  try {
    const raw = await generate(PROMPT(userMsg));
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);
    return {
      problem_query: parsed.problem_query ?? userMsg,
      capability_query: parsed.capability_query ?? userMsg,
      evidence_query: parsed.evidence_query ?? userMsg,
    };
  } catch {
    return fallback;
  }
}
