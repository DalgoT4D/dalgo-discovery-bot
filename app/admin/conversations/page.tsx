'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function ConversationsFallback() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="h-6 w-40 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

function ConversationsList() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('session_id');
  useEffect(() => {
    if (id) router.replace(`/admin/conversations/${id}`);
  }, [id, router]);
  if (!id) return <div>Pick a lead from the leads page.</div>;
  return <div>Redirecting…</div>;
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<ConversationsFallback />}>
      <ConversationsList />
    </Suspense>
  );
}
