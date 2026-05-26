'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ConversationsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('session_id');
  useEffect(() => {
    if (id) router.replace(`/admin/conversations/${id}`);
  }, [id, router]);
  if (!id) return <div>Pick a lead from the leads page.</div>;
  return <div>Redirecting…</div>;
}
