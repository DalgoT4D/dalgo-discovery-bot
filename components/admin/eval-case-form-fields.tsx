'use client';
import { useState, type KeyboardEvent } from 'react';
import { JUDGE_META, type JudgeKey } from '@/lib/eval-case-templates';

interface Props {
  judges: string[];
  expected: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const STRUCTURE_SECTIONS = ['problem_framing', 'dalgo_approach', 'evidence'] as const;

export function EvalCaseFormFields({ judges, expected, onChange }: Props) {
  // Collect fields from active judges in stable order. Dedupe by key (no field
  // is owned by two judges today, but the dedupe is cheap insurance).
  const activeJudgeKeys = (Object.keys(JUDGE_META) as JudgeKey[]).filter((j) =>
    judges.includes(j),
  );
  const seen = new Set<string>();
  const fields = activeJudgeKeys.flatMap((j) =>
    JUDGE_META[j].fields.filter((f) => {
      if (seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    }),
  );

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tick a judge above to reveal its expected-value fields.
      </p>
    );
  }

  function update(key: string, value: unknown) {
    onChange({ ...expected, [key]: value });
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = expected[field.key];
        return (
          <div key={field.key} className="space-y-1">
            <label className="block text-sm font-medium">
              {field.label}
              {field.advisory && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                  advisory
                </span>
              )}
            </label>
            {field.kind === 'toggle' && (
              <input
                type="checkbox"
                checked={value === true}
                onChange={(e) => update(field.key, e.target.checked)}
              />
            )}
            {field.kind === 'text' && (
              <input
                type="text"
                className="border border-border bg-background p-2 rounded w-full text-sm"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => update(field.key, e.target.value)}
              />
            )}
            {field.kind === 'chip-list' && (
              <ChipList
                values={Array.isArray(value) ? (value as string[]) : []}
                onChange={(next) => update(field.key, next)}
              />
            )}
            {field.kind === 'structure-picker' && (
              <StructurePicker
                value={Array.isArray(value) ? (value as string[]) : []}
                onChange={(next) => update(field.key, next)}
              />
            )}
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          </div>
        );
      })}
    </div>
  );
}

function ChipList({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
          >
            <span className="font-mono">{v}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="border border-border bg-background p-2 rounded flex-1 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="https://… then Enter"
        />
        <button
          type="button"
          onClick={commit}
          className="border border-border px-3 rounded text-sm"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function StructurePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(section: string, checked: boolean) {
    const set = new Set(value);
    if (checked) set.add(section);
    else set.delete(section);
    // Preserve canonical order: problem_framing -> dalgo_approach -> evidence
    onChange(STRUCTURE_SECTIONS.filter((s) => set.has(s)));
  }
  return (
    <div className="space-y-1">
      {STRUCTURE_SECTIONS.map((s) => (
        <label key={s} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(s)}
            onChange={(e) => toggle(s, e.target.checked)}
          />
          <span className="font-mono">{s}</span>
        </label>
      ))}
    </div>
  );
}
