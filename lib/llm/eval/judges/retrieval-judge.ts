// lib/llm/eval/judges/retrieval-judge.ts
import type { EvalCase } from '../cases/types';
import type { RetrievalTrace } from '@/lib/llm/rag/pipeline';

export interface JudgeResult {
  pass: boolean;
  notes: string;
}

export interface RetrievalJudgeInput {
  case: EvalCase;
  response: string;
  trace: RetrievalTrace;
}

export async function retrievalJudge(input: RetrievalJudgeInput): Promise<JudgeResult> {
  const checks: string[] = [];
  let pass = true;

  // must_cite_one_of: at least one expected URL appears in the response
  if (input.case.expected.must_cite_one_of) {
    const found = input.case.expected.must_cite_one_of.some((u) => input.response.includes(u));
    if (!found) {
      pass = false;
      checks.push(`missing required citation (one of ${input.case.expected.must_cite_one_of.length} URLs)`);
    }
  }

  // must_not_hallucinate_urls: every URL in the response was in the candidate set or
  // appears on the projecttech4dev.org domain
  if (input.case.expected.must_not_hallucinate_urls) {
    const urlsInResponse = Array.from(input.response.matchAll(/https?:\/\/[^\s)]+/g)).map((m) =>
      m[0].replace(/[.)]+$/, ''),
    );
    const candidateUrls = new Set<string>();
    for (const c of [
      ...input.trace.candidates.blogs,
      ...input.trace.candidates.patterns,
      ...input.trace.candidates.kb,
    ]) {
      for (const m of c.preview.matchAll(/https?:\/\/[^\s)]+/g)) {
        candidateUrls.add(m[0]);
      }
    }
    for (const u of urlsInResponse) {
      const matchesCandidate = Array.from(candidateUrls).some((cu) =>
        cu.startsWith(u) || u.startsWith(cu),
      );
      if (!matchesCandidate) {
        // Slack: allow URLs on the projecttech4dev.org domain even if not in
        // candidate previews (the pattern evidence URLs are in candidates but
        // may not have been extracted from preview text).
        if (!u.startsWith('https://projecttech4dev.org/')) {
          pass = false;
          checks.push(`hallucinated URL: ${u}`);
        }
      }
    }
  }

  // matched_pattern: top RRF result includes pattern_curated source (proxy — we don't
  // have archetype slug exposed in the trace's preview, but we can verify a curated
  // pattern surfaced at all)
  if (input.case.expected.matched_pattern) {
    const hasPattern = input.trace.fused_top12.some((c) => c.source === 'pattern_curated');
    if (!hasPattern) {
      pass = false;
      checks.push('no pattern_curated source in fused top 12');
    }
  }

  return { pass, notes: checks.join('; ') || 'all retrieval checks passed' };
}
