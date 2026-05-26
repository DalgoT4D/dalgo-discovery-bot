'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function SoftCtaBanner({ sessionId, onDone }: { sessionId: string; onDone?: () => void }) {
  const [email, setEmail] = useState('');
  const [intent, setIntent] = useState<'demo' | 'pdf_report' | 'flag_questions'>('demo');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Card className="my-3 border-l-[3px] border-l-primary px-4 py-3">
        <p className="text-sm text-foreground">
          <span className="mr-2 text-primary">✓</span>
          Thanks! Someone will be in touch.
        </p>
      </Card>
    );
  }

  return (
    <Card className="my-3 border-l-[3px] border-l-primary px-4 py-3">
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
        className="space-y-2"
      >
        <p className="text-sm font-medium text-foreground">Want to learn more about Dalgo for your NGO?</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value as 'demo' | 'pdf_report' | 'flag_questions')}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <option value="demo">Schedule a demo</option>
            <option value="pdf_report">Get a personalized PDF report</option>
            <option value="flag_questions">Flag my questions for the team</option>
          </select>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            placeholder="you@your-ngo.org"
            className="h-9 min-w-[200px] flex-1 text-sm"
          />
          <Button type="submit" size="sm">
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
