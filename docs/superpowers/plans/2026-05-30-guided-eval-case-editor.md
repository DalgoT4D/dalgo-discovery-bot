# Guided eval-case editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw-JSON Expected field on `/admin/evals/new` (and the shared `/admin/evals/[id]` editor) with a visual form whose inputs are driven by the selected bucket and judges, plus a context-aware right-side help panel with real seed examples. Power-user JSON toggle is preserved.

**Architecture:** All state lives in the existing `EvalCaseEditor` (`components/admin/eval-case-editor.tsx`) on the existing `EvalCaseFormValue` shape — no API or DB change. The editor is decomposed into three smaller pieces: pure data/helpers (`lib/eval-case-templates.ts`), the visual Expected form (`components/admin/eval-case-form-fields.tsx`), and the right-side help panel (`components/admin/eval-case-help-panel.tsx`). Page width grows from `max-w-3xl` to a two-column `md:grid-cols-3` layout (form takes 2/3, help takes 1/3).

**Tech Stack:** Next.js 16 App Router, React 19 client components, Tailwind v4, Vitest, raw `lib/llm/eval/cases/*.ts` modules (imported for help-panel examples), the existing `/api/admin/eval-cases` GET endpoint (for the case-key uniqueness fetch). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-30-guided-eval-case-editor-design.md` (note the corrected judge-field ownership in commit `81754f5`).

---

## Discoveries from source you should rely on

Before any task, take these as ground truth — they were verified by reading `lib/llm/eval/judges/*.ts` at HEAD:

- **retrieval-judge** consumes ONLY: `must_cite_one_of`, `must_not_hallucinate_urls`, `matched_pattern`.
- **llm-judge** consumes ONLY: `structure`, `must_express_uncertainty`.
- **exact-match** consumes ONLY: `must_record_unanswered`.
- **`must_retrieve_blog_mentioning`** is set on the seed `tool-names` cases (e.g., `must_retrieve_blog_mentioning: 'Kobo'`) but no judge actually reads it. Treat it as advisory: surface it in the retrieval-judge form section so existing cases round-trip without losing data, with a "(not enforced by current runner)" note in the help panel.
- **Guardrails seed cases** use `judge: ['retrieval-judge', 'llm-judge']` and set `must_record_unanswered: true`, even though only `exact-match` would actually enforce that field. The template matches the seed shape on purpose — this plan does not fix eval-suite correctness, only the authoring UX.
- The shape `EvalCaseFormValue` is defined at [components/admin/eval-case-editor.tsx:5-13](components/admin/eval-case-editor.tsx#L5-L13). Do not change its public shape.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `lib/eval-case-templates.ts` | New | Pure data + helpers: bucket → template (judges + expected), judge → metadata + example IDs, `computeNextCaseKey(prefix, existing)`, `stripEmptyExpected(expected)`. Zero React. Imports seed case arrays from `lib/llm/eval/cases/*.ts` so examples stay in sync. |
| `tests/lib/eval-case-templates.test.ts` | New | Unit tests for everything in the helper module. |
| `components/admin/eval-case-form-fields.tsx` | New | Stateless visual form for the Expected object. Props: `{ judges: string[]; expected: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }`. Renders the right fields based on which judges are checked. |
| `components/admin/eval-case-help-panel.tsx` | New | Right-side panel. Props: `{ judges: string[]; bucket: string; activeJudge: string \| null; caseKey: string; onLoadExample: (e: ExampleCase) => void }`. Shows the active judge's "what it checks / fields / examples" with "Load this example" buttons. Has a "Show all judges" expansion. |
| `components/admin/eval-case-editor.tsx` | Modify | Orchestrator. Adds the two-column layout, the bucket-change handler that calls the template helper, the case-key auto-fill on mount + bucket-change, the duplicate-warning, the "Edit JSON directly" toggle. Keeps `save()`, `remove()`, the `case_key`/`bucket`/`input`/`notes`/`enabled` inputs as-is. |
| `tests/components/admin/eval-case-editor.test.tsx` | New | Component tests for behavior listed in the spec (bucket change, judge toggle reveals fields, JSON-toggle round trips, etc.). |

No backend changes. No DB changes. No new dependencies — uses the project's existing Vitest + React Testing Library setup if present (otherwise the component test in Task 5 falls back to a manual smoke).

---

## Task 1: Pure data + helpers — `lib/eval-case-templates.ts`

**Files:**
- Create: `lib/eval-case-templates.ts`
- Test: `tests/lib/eval-case-templates.test.ts`

This task ships zero UI. It packages every piece of pure data the rest of the plan consumes: bucket templates, judge metadata (descriptions + field lists + example IDs), the case-key prefix per bucket, `computeNextCaseKey()`, and `stripEmptyExpected()`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/eval-case-templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BUCKET_TEMPLATES,
  JUDGE_META,
  CASE_KEY_PREFIX,
  computeNextCaseKey,
  stripEmptyExpected,
  getExamplesForJudge,
} from '@/lib/eval-case-templates';

describe('BUCKET_TEMPLATES', () => {
  it('citations sets retrieval-judge + must_not_hallucinate_urls', () => {
    expect(BUCKET_TEMPLATES.citations).toEqual({
      judges: ['retrieval-judge'],
      expected: { must_not_hallucinate_urls: true },
    });
  });

  it('guardrails sets retrieval-judge + llm-judge + uncertainty + unanswered', () => {
    expect(BUCKET_TEMPLATES.guardrails).toEqual({
      judges: ['retrieval-judge', 'llm-judge'],
      expected: { must_express_uncertainty: true, must_record_unanswered: true },
    });
  });

  it('problem-statement sets retrieval-judge + empty matched_pattern', () => {
    expect(BUCKET_TEMPLATES['problem-statement']).toEqual({
      judges: ['retrieval-judge'],
      expected: { matched_pattern: '' },
    });
  });

  it('structure sets llm-judge + full structure array', () => {
    expect(BUCKET_TEMPLATES.structure).toEqual({
      judges: ['llm-judge'],
      expected: { structure: ['problem_framing', 'dalgo_approach', 'evidence'] },
    });
  });

  it('tool-names sets llm-judge + empty expected', () => {
    expect(BUCKET_TEMPLATES['tool-names']).toEqual({
      judges: ['llm-judge'],
      expected: {},
    });
  });
});

describe('CASE_KEY_PREFIX', () => {
  it('maps each bucket to the conventional prefix', () => {
    expect(CASE_KEY_PREFIX).toEqual({
      citations: 'cit-',
      guardrails: 'gr-',
      'problem-statement': 'ps-',
      structure: 'st-',
      'tool-names': 'tn-',
    });
  });
});

describe('computeNextCaseKey', () => {
  it('returns prefix-01 when no existing keys match', () => {
    expect(computeNextCaseKey('cit-', [])).toBe('cit-01');
    expect(computeNextCaseKey('cit-', ['gr-01', 'ps-99'])).toBe('cit-01');
  });

  it('returns max + 1, zero-padded to 2 digits', () => {
    expect(computeNextCaseKey('cit-', ['cit-01', 'cit-12'])).toBe('cit-13');
    expect(computeNextCaseKey('cit-', ['cit-01', 'cit-02', 'cit-03'])).toBe('cit-04');
  });

  it('handles non-numeric suffixes by ignoring them', () => {
    expect(computeNextCaseKey('cit-', ['cit-01', 'cit-foo', 'cit-12'])).toBe('cit-13');
  });

  it('pads to 2 digits even for max >= 100', () => {
    expect(computeNextCaseKey('cit-', ['cit-99', 'cit-100'])).toBe('cit-101');
  });
});

describe('stripEmptyExpected', () => {
  it('removes empty strings, empty arrays, and false booleans', () => {
    expect(
      stripEmptyExpected({
        matched_pattern: '',
        must_cite_one_of: [],
        must_not_hallucinate_urls: false,
        must_express_uncertainty: true,
        structure: ['evidence'],
      }),
    ).toEqual({
      must_express_uncertainty: true,
      structure: ['evidence'],
    });
  });

  it('keeps non-empty string, non-empty array, true boolean', () => {
    expect(
      stripEmptyExpected({
        matched_pattern: 'ngo_kobo',
        must_cite_one_of: ['https://x.test/a'],
        must_not_hallucinate_urls: true,
      }),
    ).toEqual({
      matched_pattern: 'ngo_kobo',
      must_cite_one_of: ['https://x.test/a'],
      must_not_hallucinate_urls: true,
    });
  });

  it('returns empty object when all fields are falsy/empty', () => {
    expect(stripEmptyExpected({ a: '', b: [], c: false })).toEqual({});
  });
});

describe('JUDGE_META', () => {
  it('has retrieval-judge with the three real fields', () => {
    const fields = JUDGE_META['retrieval-judge'].fields.map((f) => f.key);
    expect(fields).toContain('must_cite_one_of');
    expect(fields).toContain('must_not_hallucinate_urls');
    expect(fields).toContain('matched_pattern');
    expect(fields).toContain('must_retrieve_blog_mentioning');
  });

  it('marks must_retrieve_blog_mentioning as advisory', () => {
    const f = JUDGE_META['retrieval-judge'].fields.find((x) => x.key === 'must_retrieve_blog_mentioning');
    expect(f?.advisory).toBe(true);
  });

  it('has llm-judge with structure + must_express_uncertainty', () => {
    const fields = JUDGE_META['llm-judge'].fields.map((f) => f.key);
    expect(fields).toEqual(['must_express_uncertainty', 'structure']);
  });

  it('has exact-match with only must_record_unanswered', () => {
    const fields = JUDGE_META['exact-match'].fields.map((f) => f.key);
    expect(fields).toEqual(['must_record_unanswered']);
  });
});

describe('getExamplesForJudge', () => {
  it('resolves retrieval-judge example IDs to real seed cases', () => {
    const examples = getExamplesForJudge('retrieval-judge');
    expect(examples.length).toBeGreaterThanOrEqual(2);
    examples.forEach((e) => {
      expect(e.id).toBeTruthy();
      expect(e.input).toBeTruthy();
      expect(e.expected).toBeTypeOf('object');
      expect(e.judge).toContain('retrieval-judge');
    });
  });

  it('resolves llm-judge example IDs to real seed cases', () => {
    const examples = getExamplesForJudge('llm-judge');
    expect(examples.length).toBeGreaterThanOrEqual(2);
    examples.forEach((e) => expect(e.judge).toContain('llm-judge'));
  });

  it('returns a synthetic example for exact-match (no seed cases use it)', () => {
    const examples = getExamplesForJudge('exact-match');
    expect(examples.length).toBeGreaterThanOrEqual(1);
    expect(examples[0].id).toMatch(/^synthetic/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/eval-case-templates.test.ts`
Expected: FAIL — module `@/lib/eval-case-templates` does not exist; all tests error on import.

- [ ] **Step 3: Implement the helper module**

Create `lib/eval-case-templates.ts`:

```ts
// lib/eval-case-templates.ts
//
// Pure data + helpers consumed by the guided eval-case editor.
// No React, no DB. All exports are deterministic from imports.
//
// Field ownership comes from reading lib/llm/eval/judges/*.ts at HEAD:
//   - retrieval-judge: must_cite_one_of, must_not_hallucinate_urls, matched_pattern
//   - llm-judge:       structure, must_express_uncertainty
//   - exact-match:     must_record_unanswered
//
// must_retrieve_blog_mentioning is set on seed tool-names cases but no judge
// currently reads it. Surfaced as 'advisory' so editing those cases round-trips.

import type { EvalCase } from '@/lib/llm/eval/cases/types';
import { citationCases } from '@/lib/llm/eval/cases/citations';
import { guardrailCases } from '@/lib/llm/eval/cases/guardrails';
import { problemStatementCases } from '@/lib/llm/eval/cases/problem-statements';
import { structureCases } from '@/lib/llm/eval/cases/structure';
import { toolNameCases } from '@/lib/llm/eval/cases/tool-names';

export type BucketKey =
  | 'citations'
  | 'guardrails'
  | 'problem-statement'
  | 'structure'
  | 'tool-names';

export type JudgeKey = 'retrieval-judge' | 'llm-judge' | 'exact-match';

export interface BucketTemplate {
  judges: JudgeKey[];
  expected: Record<string, unknown>;
}

export const BUCKET_TEMPLATES: Record<BucketKey, BucketTemplate> = {
  citations: {
    judges: ['retrieval-judge'],
    expected: { must_not_hallucinate_urls: true },
  },
  guardrails: {
    judges: ['retrieval-judge', 'llm-judge'],
    expected: { must_express_uncertainty: true, must_record_unanswered: true },
  },
  'problem-statement': {
    judges: ['retrieval-judge'],
    expected: { matched_pattern: '' },
  },
  structure: {
    judges: ['llm-judge'],
    expected: { structure: ['problem_framing', 'dalgo_approach', 'evidence'] },
  },
  'tool-names': {
    judges: ['llm-judge'],
    expected: {},
  },
};

export const CASE_KEY_PREFIX: Record<BucketKey, string> = {
  citations: 'cit-',
  guardrails: 'gr-',
  'problem-statement': 'ps-',
  structure: 'st-',
  'tool-names': 'tn-',
};

export type FieldKind =
  | 'chip-list'
  | 'toggle'
  | 'text'
  | 'structure-picker';

export interface JudgeField {
  key: string;
  label: string;
  helpText: string;
  kind: FieldKind;
  /** True if no current judge actually consumes this field but cases still set it. */
  advisory?: boolean;
}

