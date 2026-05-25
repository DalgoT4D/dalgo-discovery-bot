// lib/llm/eval/runner.ts
//
// Two dispatch paths live here side-by-side:
//
//   1. LEGACY (`runLegacyOne` / `runLegacyAll`) — runs the original 30 KB-only
//      QA cases (`legacyEvalCases` from `./cases.ts`). These go through the
//      full chat pipeline (`generateText` + tools) and check KB hits,
//      forbidden phrases, etc. Used by `tests/llm/eval.test.ts`.
//
//   2. NEW (`runOne` / `runAll`) — runs the 50 Phase-2 cases (problem
//      statements, tool names, citations, guardrails, structure) defined under
//      `./cases/*.ts`. These bypass the chat handler, call `runPipeline`
//      directly to get retrieval + a synthesised answer, then dispatch to the
//      three judges (retrieval-judge, llm-judge, exact-match) per-case.
//
// Both paths share nothing except imports — the legacy shape and the new
// shape are intentionally distinct. See `./cases.ts` for the legacy
// `LegacyEvalCase` type and `./cases/types.ts` for the new `EvalCase` type.

import { randomUUID } from 'node:crypto';
import { generateText } from 'ai';
import { anthropic, MODEL } from '@/lib/llm/client';
import { buildSystemPrompt, staticSystem } from '@/lib/llm/system-prompt';
import { buildToolset } from '@/lib/llm/tools';
import { createSession } from '@/lib/db/queries/sessions';
import { query } from '@/lib/db/client';
import { runPipeline } from '@/lib/llm/rag/pipeline';

import { legacyEvalCases, type LegacyEvalCase } from './cases';
import { problemStatementCases } from './cases/problem-statements';
import { toolNameCases } from './cases/tool-names';
import { citationCases } from './cases/citations';
import { guardrailCases } from './cases/guardrails';
import { structureCases } from './cases/structure';
import type { EvalCase } from './cases/types';
import { retrievalJudge } from './judges/retrieval-judge';
import { llmJudge } from './judges/llm-judge';
import { exactMatchJudge } from './judges/exact-match';
import type { JudgeResult } from './judges/retrieval-judge';

// Re-export the new EvalCase shape so downstream code can import from a
// single path. The legacy shape stays in `./cases.ts`.
export type { EvalCase } from './cases/types';
export type { LegacyEvalCase } from './cases';

// ---------------------------------------------------------------------------
// LEGACY RUNNER (30 KB-only cases) — unchanged behaviour, renamed exports
// ---------------------------------------------------------------------------

export interface EvalResult {
  case_id: string;
  passed: boolean;
  reasons: string[];
  transcript: string;
}

