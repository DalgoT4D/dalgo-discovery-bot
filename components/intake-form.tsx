'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DATA_TYPE_OPTIONS = [
  'Survey/field data',
  'Beneficiary records',
  'Financial / donor',
  'M&E indicators',
  'Sensor / IoT',
  'Other',
];

export function IntakeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [url, setUrl] = useState('');
  const [systems, setSystems] = useState('');
  const [dataTypes, setDataTypes] = useState<string[]>([]);

  function toggle(t: string) {
    setDataTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ngo_url: url || undefined,
        ngo_systems: systems,
        data_types: dataTypes,
      }),
    });
    const { session_id } = await res.json();
    router.push(`/chat/${session_id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-semibold">Tell us about your NGO</h1>
      <p className="text-slate-600">
        I&apos;ll learn about your work and help you understand if Dalgo fits your needs.
      </p>

      <label className="block">
        <span className="text-sm font-medium">NGO website URL</span>
        <input value={url} onChange={e => setUrl(e.target.value)}
          type="url" placeholder="https://yourngo.org"
          className="mt-1 w-full border rounded p-2" />
      </label>

      <label className="block">
        <span className="text-sm font-medium">What systems do you use today?</span>
        <input value={systems} onChange={e => setSystems(e.target.value)}
          placeholder="e.g., KoboToolbox + Excel + a Postgres DB"
          className="mt-1 w-full border rounded p-2" />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Data types (pick any)</legend>
        <div className="flex flex-wrap gap-2 mt-2">
          {DATA_TYPE_OPTIONS.map(t => (
            <button key={t} type="button" onClick={() => toggle(t)}
              className={`px-3 py-1 rounded-full border text-sm ${
                dataTypes.includes(t) ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
              }`}>{t}</button>
          ))}
        </div>
      </fieldset>

      <button disabled={submitting} type="submit"
        className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-50">
        {submitting ? 'Starting…' : 'Start discovery'}
      </button>
    </form>
  );
}
