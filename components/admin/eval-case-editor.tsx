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
 * shared with any other CURRENTLY CHECKED judge. We keep this small inline map
 * of which judge owns which field. Mirrors JUDGE_META in lib/eval-case-templates.
 */
function expectedKeysOwnedOnlyBy(judge: string, allJudges: string[]): string[] {
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
