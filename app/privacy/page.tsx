import { SiteHeader } from '@/components/site-header';

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <article className="prose prose-slate max-w-none text-foreground">
            <h1 className="text-3xl font-semibold mb-6 text-foreground">Privacy notice</h1>

            <p className="text-foreground">
              This page describes how the Dalgo Discovery Bot handles your information.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-2 text-foreground">What we collect</h2>
            <ul className="list-disc ml-6 space-y-1 text-foreground">
              <li>The NGO website URL you provide (if any)</li>
              <li>
                The text of any PDF you upload (with personal identifiers like emails and phone
                numbers automatically redacted before any processing)
              </li>
              <li>The chat messages you send to the assistant</li>
              <li>Your IP address, for rate-limiting only</li>
              <li>
                Your email address, only if you explicitly provide one (e.g., to request a demo or
                receive a PDF report)
              </li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-2 text-foreground">
              What we don&apos;t collect
            </h2>
            <ul className="list-disc ml-6 space-y-1 text-foreground">
              <li>
                We do not store the binary contents of uploaded PDFs — only redacted extracted
                text.
              </li>
              <li>We do not use your data to train AI models.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-2 text-foreground">Retention</h2>
            <p className="text-foreground">
              Anonymous discovery sessions are deleted after 90 days. If you provide an email and
              engage with our team, your conversation is retained as part of the sales record.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-2 text-foreground">Third parties</h2>
            <p className="text-foreground">
              To answer your questions, we send your messages to Anthropic (the LLM provider). To
              learn about your NGO, we may fetch your website via Tavily. We use Resend to send
              emails when you request one.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-2 text-foreground">
              Requesting deletion
            </h2>
            <p className="text-foreground">
              Email <strong>privacy@dalgo.org</strong> with the URL you visited and we will purge
              any session associated with that visit.
            </p>

            <p className="mt-8 text-xs text-muted-foreground">
              Last updated: 2026-05-21. This text needs review by Dalgo&apos;s legal/privacy lead
              before public launch.
            </p>
          </article>
        </div>
      </main>
    </div>
  );
}
