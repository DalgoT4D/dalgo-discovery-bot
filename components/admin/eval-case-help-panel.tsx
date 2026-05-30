'use client';
import { useState } from 'react';
import {
  JUDGE_META,
  getExamplesForJudge,
  type JudgeKey,
  type ExampleCase,
} from '@/lib/eval-case-templates';

const ALL_JUDGE_KEYS: JudgeKey[] = ['retrieval-judge', 'llm-judge', 'exact-match'];

interface Props {
  judges: string[];
  bucket: string;
  /** The last-toggled-on judge. Drives which section is shown. */
  activeJudge: string | null;
  onLoadExample: (example: ExampleCase) => void;
}

export function EvalCaseHelpPanel({ judges, activeJudge, onLoadExample }: Props) {
  const [showAll, setShowAll] = useState(false);

  const focusJudge: JudgeKey | null =
    activeJudge && isJudgeKey(activeJudge)
      ? activeJudge
      : (judges.find(isJudgeKey) as JudgeKey | undefined) ?? null;

  return (
    <aside className="space-y-4 text-sm md:sticky md:top-4 md:self-start">
      <div className="rounded border border-border bg-muted/30 p-4 space-y-3">
        {focusJudge ? (
          <JudgeHelpSection judge={focusJudge} onLoadExample={onLoadExample} />
        ) : (
          <p className="text-muted-foreground">
            Pick a bucket and judges to see authoring help here.
          </p>
        )}
      </div>

      <button
        type="button"
        className="text-xs underline text-muted-foreground"
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? 'Hide full judge reference' : 'Show all judges'}
      </button>

      {showAll && (
        <div className="space-y-4">
          {ALL_JUDGE_KEYS.map((j) => (
            <div key={j} className="rounded border border-border p-3">
              <h4 className="font-mono text-sm mb-1">{j}</h4>
              <p className="text-xs text-muted-foreground mb-2">{JUDGE_META[j].description}</p>
              <ul className="text-xs space-y-1">
                {JUDGE_META[j].fields.map((f) => (
                  <li key={f.key}>
                    <span className="font-mono">{f.key}</span> — {f.helpText}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function JudgeHelpSection({
  judge,
  onLoadExample,
}: {
  judge: JudgeKey;
  onLoadExample: (example: ExampleCase) => void;
}) {
  const meta = JUDGE_META[judge];
  const examples = getExamplesForJudge(judge);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-mono text-sm">{judge}</h3>
        <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Fields it uses
        </h4>
        <ul className="space-y-1 text-xs">
          {meta.fields.map((f) => (
            <li key={f.key}>
              <span className="font-medium">{f.label}</span>
              {f.advisory && (
                <span className="ml-1 rounded bg-muted px-1 text-[10px]">advisory</span>
              )}
              <span className="block text-muted-foreground">{f.helpText}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Examples
        </h4>
        <div className="space-y-2">
          {examples.map((e) => (
            <div key={e.id} className="rounded border border-border bg-background p-2 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono">
                  {e.id} <span className="text-muted-foreground">({e.bucket})</span>
                </span>
                <button
                  type="button"
                  onClick={() => onLoadExample(e)}
                  className="text-xs underline"
                >
                  Load this example
                </button>
              </div>
              <p className="italic mb-1">&quot;{e.input}&quot;</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-muted/30 p-1 rounded">
                {JSON.stringify(e.expected, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function isJudgeKey(s: string): s is JudgeKey {
  return s === 'retrieval-judge' || s === 'llm-judge' || s === 'exact-match';
}
