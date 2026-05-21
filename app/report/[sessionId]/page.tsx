import Link from 'next/link';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded shadow max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-4">Your discovery report</h1>
        <p className="text-slate-600 mb-6">
          We&apos;ve summarized your conversation into a 1-page PDF you can share with your team.
        </p>
        <Link
          href={`/api/report?session_id=${sessionId}`}
          className="inline-block bg-slate-900 text-white px-4 py-2 rounded"
        >
          Download PDF
        </Link>
      </div>
    </main>
  );
}
