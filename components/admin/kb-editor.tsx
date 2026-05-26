'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  'data_sources',
  'transforms',
  'dashboards',
  'orchestration',
  'ai',
  'sharing',
  'rbac',
  'security',
  'deployment',
  'pricing',
  'mission',
  'stack',
  'limitations',
];

type FormState = {
  category: string;
  question_variants: string;
  canonical_answer: string;
  status: string;
  ngo_framing: string;
  evidence: string;
  notes_for_sales: string;
};

export function KbEditor({
  id,
  onSaved,
}: {
  id: string;
  onSaved?: (item: any) => void;
}) {
  const isNew = id === 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(!isNew);
  const [form, setForm] = useState<FormState>({
    category: 'data_sources',
    question_variants: '',
    canonical_answer: '',
    status: 'yes',
    ngo_framing: '',
    evidence: '',
    notes_for_sales: '',
  });

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/kb/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const it = d.item;
        setForm({
          category: it.category,
          question_variants: (it.question_variants ?? []).join('\n'),
          canonical_answer: it.canonical_answer ?? '',
          status: it.status,
          ngo_framing: it.ngo_framing ?? '',
          evidence: (it.evidence ?? []).join('\n'),
          notes_for_sales: it.notes_for_sales ?? '',
        });
        setLoading(false);
      });
  }, [id, isNew]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      category: form.category,
      question_variants: form.question_variants
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      canonical_answer: form.canonical_answer,
      status: form.status,
      ngo_framing: form.ngo_framing || null,
      evidence: form.evidence
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      notes_for_sales: form.notes_for_sales || null,
    };
    const res = await fetch(isNew ? '/api/admin/kb' : `/api/admin/kb/${id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      if (onSaved) {
        const data = await res.json();
        onSaved(data.item);
      } else {
        router.push('/admin/kb');
      }
    } else {
      alert('Save failed');
    }
  }

  async function remove() {
    if (!confirm('Delete this entry?')) return;
    const res = await fetch(`/api/admin/kb/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/kb');
  }

  if (loading) return <p>Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium">Category</label>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="border rounded p-2 w-full"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="border rounded p-2 w-full"
        >
          {['yes', 'partial', 'no', 'roadmap'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Question variants (one per line)</label>
        <textarea
          value={form.question_variants}
          onChange={(e) => setForm({ ...form, question_variants: e.target.value })}
          rows={4}
          className="border rounded p-2 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Canonical answer</label>
        <textarea
          value={form.canonical_answer}
          onChange={(e) => setForm({ ...form, canonical_answer: e.target.value })}
          rows={6}
          className="border rounded p-2 w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">NGO framing</label>
        <input
          value={form.ngo_framing}
          onChange={(e) => setForm({ ...form, ngo_framing: e.target.value })}
          className="border rounded p-2 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Evidence (one per line)</label>
        <textarea
          value={form.evidence}
          onChange={(e) => setForm({ ...form, evidence: e.target.value })}
          rows={3}
          className="border rounded p-2 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Notes for sales (internal-only)</label>
        <textarea
          value={form.notes_for_sales}
          onChange={(e) => setForm({ ...form, notes_for_sales: e.target.value })}
          rows={2}
          className="border rounded p-2 w-full"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded">
          Save
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={remove}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
