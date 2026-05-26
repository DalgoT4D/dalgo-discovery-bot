'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/cn';

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
    setDataTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
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
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>Tell us about your NGO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-foreground">NGO website</span>
            <Input
              className="mt-1.5"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              placeholder="https://yourngo.org"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">
              What systems do you use today?
            </span>
            <Input
              className="mt-1.5"
              value={systems}
              onChange={(e) => setSystems(e.target.value)}
              placeholder="e.g., KoboToolbox + Excel + a Postgres DB"
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">Data types (pick any)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DATA_TYPE_OPTIONS.map((t) => {
                const active = dataTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(t)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-muted hover:border-foreground/20',
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Starting…' : 'Start discovery →'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
