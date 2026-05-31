import { vectorSearchBlogs, lexicalSearchBlogs, type BlogChunkHit } from '@/lib/db/queries/blogs';
import { vectorSearchPatterns, lexicalSearchPatterns, type PatternHit } from '@/lib/db/queries/patterns';
import { searchKb, lexicalSearchKb, type KbHit, type KbLexicalHit } from '@/lib/db/queries/kb';
import type { HydeRewrites } from './hyde';

export type Candidate =
  | { source: 'kb_curated';      id: string; kb: KbHit | KbLexicalHit }
  | { source: 'pattern_curated'; id: string; pattern: PatternHit }
  | { source: 'blog';            id: string; chunk: BlogChunkHit };

export interface HybridResult {
  kb_vector_lists:       Candidate[][];
  kb_lexical_lists:      Candidate[][];
  pattern_vector_lists:  Candidate[][];
  pattern_lexical_lists: Candidate[][];
  blog_vector_lists:     Candidate[][];
  blog_lexical_lists:    Candidate[][];
}

const wrapKb = (h: KbHit | KbLexicalHit): Candidate => ({ source: 'kb_curated', id: h.id, kb: h });
const wrapPat = (h: PatternHit): Candidate => ({ source: 'pattern_curated', id: h.id, pattern: h });
const wrapBlog = (h: BlogChunkHit): Candidate => ({ source: 'blog', id: h.chunk_id, chunk: h });

export async function runHybridRetrieval(rewrites: HydeRewrites, topPerCall = 20): Promise<HybridResult> {
  // NOTE: HyDE is currently bypassed in runPipeline, so all three query slots
  // hold the same raw user message — these three searches are duplicates. It's
  // harmless (RRF dedups by id), just slightly redundant DB work. If HyDE stays
  // off long-term, dedupe identical queries here to cut the redundant calls.
  const queries = [rewrites.problem_query, rewrites.capability_query, rewrites.evidence_query];

  const tasks = queries.flatMap((q) => [
    searchKb(q, undefined, topPerCall).then((rs) => rs.map(wrapKb)),
    lexicalSearchKb(q, topPerCall).then((rs) => rs.map(wrapKb)),
    vectorSearchPatterns(q, Math.min(topPerCall, 10)).then((rs) => rs.map(wrapPat)),
    lexicalSearchPatterns(q, Math.min(topPerCall, 10)).then((rs) => rs.map(wrapPat)),
    vectorSearchBlogs(q, topPerCall).then((rs) => rs.map(wrapBlog)),
    lexicalSearchBlogs(q, topPerCall).then((rs) => rs.map(wrapBlog)),
  ]);

  const results = await Promise.all(tasks);

  // results layout: [kb_v_q1, kb_l_q1, pat_v_q1, pat_l_q1, blog_v_q1, blog_l_q1, kb_v_q2, ...]
  return {
    kb_vector_lists:       [results[0],  results[6],  results[12]],
    kb_lexical_lists:      [results[1],  results[7],  results[13]],
    pattern_vector_lists:  [results[2],  results[8],  results[14]],
    pattern_lexical_lists: [results[3],  results[9],  results[15]],
    blog_vector_lists:     [results[4],  results[10], results[16]],
    blog_lexical_lists:    [results[5],  results[11], results[17]],
  };
}
