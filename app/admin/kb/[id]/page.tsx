import { KbEditor } from '@/components/admin/kb-editor';

export default async function KbEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">{id === 'new' ? 'New KB entry' : 'Edit KB entry'}</h2>
      <KbEditor id={id} />
    </div>
  );
}
