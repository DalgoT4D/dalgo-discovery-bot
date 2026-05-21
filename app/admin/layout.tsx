import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

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
        <Link className="block hover:underline" href="/admin/conversations">
          Conversations
        </Link>
        <div className="absolute bottom-4 left-4 text-xs opacity-70">{session.user.email}</div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
