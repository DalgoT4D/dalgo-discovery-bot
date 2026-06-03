// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for one-line HyDE revert
import { rewriteQuery, type HydeRewrites } from './hyde';
import { runHybridRetrieval, type Candidate } from './hybrid';
import { fuseRrf } from './rrf';
import { rerankCandidates, type RerankResult } from './rerank';

export interface RetrievalTrace {
  hyde: HydeRewrites;
  candidates: {
    kb:       Array<{ id: string; preview: string }>;
    patterns: Array<{ id: string; preview: string }>;
    blogs:    Array<{ id: string; preview: string }>;
  };
  fused_top12: Array<{ id: string; score: number; source: string; preview: string }>;
  rerank_scores: Array<{ id: string; score: number }>;
  final_context_ids: string[];
}

export interface PipelineResult {
  topPassages: Array<{
    id: string;
    source: 'kb_curated' | 'pattern_curated' | 'blog';
    text: string;          // what we put into the model's context
    url?: string;          // citation URL when applicable
    raw: any;              // original hit (kb / pattern / chunk)
  }>;
  trace: RetrievalTrace;
}

function preview(c: Candidate): string {
  if (c.source === 'kb_curated') return c.kb.canonical_answer.slice(0, 120);
  if (c.source === 'pattern_curated') return c.pattern.consultant_framing.slice(0, 120);
  return c.chunk.chunk_text.slice(0, 120);
}

function candidateText(c: Candidate): string {
  if (c.source === 'kb_curated') {
    return `[Curated KB · ${c.kb.category}]\nQ: ${c.kb.question_variants[0]}\nA: ${c.kb.canonical_answer}`;
  }
  if (c.source === 'pattern_curated') {
    return `[Problem pattern · ${c.pattern.archetype}]\nFraming: ${c.pattern.consultant_framing}\nDalgo response: ${c.pattern.dalgo_response}\nEvidence: ${c.pattern.evidence_urls.join(', ')}`;
  }
  return `[Blog: ${c.chunk.article_title}]\n${c.chunk.chunk_text}\nSource: ${c.chunk.article_url}`;
}

function candidateUrl(c: Candidate): string | undefined {
  if (c.source === 'blog') return c.chunk.article_url;
  if (c.source === 'pattern_curated') return c.pattern.evidence_urls[0];
  return c.kb.evidence?.[0];
}

export async function runPipeline(userMsg: string): Promise<PipelineResult> {
  // HyDE disabled — it added a Haiku call on the critical path and tripled the
  // number of searches for marginal benefit at our corpus size. We bypass it by
  // feeding the raw user message into all three query slots. `rewriteQuery` is
  // intentionally kept (imported above) so this is a one-line revert.
  // const hyde = await rewriteQuery(userMsg);
  const hyde: HydeRewrites = {
    problem_query: userMsg,
    capability_query: userMsg,
    evidence_query: userMsg,
  };
  const hybrid = await runHybridRetrieval(hyde);

  const allLists: Candidate[][] = [
    ...hybrid.kb_vector_lists,    ...hybrid.kb_lexical_lists,
    ...hybrid.pattern_vector_lists, ...hybrid.pattern_lexical_lists,
    ...hybrid.blog_vector_lists,  ...hybrid.blog_lexical_lists,
  ];

  const fused = fuseRrf({
    lists: allLists,
    k: 60,
    boostBySource: { kb_curated: 1.5, pattern_curated: 1.5 },
    topK: 12,
  });

  // LLM rerank disabled — it was an extra Haiku call on the critical path that
  // took ~4.7s to reorder 12 short passages, blocking the first token. RRF
  // fusion above already produces a ranked, source-boosted list; we feed Sonnet
  // the fused top-7 directly and let it judge relevance itself. Validated on the
  // legacy eval suite: rerank-on = 25/30, fused top-7 = 26/30 — i.e. dropping
  // the reranker is both ~4.7s faster AND slightly higher quality (the wider
  // slice recovers entries the reranker had trimmed). `rerankCandidates` is kept
  // (imported) for a one-line revert; flip USE_RERANK to restore it.
  const USE_RERANK = false;
  const NO_RERANK_TOPK = 7;
  const rerankInput = fused.map(f => ({ id: f.item.id, text: candidateText(f.item) }));
  const reranked: RerankResult[] = USE_RERANK
    ? await rerankCandidates({ query: userMsg, candidates: rerankInput, topK: 5 })
    : fused.slice(0, NO_RERANK_TOPK).map((f, i) => ({
        id: f.item.id,
        text: candidateText(f.item),
        rerankScore: fused.length - i, // preserve RRF order as descending score
      }));

  const fusedById = new Map(fused.map(f => [f.item.id, f.item]));
  const topPassages = reranked
    .map(r => {
      const c = fusedById.get(r.id);
      if (!c) return null;
      return {
        id: r.id,
        source: c.source,
        text: candidateText(c),
        url: candidateUrl(c),
        raw: c,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const trace: RetrievalTrace = {
    hyde,
    candidates: {
      kb:       hybrid.kb_vector_lists.flat().slice(0, 12).map(c => ({ id: c.id, preview: preview(c) })),
      patterns: hybrid.pattern_vector_lists.flat().slice(0, 12).map(c => ({ id: c.id, preview: preview(c) })),
      blogs:    hybrid.blog_vector_lists.flat().slice(0, 12).map(c => ({ id: c.id, preview: preview(c) })),
    },
    fused_top12: fused.map(f => ({
      id: f.item.id,
      score: f.score,
      source: f.item.source!,
      preview: preview(f.item),
    })),
    rerank_scores: reranked.map(r => ({ id: r.id, score: r.rerankScore })),
    final_context_ids: topPassages.map(p => p.id),
  };

  return { topPassages, trace };
}
