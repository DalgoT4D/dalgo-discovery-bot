export function parseSitemap(xml: string, canonicalHost?: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1]);
  }
  if (!canonicalHost) return urls;
  const target = new URL(canonicalHost);
  return urls.map((u) => {
    try {
      const parsed = new URL(u);
      parsed.protocol = target.protocol;
      parsed.host = target.host;
      return parsed.toString();
    } catch {
      return u;
    }
  });
}
