'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

const BUCKETS = ['citations', 'guardrails', 'problem-statement', 'structure', 'tool-names'];
const JUDGES = ['retrieval-judge', 'llm-judge', 'exact-match'];

export function EvalCaseEditor({ initial, mode, caseId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<EvalCaseFormValue>(initial);
  const [expectedJson, setExpectedJson] = useState(JSON.stringify(initial.expected, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function save() {
    setError(null);
    let expected: Record<string, unknown>;
    try {
      expected = JSON.parse(expectedJson);
      setParseError(null);
    } catch (err) {
      setParseError(`Invalid JSON: ${String(err)}`);
      return;
    }

    setSaving(true);
    const payload = { ...value, expected };
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

  return (
    <div className="space-y-4 max-w-3xl">
      <Field label="Case key (stable identifier)">
        <input
          className="border border-border bg-background p-2 rounded w-full font-mono text-sm"
          value={value.case_key}
          onChange={(e) => setValue({ ...value, case_key: e.target.value })}
          disabled={mode === 'edit'}
          placeholder="e.g. cit_05"
        />
      </Field>

      <Field label="Bucket">
        <select
          className="border border-border bg-background p-2 rounded w-full"
          value={value.bucket}
          onChange={(e) => setValue({ ...value, bucket: e.target.value })}
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
                onChange={(e) => {
                  setValue({
                    ...value,
                    judges: e.target.checked
                      ? [...value.judges, j]
                      : value.judges.filter((x) => x !== j),
                  });
                }}
              />
              <span className="font-mono text-sm">{j}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Expected (JSON)">
        <textarea
          className="border border-border bg-background p-2 rounded w-full min-h-[180px] font-mono text-sm"
          value={expectedJson}
          onChange={(e) => setExpectedJson(e.target.value)}
        />
        {parseError && <p className="text-destructive text-sm mt-1">{parseError}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          Common fields: must_cite_one_of (string[]), must_not_hallucinate_urls (boolean),
          must_express_uncertainty (boolean), must_record_unanswered (boolean), matched_pattern
          (string), structure (string[]).
        </p>
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
