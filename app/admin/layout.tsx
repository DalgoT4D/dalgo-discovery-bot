import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';

const NAV: Array<{ href: string; label: string; badgeKey?: 'unanswered' }> = [
  { href: '/admin', label: 'Leads' },
  { href: '/admin/kb', label: 'Knowledge Base' },
  { href: '/admin/prompts', label: 'Prompts' },
  { href: '/admin/blogs', label: 'Blogs' },
  { href: '/admin/unanswered', label: 'Unanswered', badgeKey: 'unanswered' },
  { href: '/admin/conversations', label: 'Conversations' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const { rows } = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM unanswered_questions WHERE reviewed = false`,
  );
  const unansweredCount = rows[0]?.c ?? 0;

  const isSystem = !!(session?.user as { isSystem?: boolean })?.isSystem;
  const nav: Array<{ href: string; label: string; badgeKey?: 'unanswered' }> = isSystem
    ? [...NAV, { href: '/admin/admins', label: 'Admins' }]
    : NAV;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
          <span className="text-[15px] font-semibold text-foreground">Discovery Bot Admin</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span>{item.label}</span>
              {item.badgeKey === 'unanswered' && unansweredCount > 0 && (
                <Badge variant="primary">{unansweredCount}</Badge>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {session.user.email}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
