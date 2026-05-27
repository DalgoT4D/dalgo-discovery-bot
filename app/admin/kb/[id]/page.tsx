import { KbEditor } from '@/components/admin/kb-editor';

export default async function KbEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">{id === 'new' ? 'New KB entry' : 'Edit KB entry'}</h1>
      <KbEditor id={id} />
    </div>
  );
}
