// lib/blogs/contextualizer.ts
import { generateText } from 'ai';
import { anthropic } from '@/lib/llm/client';
import type { ParsedArticle } from './types';

export interface ContextualizerDeps {
  generate?: (prompt: string) => Promise<string>;
}

// Model ID for Claude Haiku 4.5 — cheaper than Sonnet for bulk article summarization.
const CONTEXTUALIZER_MODEL = 'claude-haiku-4-5-20251001';

const PROMPT_TEMPLATE = (a: ParsedArticle) => `
You are summarizing a Tech4Dev blog post for a search index.
Write ONE sentence (max 30 words) that situates a reader. Mention:
- who the NGO or subject is,
- what the post is about,
- why a prospective NGO would care.
No marketing fluff. Plain declarative sentence ending with a period.

TITLE: ${a.title}

CONTENT (first 1500 chars):
${a.contentMd.slice(0, 1500)}

Return ONLY the sentence, nothing else.
`.trim();

async function defaultGenerate(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(CONTEXTUALIZER_MODEL),
    prompt,
    maxTokens: 80,
  });
  return text;
}

export async function generateArticleContext(
  article: ParsedArticle,
  deps: ContextualizerDeps = {},
): Promise<string> {
  const generate = deps.generate ?? defaultGenerate;
  const raw = await generate(PROMPT_TEMPLATE(article));
  return raw.trim();
}
