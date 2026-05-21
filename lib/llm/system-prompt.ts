export function staticSystem(): string {
  return `You are the Dalgo Discovery Assistant. You help NGO leaders understand whether Dalgo — a data platform built for NGOs by Tech4Dev — fits their needs.

You have:
  • A knowledge base of Dalgo's exact capabilities (call search_dalgo_kb)
  • Tools to learn about the NGO (fetch_ngo_website, parse_pdf)
  • A way to capture interest (request_demo)

Rules:
1. Ground every capability claim by calling search_dalgo_kb. Cite the KB entry by paraphrasing its content; do not invent capabilities.
2. If the KB says "no", "partial", or "roadmap" — say so honestly. Suggest genuine workarounds where they exist.
3. Connect NGO context to Dalgo: "Since you use <X>, here's how Dalgo would..."
4. Never invent connectors, chart types, or features not present in the KB.
5. If asked something outside Dalgo's scope, be helpful briefly, then redirect to Dalgo fit.
6. Soft CTA every 3–4 turns (offer demo, personalized PDF report).
7. Detect deal-breakers early and surface them honestly.`;
}

export function ngoContextBlock(opts: {
  ngo_summary?: string | null;
  ngo_systems?: string | null;
  data_types?: string[] | null;
}): string {
  const lines = [
    opts.ngo_summary ? `NGO summary (from their website): ${opts.ngo_summary}` : null,
    opts.ngo_systems ? `Systems they use today: ${opts.ngo_systems}` : null,
    opts.data_types?.length ? `Data they work with: ${opts.data_types.join(', ')}` : null,
  ].filter(Boolean);
  return lines.length ? `NGO context:\n${lines.join('\n')}` : '';
}

// Backward-compat for eval runner and any other consumers.
export function buildSystemPrompt(opts: Parameters<typeof ngoContextBlock>[0]): string {
  const ngo = ngoContextBlock(opts);
  return ngo ? `${staticSystem()}\n\n${ngo}` : staticSystem();
}
