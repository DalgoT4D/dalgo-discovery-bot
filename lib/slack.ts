export async function postHotLead(payload: {
  email: string;
  ngo_url?: string;
  summary?: string;
  session_id: string;
}): Promise<void> {
  if (!process.env.SLACK_HOT_LEAD_WEBHOOK_URL) return;
  const text = `🔥 *Hot lead*\nEmail: ${payload.email}\nNGO: ${payload.ngo_url ?? '—'}\nSession: ${payload.session_id}\n\n${payload.summary ?? ''}`;
  try {
    await fetch(process.env.SLACK_HOT_LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Slack errors should not break the chat flow.
  }
}
