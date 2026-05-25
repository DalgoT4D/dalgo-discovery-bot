// lib/llm/eval/report.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JudgeResult } from './judges/retrieval-judge';

export interface RunResult {
  id: string;
  bucket: string;
  pass: boolean;
  judgeResults: JudgeResult[];
}

export async function writeReport(results: RunResult[]): Promise<string> {
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const dir = 'docs/eval-runs';
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${ts}.md`);

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const buckets = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const b = buckets.get(r.bucket) ?? { pass: 0, total: 0 };
    b.total++;
    if (r.pass) b.pass++;
    buckets.set(r.bucket, b);
  }

  const lines = [
    `# Eval Run ${ts}`,
    ``,
    `Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`,
    ``,
    `## By bucket`,
    ``,
    ...Array.from(buckets.entries()).map(([b, s]) => `- ${b.padEnd(20)} ${s.pass}/${s.total}`),
    ``,
    `## Failures`,
    ``,
    ...results.filter((r) => !r.pass).map((r) => `- **${r.id}** (${r.bucket}): ${r.judgeResults.map((j) => j.notes).join('; ')}`),
  ];

  writeFileSync(path, lines.join('\n'), 'utf8');
  console.log(`[eval] report written to ${path}`);
  return path;
}