export async function runLegacyOne(c: LegacyEvalCase): Promise<EvalResult> {
  const session = await createSession({
    ngo_systems: c.ngoContext?.ngo_systems,
    data_types: c.ngoContext?.data_types,
  });
  const result = await generateText({
    model: anthropic(MODEL),
    system: buildSystemPrompt({
      ngo_summary: null,
      ngo_systems: c.ngoContext?.ngo_systems ?? null,
      data_types: c.ngoContext?.data_types ?? null,
    }),
    tools: buildToolset(session.id),
    maxSteps: 4,
    messages: [{ role: 'user', content: c.message }],
  });

  const reasons: string[] = [];
  const text = (result.text ?? '').toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: any[] = (result as any).steps ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allToolCalls = steps.flatMap((s: any) => s.toolCalls ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calledKb = allToolCalls.some((tc: any) => tc.toolName === 'search_dalgo_kb');
  if (!c.id.startsWith('oos-') && !calledKb) {
    reasons.push('did not call search_dalgo_kb');
  }

  if (c.expectKbHitContains) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allHits = steps.flatMap((s: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s.toolResults ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((tr: any) => tr.toolName === 'search_dalgo_kb')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((tr: any) => tr.result?.hits ?? []),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matched = allHits.some((h: any) =>
      h.question?.toLowerCase().includes(c.expectKbHitContains!.toLowerCase()),
    );
    if (!matched) reasons.push(`expected KB hit containing "${c.expectKbHitContains}"`);
  }

  for (const phrase of c.forbiddenPhrases ?? []) {
    if (text.includes(phrase.toLowerCase())) reasons.push(`forbidden phrase found: "${phrase}"`);
  }

  return {
    case_id: c.id,
    passed: reasons.length === 0,
    reasons,
    transcript: result.text ?? '',
  };
}

export async function runLegacyAll(): Promise<EvalResult[]> {
  const out: EvalResult[] = [];
  for (const c of legacyEvalCases) {
    try {
      out.push(await runLegacyOne(c));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out.push({ case_id: c.id, passed: false, reasons: [`error: ${msg}`], transcript: '' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// NEW RUNNER (50 Phase-2 cases) — multi-judge dispatch
// ---------------------------------------------------------------------------

const ALL: EvalCase[] = [
  ...problemStatementCases,
  ...toolNameCases,
  ...citationCases,
  ...guardrailCases,
  ...structureCases,
];

const SYNTH_MODEL = 'claude-sonnet-4-6';

export interface RunResult {
  id: string;
  bucket: string;
  pass: boolean;
  judgeResults: JudgeResult[];
}

async function synthesizeAnswer(
  c: EvalCase,
  topPassages: { text: string }[],
): Promise<string> {
  const augmented = `${staticSystem()}\n\n## Retrieved context for this turn\n${topPassages
    .map((p) => p.text)
    .join('\n\n---\n\n')}`;
  const { text } = await generateText({
    model: anthropic(SYNTH_MODEL),
    system: augmented,
    prompt: c.input,
    maxTokens: 1500,
  });
  return text;
}

async function ensureSessionExists(sessionId: string): Promise<void> {
  await query(
    `INSERT INTO sessions (id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [sessionId],
  );
}

export async function runOne(c: EvalCase): Promise<RunResult> {
  const sessionId = randomUUID();
  await ensureSessionExists(sessionId);
  const pipe = await runPipeline(c.input);
  const response = await synthesizeAnswer(c, pipe.topPassages);

  // Approximate the production app's "unanswered" path: if the top fused score
  // is below threshold OR the response volunteered uncertainty language, write
  // an `unanswered_questions` row so `exactMatchJudge` can verify it.
  const topScore = pipe.trace.fused_top12[0]?.score ?? 0;
  const looksUncertain = /not sure|don't have|flag .* team|would need to check/i.test(response);
  if (topScore < 0.05 || looksUncertain) {
    await query(
      `INSERT INTO unanswered_questions (question, session_id) VALUES ($1, $2)`,
      [c.input, sessionId],
    );
  }

  const judgeResults: JudgeResult[] = [];
  for (const j of c.judge) {
    try {
      if (j === 'retrieval-judge') {
        judgeResults.push(await retrievalJudge({ case: c, response, trace: pipe.trace }));
      } else if (j === 'llm-judge') {
        judgeResults.push(await llmJudge({
          case: c,
          response,
          retrievedPassages: pipe.topPassages.map((p) => p.text),
        }));
      } else if (j === 'exact-match') {
        judgeResults.push(await exactMatchJudge({ case: c, sessionId }));
      }
    } catch (e) {
      judgeResults.push({ pass: false, notes: `judge error: ${String(e)}` });
    }
  }

  return {
    id: c.id,
    bucket: c.bucket,
    pass: judgeResults.every((j) => j.pass),
    judgeResults,
  };
}

export async function runAll(): Promise<RunResult[]> {
  const out: RunResult[] = [];
  for (const c of ALL) {
    try {
      const r = await runOne(c);
      out.push(r);
      // eslint-disable-next-line no-console
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${c.id} (${c.bucket})`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`FAIL ${c.id} ERROR:`, e);
      out.push({
        id: c.id,
        bucket: c.bucket,
        pass: false,
        judgeResults: [{ pass: false, notes: `runOne threw: ${String(e)}` }],
      });
    }
  }
  return out;
}
