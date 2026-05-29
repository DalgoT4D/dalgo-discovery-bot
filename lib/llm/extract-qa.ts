import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export interface QaPair {
  question: string;
  variants: string[];
  answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  evidence: string[];
}

export interface ExtractOpts {
  category?: string;
}

export async function extractQaPairs(text: string, opts: ExtractOpts = {}): Promise<{ pairs: QaPair[] }> {
  const trimmed = text.trim();
  if (trimmed.length < 30) return { pairs: [] };

  const prompt = `You are organizing knowledge for a chatbot that helps NGO leaders evaluate Dalgo.

Extract self-contained Q&A entries from the SOURCE TEXT below. NGO leaders might naturally ask each question. Each answer must be ONLY from the source — do not invent facts.

For each entry, return:
- question: the canonical phrasing (most natural single question)
- variants: 2-4 alternative phrasings users might use
- answer: the answer written in the bot's voice (warm, professional, concise)
- status: "yes" if Dalgo supports it, "no" if it explicitly doesn't, "partial" for partial support, "roadmap" if planned
- evidence: any URLs from the source that support this entry (can be empty)

Return JSON in this exact shape:
{ "pairs": [ { "question": "...", "variants": ["..."], "answer": "...", "status": "yes", "evidence": ["https://..."] } ] }

If the source text is vague, garbled, or doesn't contain extractable factual content, return { "pairs": [] }.

Category context: ${opts.category ?? 'general'}

SOURCE TEXT:
"""
${trimmed}
"""

Return ONLY the JSON object, no prose, no markdown fences.`;

  const { text: response } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxTokens: 4000,
  });

  // Strip markdown fences if the model added them despite instructions
  const cleaned = response
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { pairs?: QaPair[] };
    if (!Array.isArray(parsed.pairs)) return { pairs: [] };
    // Sanity filter — drop entries missing core fields
    const pairs = parsed.pairs.filter(
      (p) =>
        typeof p.question === 'string' && p.question.length > 0 &&
        typeof p.answer === 'string' && p.answer.length > 0,
    );
    return { pairs };
  } catch {
    return { pairs: [] };
  }
}
