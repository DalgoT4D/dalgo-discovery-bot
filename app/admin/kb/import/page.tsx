import { KbImport } from '@/components/admin/kb-import';

export default async function KbImportPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Import KB content via paste</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Paste raw text. We&apos;ll propose Q&amp;A entries — review, edit, and approve
        the ones to add to the knowledge base.
      </p>
      <KbImport />
    </main>
  );
}
