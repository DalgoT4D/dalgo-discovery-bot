import { KbEditor } from '@/components/admin/kb-editor';
import { KbVersionsPanel } from '@/components/admin/kb-versions-panel';

export default async function KbEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">{id === 'new' ? 'New KB entry' : 'Edit KB entry'}</h1>
      <KbEditor id={id} />
      {id !== 'new' && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-3">Version history</h2>
          <KbVersionsPanel kbId={id} />
        </section>
      )}
    </div>
  );
}
