// lib/llm/eval/judges/exact-match.ts
import { query } from '@/lib/db/client';
import type { EvalCase } from '../cases/types';
import type { JudgeResult } from './retrieval-judge';

export async function exactMatchJudge(input: {
  case: EvalCase;
  sessionId: string;
}): Promise<JudgeResult> {
  if (input.case.expected.must_record_unanswered) {
    const { rows } = await query<{ c: number }>(
      'SELECT COUNT(*)::int AS c FROM unanswered_questions WHERE session_id = $1',
      [input.sessionId],
    );
    const ok = (rows[0]?.c ?? 0) > 0;
    return { pass: ok, notes: ok ? 'unanswered row created' : 'no unanswered row' };
  }
  return { pass: true, notes: 'no exact-match assertions in this case' };
}