export interface JudgeMeta {
  description: string;
  fields: JudgeField[];
  exampleIds: string[];
}

export const JUDGE_META: Record<JudgeKey, JudgeMeta> = {
  'retrieval-judge': {
    description:
      'Looks at which URLs the bot cited and whether they came from the retrieved sources. Also checks pattern-matching surfaced a curated pattern.',
    fields: [
      {
        key: 'must_cite_one_of',
        label: 'URLs the answer must include (at least one)',
        helpText: 'Paste blog or case-study URLs. The judge passes if the response includes ANY one of them.',
        kind: 'chip-list',
      },
      {
        key: 'must_not_hallucinate_urls',
        label: 'Reject any URL the bot invents',
        helpText: 'When on, every URL in the response must come from the retrieved candidates (or the projecttech4dev.org domain).',
        kind: 'toggle',
      },
      {
        key: 'matched_pattern',
        label: 'Expected problem-pattern slug',
        helpText: 'A pattern slug from lib/db/seed-data/problem-patterns.ts. The judge checks the curated pattern surfaced in the top retrieval results.',
        kind: 'text',
      },
      {
        key: 'must_retrieve_blog_mentioning',
        label: 'Retrieved chunk must mention this term',
        helpText: 'Advisory: set on tool-names seed cases but not enforced by the current runner.',
        kind: 'text',
        advisory: true,
      },
    ],
    exampleIds: ['cit-01', 'ps-01'],
  },
  'llm-judge': {
    description:
      'Asks Claude Haiku to score the response against your expectations (uncertainty language, structure sections).',
    fields: [
      {
        key: 'must_express_uncertainty',
        label: "Bot must say 'not sure' or equivalent",
        helpText: 'Use for out-of-scope questions. Passes if the response honestly acknowledges scope limits.',
        kind: 'toggle',
      },
      {
        key: 'structure',
        label: 'Required sections of the 3-part consultant reply',
        helpText: 'Pick which of problem_framing / dalgo_approach / evidence must appear in order.',
        kind: 'structure-picker',
      },
    ],
    exampleIds: ['gr-01', 'st-01'],
  },
  'exact-match': {
    description:
      "Confirms that a row was created in the `unanswered_questions` table for this question (the bot's 'flag for the team' mechanism).",
    fields: [
      {
        key: 'must_record_unanswered',
        label: 'An unanswered_questions row must be created',
        helpText: 'Use for questions the bot should flag for human follow-up rather than answer.',
        kind: 'toggle',
      },
    ],
    exampleIds: ['synthetic-exact-01'],
  },
};

