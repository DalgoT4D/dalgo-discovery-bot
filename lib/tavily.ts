// Tavily Extract API integration. Returns a trimmed text summary (~3KB) of the
// public NGO website. Returns '' on any failure so callers can degrade gracefully.
export async function fetchAndSummarizeNgoWebsite(
  url: string,
  maxPages = 5,
): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return '';
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: [url],
        max_results: maxPages,
        include_raw_content: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as {
      results?: Array<{ raw_content?: string; content?: string }>;
    };
    const raw = (data.results ?? [])
      .map((r) => r.raw_content ?? r.content ?? '')
      .join('\n\n');
    return raw.slice(0, 3000);
  } catch {
    return '';
  }
}
