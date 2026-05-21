import { generateText } from 'ai';
import { anthropic, MODEL } from '@/lib/llm/client';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { buildToolset } from '@/lib/llm/tools';
import { evalCases, type EvalCase } from './cases';
import { createSession } from '@/lib/db/queries/sessions';

export interface EvalResult {
  case_id: string;
  passed: boolean;
  reasons: string[];
  transcript: string;
}

export async function runOne(c: EvalCase): Promise<EvalResult> {
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

export async function runAll(): Promise<EvalResult[]> {
  const out: EvalResult[] = [];
  for (const c of evalCases) {
    try {
      out.push(await runOne(c));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      out.push({ case_id: c.id, passed: false, reasons: [`error: ${msg}`], transcript: '' });
    }
  }
  return out;
}
