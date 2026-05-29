import { anthropic } from '@/lib/llm/client';
import { generateText } from 'ai';

export interface RerankCandidate {
  id: string;
  text: string;
}

export interface RerankResult extends RerankCandidate {
  rerankScore: number;
}

export interface RerankOpts {
  query: string;
  candidates: RerankCandidate[];
  topK?: number;
  generate?: (prompt: string) => Promise<string>;
}

const RERANK_MODEL = 'claude-haiku-4-5-20251001';

const PROMPT = (query: string, candidates: RerankCandidate[]) => `
You are scoring search results.

USER QUERY:
"""${query}"""

For each passage below, score 0–5 for relevance to the user's intent:
- 0 = irrelevant
- 3 = somewhat relevant
- 5 = highly relevant

PASSAGES:
${candidates.map((c) => `[id=${c.id}] ${c.text.slice(0, 800)}`).join('\n\n---\n\n')}

Return ONLY a JSON array: [{"id":"...","score":N}, ...]. No prose.
`.trim();

async function defaultGenerate(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(RERANK_MODEL),
    prompt,
    maxTokens: 400,
  });
  return text;
}

export async function rerankCandidates(opts: RerankOpts): Promise<RerankResult[]> {
  const generate = opts.generate ?? defaultGenerate;
  const topK = opts.topK ?? 5;
  const scores = new Map<string, number>();
  try {
    const raw = await generate(PROMPT(opts.query, opts.candidates));
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Array<{ id: string; score: number }>;
      for (const s of parsed) scores.set(s.id, s.score);
    }
  } catch {
    // fall through — scores empty → all 0, original order preserved
  }
  const result: RerankResult[] = opts.candidates.map((c) => ({
    ...c,
    rerankScore: scores.get(c.id) ?? 0,
  }));
  result.sort((a, b) => b.rerankScore - a.rerankScore);
  return result.slice(0, topK);
}
