import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db/client';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const { rows } = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM unanswered_questions WHERE reviewed = false`,
  );
  const unansweredCount = rows[0]?.c ?? 0;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-slate-100 p-4 space-y-2 relative">
        <h1 className="text-lg font-semibold mb-4">Discovery Bot Admin</h1>
        <Link className="block hover:underline" href="/admin">
          Leads
        </Link>
        <Link className="block hover:underline" href="/admin/kb">
          Knowledge Base
        </Link>
        <Link className="block hover:underline" href="/admin/blogs">
          Blogs
        </Link>
        <Link className="block hover:underline" href="/admin/unanswered">
          Unanswered{' '}
          {unansweredCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-amber-900 rounded">
              {unansweredCount}
            </span>
          )}
        </Link>
        <Link className="block hover:underline" href="/admin/conversations">
          Conversations
        </Link>
        <div className="absolute bottom-4 left-4 text-xs opacity-70">{session.user.email}</div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
