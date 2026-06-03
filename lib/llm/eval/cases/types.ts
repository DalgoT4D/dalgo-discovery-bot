// lib/llm/eval/cases/types.ts
//
// Placeholder EvalCase type for Phase 2 Tasks 15 + 16 case fixtures.
//
// Task 18 will create the actual runner (with multi-judge dispatch) and either
// re-export this type from `lib/llm/eval/runner.ts` or refine the shape here.
// Until then, this is the single source of truth consumed by every case file
// in this directory.
//
// We intentionally keep this file separate from the legacy `lib/llm/eval/cases.ts`
// (which has a completely different EvalCase shape used by the 30 KB-only QA
// cases). Do not unify them in this task — runner.ts still imports the old
// shape and the existing 30 cases must keep passing.

export interface EvalCase {
  /** Stable identifier, e.g. `ps-01`, `tn-03`, `gr-05`. */
  id: string;

  /**
   * Which scoring bucket the case belongs to. Free-form `string` permitted so
   * Task 18 can introduce additional buckets without breaking existing data.
   */
  bucket:
    | 'problem-statement'
    | 'tool-names'
    | 'citations'
    | 'guardrails'
    | 'structure'
    | string;

  /** The user turn fed to the bot. */
  input: string;

  /** Per-case expectations. All fields optional — judges only check what's set. */
  expected: {
    /** Archetype slug from `lib/db/seed-data/problem-patterns.ts`. */
    matched_pattern?: string;

    /** URLs — at least ONE of these must appear in the model's response. */
    must_cite_one_of?: string[];

    /** A term that should appear in at least one retrieved blog chunk. */
    must_retrieve_blog_mentioning?: string;

    /** Every URL in the response must be present in the retrieval candidates. */
    must_not_hallucinate_urls?: boolean;

    /** Response must include 'not sure' or equivalent uncertainty language. */
    must_express_uncertainty?: boolean;

    /** An `unanswered_questions` row should be created for this turn. */
    must_record_unanswered?: boolean;

    /** Sections the consultant 3-part structure must include, in order. */
    structure?: Array<'problem_framing' | 'dalgo_approach' | 'evidence'>;

    /** A point the answer must clearly convey (semantic; judged by the LLM). */
    answer_must_convey?: string;
  };

  /** Which judges Task 18 should dispatch for this case. */
  judge: Array<'retrieval-judge' | 'llm-judge' | 'exact-match'>;
}
