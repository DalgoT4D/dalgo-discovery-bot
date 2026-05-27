'use client';
import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AdminRow {
  id: string;
  email: string;
  is_system: boolean;
  created_at: string;
  created_by: string | null;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function AdminsPageClient() {
  const { data, mutate } = useSWR<{ admins: AdminRow[] }>('/api/admin/admins', fetcher);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === 'email_taken') setError('That email is already an admin.');
      else if (body?.error === 'invalid_body')
        setError('Email must be valid; password must be at least 8 characters.');
      else setError('Something went wrong.');
      return;
    }
    setSuccess(`Added ${email}.`);
    setEmail('');
    setPassword('');
    mutate();
  }

  async function onRemove(id: string, removedEmail: string) {
    if (!confirm(`Remove ${removedEmail}?`)) return;
    const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Could not remove admin.');
      return;
    }
    mutate();
  }

  const admins = data?.admins ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Admins</h1>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-foreground">Add admin</h2>
        <form
          onSubmit={onCreate}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end"
        >
          <label className="block">
            <span className="text-sm font-medium text-foreground">Email</span>
            <Input
              className="mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new-admin@your-org.org"
              disabled={submitting}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Password</span>
            <Input
              className="mt-1"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={submitting}
            />
          </label>
          <Button type="submit" disabled={submitting || !email || !password}>
            {submitting ? 'Adding…' : 'Add admin'}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {success && <p className="mt-2 text-sm text-primary">{success}</p>}
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Added</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 text-foreground">{a.email}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.is_system ? 'System' : 'Admin'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {a.is_system ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRemove(a.id, a.email)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No admins yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