const ALL_SEED_CASES: EvalCase[] = [
  ...citationCases,
  ...guardrailCases,
  ...problemStatementCases,
  ...structureCases,
  ...toolNameCases,
];

const SYNTHETIC_EXAMPLES: Record<string, EvalCase> = {
  'synthetic-exact-01': {
    id: 'synthetic-exact-01',
    bucket: 'guardrails',
    input: 'Can Dalgo replace my CRM?',
    expected: { must_record_unanswered: true },
    judge: ['exact-match'],
  },
};

export interface ExampleCase {
  id: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judge: string[];
}

export function getExamplesForJudge(judge: JudgeKey): ExampleCase[] {
  const ids = JUDGE_META[judge].exampleIds;
  return ids
    .map((id) => {
      const found =
        ALL_SEED_CASES.find((c) => c.id === id) ?? SYNTHETIC_EXAMPLES[id];
      if (!found) return null;
      return {
        id: found.id,
        bucket: found.bucket,
        input: found.input,
        expected: found.expected as Record<string, unknown>,
        judge: [...found.judge],
      };
    })
    .filter((x): x is ExampleCase => x !== null);
}

export function computeNextCaseKey(prefix: string, existing: string[]): string {
  const re = new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\d+)$`);
  let max = 0;
  for (const k of existing) {
    const m = re.exec(k);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

export function stripEmptyExpected(
  expected: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(expected)) {
    if (v === '' || v === false || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- tests/lib/eval-case-templates.test.ts`
