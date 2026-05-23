import { generateText } from 'ai';
import { anthropic, MODEL } from './client';
import { query } from '@/lib/db/client';

export interface Intro {
  learned: string;       // 1-sentence "Here's what I learned about you"
  starters: string[];    // 3-4 personalized starter questions
}

const FALLBACK: Intro = {
  learned: '',
  starters: [
    'What data sources does Dalgo support?',
    'How does Dalgo help with M&E reporting?',
    'Is Dalgo free for NGOs?',
  ],
};

/**
 * Generate a personalized intro using whatever context we have about the NGO.
 * Cached to sessions.intro_text + sessions.intro_starters so we only call the
 * LLM once per session.
 */
export async function getOrCreateIntro(sessionId: string): Promise<Intro> {
  const { rows } = await query<{
    intro_text: string | null;
    intro_starters: string[] | null;
    ngo_url: string | null;
    ngo_summary: string | null;
    ngo_systems: string | null;
    data_types: string[] | null;
  }>(
    `SELECT intro_text, intro_starters, ngo_url, ngo_summary, ngo_systems, data_types
     FROM sessions WHERE id = $1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return FALLBACK;

  if (row.intro_text || (row.intro_starters && row.intro_starters.length > 0)) {
    return {
      learned: row.intro_text ?? '',
      starters: row.intro_starters && row.intro_starters.length > 0
        ? row.intro_starters
        : FALLBACK.starters,
    };
  }

  const hasContext =
    Boolean(row.ngo_summary) ||
    Boolean(row.ngo_systems) ||
    (row.data_types && row.data_types.length > 0);

  if (!hasContext) {
    // No NGO context at all — use generic starters, don't burn LLM tokens
    await query('UPDATE sessions SET intro_starters = $1 WHERE id = $2', [FALLBACK.starters, sessionId]);
    return FALLBACK;
  }

  // Generate personalized intro via Claude
  const contextBlock = [
    row.ngo_url ? `URL: ${row.ngo_url}` : null,
    row.ngo_summary ? `Website summary:\n${row.ngo_summary.slice(0, 2000)}` : null,
    row.ngo_systems ? `Systems they mentioned: ${row.ngo_systems}` : null,
    row.data_types?.length ? `Data types: ${row.data_types.join(', ')}` : null,
  ].filter(Boolean).join('\n\n');

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      system: `You help NGOs evaluate whether Dalgo (a data platform built for NGOs by Tech4Dev) fits their needs.

Given some context about an NGO, produce strict JSON with two keys:
  - "learned": ONE friendly sentence (max 30 words) summarizing what the NGO appears to do, based on the context. Use "you" / "your team". If the website context is sparse, just acknowledge it briefly.
  - "starters": EXACTLY 3 short question suggestions (each under 14 words) the NGO might want to ask about Dalgo, made *specific to their work*. Examples should reference their actual programs/tech stack where possible, not generic placeholders.

Output JSON only, no prose, no code fences.`,
      messages: [{ role: 'user', content: `NGO context:\n\n${contextBlock}` }],
    });

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as { learned?: string; starters?: string[] };
    const intro: Intro = {
      learned: typeof parsed.learned === 'string' ? parsed.learned : '',
      starters:
        Array.isArray(parsed.starters) && parsed.starters.length > 0
          ? parsed.starters.slice(0, 4).map(String)
          : FALLBACK.starters,
    };

    await query(
      'UPDATE sessions SET intro_text = $1, intro_starters = $2 WHERE id = $3',
      [intro.learned, intro.starters, sessionId],
    );
    return intro;
  } catch (e) {
    console.error('intro generation failed', e);
    return FALLBACK;
  }
}
