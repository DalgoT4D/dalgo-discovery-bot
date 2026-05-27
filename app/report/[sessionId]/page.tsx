import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl">Your discovery report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                We&apos;ve summarized your conversation into a 1-page PDF you can share with your
                team.
              </p>
              <Link
                href={`/api/report?session_id=${sessionId}`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Download PDF
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
