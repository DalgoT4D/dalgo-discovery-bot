'use client';
import { useState } from 'react';

export function SoftCtaBanner({ sessionId, onDone }: { sessionId: string; onDone?: () => void }) {
  const [email, setEmail] = useState('');
  const [intent, setIntent] = useState<'demo' | 'pdf_report' | 'flag_questions'>('demo');
  const [submitted, setSubmitted] = useState(false);

  if (submitted)
    return <div className="text-sm text-green-700 px-4 py-2">Thanks! Someone will be in touch.</div>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch('/api/lead', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, email, intent }),
        });
        setSubmitted(true);
        onDone?.();
      }}
      className="border rounded p-3 my-2 bg-amber-50 mx-4"
    >
      <p className="text-sm mb-2">Want to learn more about Dalgo for your NGO?</p>
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={intent}
          onChange={(e) => setIntent(e.target.value as 'demo' | 'pdf_report' | 'flag_questions')}
          className="border rounded p-1 text-sm"
        >
          <option value="demo">Schedule a demo</option>
          <option value="pdf_report">Get a personalized PDF report</option>
          <option value="flag_questions">Flag my questions for the team</option>
        </select>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          placeholder="you@your-ngo.org"
          className="border rounded p-1 text-sm flex-1 min-w-[200px]"
        />
        <button type="submit" className="bg-slate-900 text-white text-sm px-3 py-1 rounded">
          Send
        </button>
      </div>
    </form>
  );
}
