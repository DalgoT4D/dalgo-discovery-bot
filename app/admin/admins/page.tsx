import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminsPageClient } from './admins-client';

export default async function AdminsPage() {
  const session = await auth();
  if (!session?.user || !(session.user as { isSystem?: boolean }).isSystem) {
    redirect('/admin');
  }
  return <AdminsPageClient />;
}
