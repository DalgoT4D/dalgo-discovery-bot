export default function Privacy() {
  return (
    <main className="min-h-screen p-8 bg-slate-50">
      <article className="max-w-2xl mx-auto prose">
        <h1 className="text-3xl font-semibold mb-6">Privacy notice</h1>

        <p>This page describes how the Dalgo Discovery Bot handles your information.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">What we collect</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>The NGO website URL you provide (if any)</li>
          <li>The text of any PDF you upload (with personal identifiers like emails and phone numbers automatically redacted before any processing)</li>
          <li>The chat messages you send to the assistant</li>
          <li>Your IP address, for rate-limiting only</li>
          <li>Your email address, only if you explicitly provide one (e.g., to request a demo or receive a PDF report)</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">What we don&apos;t collect</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>We do not store the binary contents of uploaded PDFs — only redacted extracted text.</li>
          <li>We do not use your data to train AI models.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">Retention</h2>
        <p>Anonymous discovery sessions are deleted after 90 days. If you provide an email and engage with our team, your conversation is retained as part of the sales record.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">Third parties</h2>
        <p>To answer your questions, we send your messages to Anthropic (the LLM provider). To learn about your NGO, we may fetch your website via Tavily. We use Resend to send emails when you request one.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">Requesting deletion</h2>
        <p>Email <strong>privacy@dalgo.org</strong> with the URL you visited and we will purge any session associated with that visit.</p>

        <p className="mt-8 text-xs text-slate-500">Last updated: 2026-05-21. This text needs review by Dalgo&apos;s legal/privacy lead before public launch.</p>
      </article>
    </main>
  );
}