Expected: PASS — all six describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add lib/eval-case-templates.ts tests/lib/eval-case-templates.test.ts
git commit -m "feat(eval): pure data/helpers for guided eval-case editor"
```

---

## Task 2: Visual Expected form — `components/admin/eval-case-form-fields.tsx`

**Files:**
- Create: `components/admin/eval-case-form-fields.tsx`

This is a stateless component. It renders the right inputs based on which judges are checked, using `JUDGE_META` from Task 1. Each input reads `expected[field.key]` and calls `onChange` with the next `expected` object.

No automated tests for this component on its own — it has no logic beyond rendering. Task 4's editor tests exercise it, and Task 5's manual smoke verifies the visual behavior.

- [ ] **Step 1: Implement the component**

Create `components/admin/eval-case-form-fields.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint -- components/admin/eval-case-form-fields.tsx 2>&1 | tail -10`
Expected: no errors specific to this file. (Pre-existing project-wide lint warnings are OK.)

Also run a TypeScript-only check to catch type errors:

Run: `npx tsc --noEmit 2>&1 | grep "eval-case-form-fields" | head -10`
Expected: no output for this file.

- [ ] **Step 3: Commit**

```bash
git add components/admin/eval-case-form-fields.tsx
git commit -m "feat(eval-editor): visual form fields for the expected object"
```

---

## Task 3: Right-side help panel — `components/admin/eval-case-help-panel.tsx`

**Files:**
- Create: `components/admin/eval-case-help-panel.tsx`

The panel is stateless except for the "Show all judges" expansion toggle.

- [ ] **Step 1: Implement the component**

Create `components/admin/eval-case-help-panel.tsx`:

```tsx
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
              <p className="italic mb-1">"{e.input}"</p>
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep "eval-case-help-panel" | head -10`
Expected: no output for this file.

- [ ] **Step 3: Commit**

```bash
git add components/admin/eval-case-help-panel.tsx
git commit -m "feat(eval-editor): context-aware help panel with seed examples"
```

---

## Task 4: Editor orchestrator — `components/admin/eval-case-editor.tsx`

**Files:**
- Modify: `components/admin/eval-case-editor.tsx`
- Test: `tests/components/admin/eval-case-editor.test.tsx`

This task wires Tasks 1-3 together: two-column layout, bucket-template apply, case-key auto-fill + duplicate warning, JSON-edit toggle, "Load this example" handler, activeJudge tracking. The existing `save()` / `remove()` / API flow stays put.

- [ ] **Step 1: Write the failing tests**

Check first whether the project has `@testing-library/react` available. Run:

```bash
node -e "require('@testing-library/react'); console.log('present')" 2>&1
```

Expected: `present` if installed; an error if not.

**If `@testing-library/react` is NOT installed**, skip the component tests for this task entirely — note "deferred to Task 5 manual smoke" in your report and proceed to Step 3. Do NOT install testing-library on your own; the project's testing strategy is the user's call.

**If it IS installed**, create `tests/components/admin/eval-case-editor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvalCaseEditor } from '@/components/admin/eval-case-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const DEFAULT = {
  case_key: '',
  bucket: 'citations',
  input: '',
  expected: { must_not_hallucinate_urls: true },
  judges: ['retrieval-judge'],
  enabled: true,
  notes: null,
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ cases: [{ case_key: 'cit-01' }, { case_key: 'cit-12' }] }),
  }) as unknown as typeof fetch;
});

