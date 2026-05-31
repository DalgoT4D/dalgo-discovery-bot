'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { workDomainLabel } from '@/lib/work-domains';

type TriageStatus = 'new' | 'approved' | 'rejected';

type LeadRow = {
  session_id: string;
  created_at: string;
  email: string;
  work_domain: string | null;
  ngo_url: string | null;
  wants_followup: boolean;
  requested_demo: boolean;
  triage_status: TriageStatus;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const TABS: TriageStatus[] = ['new', 'approved', 'rejected'];

export function LeadTable() {
  const { data, error, isLoading, mutate } = useSWR<{ items: LeadRow[] }>(
    '/api/admin/leads',
    fetcher,
  );
  const [tab, setTab] = useState<TriageStatus>('new');
  const [actionError, setActionError] = useState<string | null>(null);

  async function setStatus(sessionId: string, status: TriageStatus) {
    setActionError(null);
    let res: Response;
    try {
      res = await fetch(`/api/admin/leads/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ triage_status: status }),
      });
    } catch {
      setActionError('Network error — could not update the lead. Try again.');
      return;
    }
    if (!res.ok) {
      setActionError(
        res.status === 401
          ? 'Your admin session expired. Reload and sign in again to update leads.'
          : `Could not update the lead (error ${res.status}).`,
      );
      return;
    }
    mutate();
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error.</p>;

  const items = data?.items ?? [];
  const rows = items.filter((l) => l.triage_status === tab);
  const count = (s: TriageStatus) => items.filter((l) => l.triage_status === s).length;

  return (
    <Card className="space-y-4 p-4">
      {actionError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'rounded-md px-3 py-1.5 text-sm capitalize ' +
              (tab === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80')
            }
          >
            {t} ({count(t)})
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-2">Created</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">NGO URL</th>
            <th className="p-2">Follow-up?</th>
            <th className="p-2">Demo?</th>
            <th className="p-2"></th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.session_id} className="border-b border-border">
              <td className="p-2">{new Date(l.created_at).toLocaleString()}</td>
              <td className="p-2">{l.email}</td>
              <td className="p-2">{workDomainLabel(l.work_domain)}</td>
              <td className="p-2">{l.ngo_url ?? '—'}</td>
              <td className="p-2">{l.wants_followup ? '✓' : '—'}</td>
              <td className="p-2">{l.requested_demo ? '✓' : '—'}</td>
              <td className="p-2">
                <Link
                  href={`/admin/conversations/${l.session_id}`}
                  className="text-primary underline"
                >
                  transcript
                </Link>
              </td>
              <td className="p-2">
                <div className="flex gap-1">
                  {l.triage_status !== 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(l.session_id, 'approved')}>
                      Approve
                    </Button>
                  )}
                  {l.triage_status !== 'rejected' && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(l.session_id, 'rejected')}>
                      Reject
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-4 text-muted-foreground" colSpan={8}>
                No {tab} leads.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