describe('EvalCaseEditor', () => {
  it('suggests next case-key on mount based on bucket prefix', async () => {
    render(<EvalCaseEditor initial={{ ...DEFAULT }} mode="create" />);
    const keyInput = await screen.findByPlaceholderText('e.g. cit_05');
    expect((keyInput as HTMLInputElement).value).toBe('cit-13');
  });

  it('applies the guardrails template when bucket changes', async () => {
    render(<EvalCaseEditor initial={{ ...DEFAULT }} mode="create" />);
    const bucket = await screen.findByLabelText('Bucket');
    fireEvent.change(bucket, { target: { value: 'guardrails' } });
    expect((await screen.findByLabelText('retrieval-judge')) as HTMLInputElement).toBeChecked();
    expect((screen.getByLabelText('llm-judge')) as HTMLInputElement).toBeChecked();
    // Uncertainty toggle should be checked (true after template apply)
    expect(screen.getByLabelText(/say 'not sure'/i)).toBeChecked();
  });

  it('does not overwrite a user-typed case key on bucket change', async () => {
    render(<EvalCaseEditor initial={{ ...DEFAULT }} mode="create" />);
    const keyInput = await screen.findByPlaceholderText('e.g. cit_05');
    fireEvent.change(keyInput, { target: { value: 'my-custom-key' } });
    const bucket = screen.getByLabelText('Bucket');
    fireEvent.change(bucket, { target: { value: 'guardrails' } });
    expect((keyInput as HTMLInputElement).value).toBe('my-custom-key');
  });

  it('reveals structure picker when llm-judge is ticked', async () => {
    render(<EvalCaseEditor initial={{ ...DEFAULT }} mode="create" />);
    const llm = await screen.findByLabelText('llm-judge');
    fireEvent.click(llm);
    expect(screen.getByLabelText(/Required sections/i)).toBeInTheDocument();
  });

  it('removes a judge’s fields from expected when its checkbox is unticked', async () => {
    render(
      <EvalCaseEditor
        initial={{
          ...DEFAULT,
          judges: ['retrieval-judge', 'llm-judge'],
          expected: { must_express_uncertainty: true, must_not_hallucinate_urls: true },
        }}
        mode="create"
      />,
    );
    fireEvent.click(await screen.findByLabelText('llm-judge'));
    // After unchecking llm-judge, the uncertainty toggle is gone
    expect(screen.queryByLabelText(/say 'not sure'/i)).toBeNull();
  });

  it('shows duplicate-warning when typed key matches an existing key', async () => {
    render(<EvalCaseEditor initial={{ ...DEFAULT }} mode="create" />);
    const keyInput = await screen.findByPlaceholderText('e.g. cit_05');
    fireEvent.change(keyInput, { target: { value: 'cit-01' } });
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('round-trips through the Edit JSON directly toggle', async () => {
    render(<EvalCaseEditor initial={{ ...DEFAULT }} mode="create" />);
    const toggle = await screen.findByLabelText(/edit json directly/i);
    fireEvent.click(toggle); // → JSON view
    const ta = screen.getByRole('textbox', { name: /expected json/i }) as HTMLTextAreaElement;
    expect(JSON.parse(ta.value)).toEqual({ must_not_hallucinate_urls: true });
    fireEvent.change(ta, { target: { value: '{"must_not_hallucinate_urls": false, "matched_pattern": "x"}' } });
    fireEvent.click(toggle); // → form view
    // The text input for matched_pattern should reflect the JSON edit.
    const mp = screen.getByLabelText(/problem-pattern slug/i) as HTMLInputElement;
    expect(mp.value).toBe('x');
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail (or skip if testing-library is absent)**

Run: `npm test -- tests/components/admin/eval-case-editor.test.tsx`
Expected: FAIL — current editor has no two-column layout, no bucket-template apply, no auto-fill, etc.

If you skipped the test file in Step 1, skip this step and proceed.

- [ ] **Step 3: Rewrite the editor**

Replace the contents of `components/admin/eval-case-editor.tsx` with:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUCKET_TEMPLATES,
  CASE_KEY_PREFIX,
  computeNextCaseKey,
  stripEmptyExpected,
  type BucketKey,
  type ExampleCase,
} from '@/lib/eval-case-templates';
import { EvalCaseFormFields } from '@/components/admin/eval-case-form-fields';
import { EvalCaseHelpPanel } from '@/components/admin/eval-case-help-panel';

export interface EvalCaseFormValue {
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
}

interface Props {
  initial: EvalCaseFormValue;
  mode: 'create' | 'edit';
  caseId?: string;
}

const BUCKETS: BucketKey[] = [
  'citations',
  'guardrails',
  'problem-statement',
  'structure',
  'tool-names',
];
const JUDGES = ['retrieval-judge', 'llm-judge', 'exact-match'];

export function EvalCaseEditor({ initial, mode, caseId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<EvalCaseFormValue>(initial);
  const [expectedJson, setExpectedJson] = useState(
    JSON.stringify(initial.expected, null, 2),
  );
  const [editingJson, setEditingJson] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [allKeys, setAllKeys] = useState<string[] | null>(null);
  /** Tracks the last auto-suggested case key so we know whether to overwrite it. */
  const lastSuggestedKey = useRef<string | null>(null);
  /** Tracks the most recently toggled-on judge to drive help-panel focus. */
  const [activeJudge, setActiveJudge] = useState<string | null>(
    initial.judges[0] ?? null,
  );

  // Fetch existing case keys once (only in create mode; edit mode shows a disabled key).
  useEffect(() => {
    if (mode !== 'create') return;
    let cancelled = false;
    fetch('/api/admin/eval-cases')
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((body: { cases?: Array<{ case_key: string }> }) => {
        if (cancelled) return;
        const keys = (body.cases ?? []).map((c) => c.case_key);
        setAllKeys(keys);
        // First-mount suggestion if the user hasn't typed anything yet.
        if (value.case_key === '' && isBucketKey(value.bucket)) {
          const next = computeNextCaseKey(CASE_KEY_PREFIX[value.bucket], keys);
          lastSuggestedKey.current = next;
          setValue((v) => ({ ...v, case_key: next }));
        }
      })
      .catch(() => {
        if (!cancelled) setAllKeys([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onBucketChange(nextBucket: string) {
    let nextValue: EvalCaseFormValue = { ...value, bucket: nextBucket };

    // Apply the bucket template (judges + expected) — full replacement.
    if (isBucketKey(nextBucket)) {
      const tmpl = BUCKET_TEMPLATES[nextBucket];
      nextValue = {
        ...nextValue,
        judges: [...tmpl.judges],
        expected: { ...tmpl.expected },
      };
      setActiveJudge(tmpl.judges[0] ?? null);

      // Re-suggest the case key for the new bucket, but ONLY if the user hasn't
      // typed a custom key.
      if (mode === 'create' && allKeys) {
        const userTypedCustom =
          value.case_key !== '' && value.case_key !== lastSuggestedKey.current;
        if (!userTypedCustom) {
          const next = computeNextCaseKey(CASE_KEY_PREFIX[nextBucket], allKeys);
          lastSuggestedKey.current = next;
          nextValue.case_key = next;
        }
      }
    }

    setValue(nextValue);
    setExpectedJson(JSON.stringify(nextValue.expected, null, 2));
  }

  function onJudgeToggle(judge: string, checked: boolean) {
    if (checked) {
      const nextJudges = [...value.judges, judge];
      setValue({ ...value, judges: nextJudges });
      setActiveJudge(judge);
    } else {
      // Strip expected fields owned only by the un-checked judge.
      const removing = expectedKeysOwnedOnlyBy(judge, value.judges);
      const nextExpected = { ...value.expected };
      for (const k of removing) delete nextExpected[k];
      const nextJudges = value.judges.filter((j) => j !== judge);
      setValue({ ...value, judges: nextJudges, expected: nextExpected });
      setExpectedJson(JSON.stringify(nextExpected, null, 2));
      if (activeJudge === judge) {
        setActiveJudge(nextJudges[0] ?? null);
      }
    }
  }

  function onExpectedChange(nextExpected: Record<string, unknown>) {
    setValue({ ...value, expected: nextExpected });
    setExpectedJson(JSON.stringify(nextExpected, null, 2));
  }

  function onJsonToggle() {
    if (!editingJson) {
      // Switching INTO JSON mode: sync the textarea from value.expected.
      setExpectedJson(JSON.stringify(value.expected, null, 2));
      setParseError(null);
      setEditingJson(true);
      return;
    }
    // Switching OUT of JSON mode: parse, only swap on success.
    try {
      const parsed = JSON.parse(expectedJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Expected must be a JSON object');
      }
      setValue({ ...value, expected: parsed as Record<string, unknown> });
      setParseError(null);
      setEditingJson(false);
    } catch (err) {
      setParseError(`Invalid JSON: ${String(err)}`);
    }
  }

  function onLoadExample(example: ExampleCase) {
    setValue({
      ...value,
      bucket: example.bucket,
      input: example.input,
      judges: [...example.judge],
      expected: { ...example.expected },
      notes: null,
    });
    setExpectedJson(JSON.stringify(example.expected, null, 2));
    setActiveJudge(example.judge[0] ?? null);
  }

  async function save() {
    setError(null);
    let expected = value.expected;

    // If user is currently in JSON mode, parse before save.
    if (editingJson) {
      try {
        const parsed = JSON.parse(expectedJson);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Expected must be a JSON object');
        }
        expected = parsed as Record<string, unknown>;
        setParseError(null);
      } catch (err) {
        setParseError(`Invalid JSON: ${String(err)}`);
        return;
      }
    }

    setSaving(true);
    const payload = { ...value, expected: stripEmptyExpected(expected) };
    const url = mode === 'create' ? '/api/admin/eval-cases' : `/api/admin/eval-cases/${caseId}`;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    router.push('/admin/evals');
    router.refresh();
  }

  async function remove() {
    if (!caseId) return;
    if (!confirm('Delete this case?')) return;
    const res = await fetch(`/api/admin/eval-cases/${caseId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/evals');
      router.refresh();
    }
  }

  const duplicateKey =
    mode === 'create' &&
    allKeys !== null &&
    value.case_key !== '' &&
    value.case_key !== lastSuggestedKey.current &&
    allKeys.includes(value.case_key);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-4">
        <Field label="Case key (stable identifier)">
          <input
            className="border border-border bg-background p-2 rounded w-full font-mono text-sm"
            value={value.case_key}
            onChange={(e) => setValue({ ...value, case_key: e.target.value })}
            disabled={mode === 'edit'}
            placeholder="e.g. cit_05"
          />
          {duplicateKey && (
            <p className="text-xs text-amber-600 mt-1">
              Already exists. Saving will fail with a unique-constraint error.
            </p>
          )}
        </Field>

        <Field label="Bucket">
          <select
            className="border border-border bg-background p-2 rounded w-full"
            value={value.bucket}
            onChange={(e) => onBucketChange(e.target.value)}
          >
            {BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>

        <Field label="User input (the message the bot is tested with)">
          <textarea
            className="border border-border bg-background p-2 rounded w-full min-h-[100px]"
            value={value.input}
            onChange={(e) => setValue({ ...value, input: e.target.value })}
          />
        </Field>

        <Field label="Judges (one or more)">
          <div className="space-y-1">
            {JUDGES.map((j) => (
              <label key={j} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value.judges.includes(j)}
                  onChange={(e) => onJudgeToggle(j, e.target.checked)}
                  aria-label={j}
                />
                <span className="font-mono text-sm">{j}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Expected">
          {editingJson ? (
            <>
              <textarea
                aria-label="Expected JSON"
                className="border border-border bg-background p-2 rounded w-full min-h-[180px] font-mono text-sm"
                value={expectedJson}
                onChange={(e) => setExpectedJson(e.target.value)}
              />
              {parseError && <p className="text-destructive text-sm mt-1">{parseError}</p>}
            </>
          ) : (
            <EvalCaseFormFields
              judges={value.judges}
              expected={value.expected}
              onChange={onExpectedChange}
            />
          )}
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editingJson}
              onChange={onJsonToggle}
            />
            <span>Edit JSON directly</span>
          </label>
        </Field>

        <Field label="Notes (optional, for your team)">
          <textarea
            className="border border-border bg-background p-2 rounded w-full"
            value={value.notes ?? ''}
            onChange={(e) => setValue({ ...value, notes: e.target.value || null })}
          />
        </Field>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
          />
          <span>Enabled (included in eval runs)</span>
        </label>

        {error && <p className="text-destructive">Error: {error}</p>}

        <div className="flex gap-2 pt-4">
          <button
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create case' : 'Save changes'}
          </button>
          {mode === 'edit' && (
            <button
              onClick={remove}
              className="border border-destructive text-destructive px-4 py-2 rounded hover:bg-destructive/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <EvalCaseHelpPanel
        judges={value.judges}
        bucket={value.bucket}
        activeJudge={activeJudge}
        onLoadExample={onLoadExample}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

function isBucketKey(s: string): s is BucketKey {
  return s in BUCKET_TEMPLATES;
}

/**
 * Return the set of expected-object keys that are owned by `judge` but NOT
 * shared with any other CURRENTLY CHECKED judge. We import lazily to avoid a
 * circular import with `lib/eval-case-templates`.
 */
function expectedKeysOwnedOnlyBy(judge: string, allJudges: string[]): string[] {
  // Statically import here would be fine — keep this small inline map of which
  // judge owns which field. Mirrors JUDGE_META in lib/eval-case-templates.
  const ownership: Record<string, string[]> = {
    'retrieval-judge': [
      'must_cite_one_of',
      'must_not_hallucinate_urls',
      'matched_pattern',
      'must_retrieve_blog_mentioning',
    ],
    'llm-judge': ['must_express_uncertainty', 'structure'],
    'exact-match': ['must_record_unanswered'],
  };
  const fields = ownership[judge] ?? [];
  const others = allJudges.filter((j) => j !== judge);
  return fields.filter((f) => !others.some((j) => (ownership[j] ?? []).includes(f)));
}
```

The page-level wrapper at `app/admin/evals/new/page.tsx` already passes `max-w-6xl` (verified at HEAD). The new `md:grid-cols-3` layout fits inside it; no page-level change needed.

- [ ] **Step 4: Run tests (or skip if testing-library is absent)**

Run: `npm test -- tests/components/admin/eval-case-editor.test.tsx`
Expected: PASS on all seven tests (or skipped if you noted in Step 1 that testing-library isn't installed).

- [ ] **Step 5: Verify the type-check passes**

Run: `npx tsc --noEmit 2>&1 | grep "components/admin/eval-case-editor" | head -10`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add components/admin/eval-case-editor.tsx tests/components/admin/eval-case-editor.test.tsx
git commit -m "feat(eval-editor): guided two-column layout with templates and help"
```

If you skipped the test file, omit it from `git add` and adjust the message:

```bash
git add components/admin/eval-case-editor.tsx
git commit -m "feat(eval-editor): guided two-column layout with templates and help"
```

---

## Task 5: Manual smoke verification

This task validates the editor end-to-end in the running app. No automated test substitutes for clicking through the flow once.

- [ ] **Step 1: Start the stack**

Run (each in order):

```bash
docker compose up -d
npm run dev
```

Wait for the dev server's "Ready in" line. Sign in at `/` via the admin path (creds in your `.env.local`'s `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`, seeded as `admin@local.admin`).

- [ ] **Step 2: Two-column layout and case-key auto-fill**

Open `http://localhost:3000/admin/evals/new`.

Expected:
- Layout is two columns on a normal desktop window: form left, help panel right.
- The case-key input is pre-filled with the next number after existing `cit-XX` keys (e.g., `cit-13`).
- The help panel on the right shows the retrieval-judge section with two examples and "Load this example" buttons.

- [ ] **Step 3: Bucket template switching**

Change the bucket dropdown to `structure`.

Expected:
- The judges checklist now has only `llm-judge` checked.
- The form below shows the "Required sections" picker with all three sections checked.
- The case-key input updates to the next `st-XX`.
- The help panel switches to the llm-judge section.

Now type `my-custom-key` into the case key. Change the bucket back to `citations`.

Expected: the case-key input still says `my-custom-key` (not overwritten).

- [ ] **Step 4: Judge add/remove reveals/removes fields**

Reset by reloading the page. From the citations default, tick the `llm-judge` checkbox.

Expected: the "Bot must say 'not sure'" toggle and the "Required sections" picker appear, in addition to the existing retrieval-judge fields.

Untick `retrieval-judge`. The four retrieval-judge fields disappear; the two llm-judge fields stay.

- [ ] **Step 5: Load an example**

Click "Load this example" on the first retrieval-judge example.

Expected:
- The `User input` textarea fills with the example's question.
- The judges checklist matches the example's judges.
- The Expected form's fields populate with the example's values.
- The case-key input is NOT overwritten (whatever you typed/auto-suggested stays).

- [ ] **Step 6: Edit JSON directly toggle**

Tick the "Edit JSON directly" checkbox at the bottom of the Expected section.

Expected: the visual fields disappear; a JSON textarea appears with the current `expected` pretty-printed.

Edit the JSON to add a new key (e.g., set `must_express_uncertainty: true`). Untick the toggle.

Expected: the visual form reappears with the uncertainty toggle now ON. If you put invalid JSON in the textarea, unticking shows a parse error and stays in JSON mode.

- [ ] **Step 7: Duplicate-key warning**

Clear the case-key input and type `cit-01` (which already exists in the seed cases).

Expected: a small amber warning appears below the input: "Already exists. Saving will fail with a unique-constraint error."

- [ ] **Step 8: Save a new case end-to-end**

Type a fresh case key (e.g., `cit-99`), put a real question in the input, leave the Expected fields as the bucket template set them, click "Create case".

Expected: the page redirects to `/admin/evals` and the new case appears in the list. Open it via the edit page; the form fields reflect what you saved.

DB sanity check (optional):

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
  -c "SELECT case_key, bucket, judges, expected FROM dalgo_eval_cases WHERE case_key = 'cit-99';"
```

Expected: one row with the values you saved, no stale falsy keys in `expected` (the `stripEmptyExpected` helper removed any empty toggles).

- [ ] **Step 9: Clean up the test case**

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
  -c "DELETE FROM dalgo_eval_cases WHERE case_key = 'cit-99';"
```

- [ ] **Step 10: Stop the dev server**

`Ctrl+C` the `npm run dev` process. No commit for this task — it produces no file changes.

---

## Task 6: Journal entry

**Files:**
- Modify: `docs/JOURNAL.md`

- [ ] **Step 1: Read the top of the journal to confirm the entry template**

Read `docs/JOURNAL.md` (the most recent entry, likely the admin-sign-in one). Use the same six-section template (Added / Removed / Why / Eval delta / Carried forward / Refs).

- [ ] **Step 2: Prepend a new dated entry**

Add a new entry at the top (under the intro paragraph, above the most recent existing entry). Use the existing `---` separator pattern.

```markdown
## 2026-05-30 — Guided eval-case editor

**Added**
- `lib/eval-case-templates.ts` — pure data + helpers (bucket templates, judge metadata, case-key suggestion, expected-object cleanup).
- `components/admin/eval-case-form-fields.tsx` — visual form fields for the Expected object, driven by which judges are checked.
- `components/admin/eval-case-help-panel.tsx` — context-aware right-side panel with judge descriptions, real seed examples, and a "Load this example" button.
- Two-column layout on `/admin/evals/new` and `/admin/evals/[id]`. Bucket dropdown now applies a template (judges + expected defaults). Case-key auto-fill on bucket change with inline duplicate warning. JSON textarea preserved behind an "Edit JSON directly" toggle.

**Removed**
- The free-form-JSON-only authoring UX on the eval-case editor. Power-user JSON editing is still available behind the toggle; the default is a guided form.

**Why**
- Non-technical reviewers couldn't author eval cases without reading the seed `.ts` files to figure out which expected fields each judge consumes. The guided form encodes that knowledge in the UI.

**Eval delta**
- None — change is in the authoring UI, not the eval pipeline.

**Carried forward / next**
- `must_retrieve_blog_mentioning` is exposed in the form as "advisory" because the runner doesn't consume it. If we want it enforced, add a check in `lib/llm/eval/judges/retrieval-judge.ts`.
- Guardrails template still uses `[retrieval-judge, llm-judge]` to match seed cases, even though `must_record_unanswered` is only enforced by `exact-match`. Fix at the seed level, not the template.

**Refs**
- Spec: `docs/superpowers/specs/2026-05-30-guided-eval-case-editor-design.md`
- Plan: `docs/superpowers/plans/2026-05-30-guided-eval-case-editor.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/JOURNAL.md
git commit -m "docs(journal): guided eval-case editor"
```

---

## Self-review

**Spec coverage:**
- Two-column layout → Task 4 (Step 3, new `md:grid-cols-3`).
- Bucket → template → Task 1 (`BUCKET_TEMPLATES`) + Task 4 (`onBucketChange`).
- Case-key auto-fill (mount + bucket change + custom-key preservation) → Task 1 (`computeNextCaseKey`) + Task 4 (`useEffect` + `onBucketChange`).
- Duplicate-key warning → Task 4 (`duplicateKey` derived state + amber `<p>`).
- Judges checkbox add/remove fields → Task 4 (`onJudgeToggle` + `expectedKeysOwnedOnlyBy`).
- Visual Expected form (retrieval / llm / exact-match fields) → Task 1 (`JUDGE_META`) + Task 2 (`EvalCaseFormFields`).
- Edit JSON directly toggle with round-trip → Task 4 (`editingJson` + `onJsonToggle`).
- Help panel context-aware + examples + Load button → Task 1 (`getExamplesForJudge`, `SYNTHETIC_EXAMPLES`) + Task 3 (`EvalCaseHelpPanel`).
- "Show all judges" expansion → Task 3 (`showAll` state).
- `stripEmptyExpected` on save → Task 1 + Task 4 (`save()`).
- Manual smoke (every spec behavior in the running app) → Task 5.
- Out-of-scope items (no API change, no schema change, no judge changes, no mobile-first) → respected; no task touches those areas.

**Placeholder scan:** No "TBD", "TODO", "fill in", or "similar to" patterns. Every code-bearing step ships full code. Every shell command is exact.

**Type consistency:** `EvalCaseFormValue` is unchanged from HEAD (re-exported from Task 4). `BucketKey`, `JudgeKey`, `JudgeField`, `JudgeMeta`, `ExampleCase`, `BucketTemplate` are defined in Task 1 and consumed by Tasks 2, 3, 4. The structure-picker enforces order `[problem_framing, dalgo_approach, evidence]` consistently in Task 2 (constant) and Task 1 (`BUCKET_TEMPLATES.structure.expected.structure`). `onLoadExample`'s signature `(e: ExampleCase) => void` matches between Task 3 (caller) and Task 4 (provider). The internal `expectedKeysOwnedOnlyBy` helper in Task 4 mirrors `JUDGE_META`'s field lists from Task 1 — if `JUDGE_META` changes, both places must update (called out via the helper's inline comment).

If you're using subagent-driven development for execution, dispatch one subagent per Task 1-4, run Task 5 as the controller (manual smoke uses Playwright MCP from the parent session), and dispatch a small subagent for Task 6.
