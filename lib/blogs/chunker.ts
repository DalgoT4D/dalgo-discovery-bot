// lib/blogs/chunker.ts
import type { Chunk } from './types';

interface ChunkOpts {
  targetWords?: number;
  overlapWords?: number;
}

function splitSections(md: string): string[] {
  // Split on ## or ### at line start, keep the heading with the section that follows
  const parts = md.split(/(?=^##+ )/m);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

export function chunkMarkdown(md: string, opts: ChunkOpts = {}): Chunk[] {
  const target = opts.targetWords ?? 300;
  const overlap = opts.overlapWords ?? 50;
  const sections = splitSections(md);
  const out: Chunk[] = [];
  let idx = 0;

  for (const section of sections) {
    const w = words(section);
    if (w.length <= target) {
      out.push({ chunkIndex: idx++, chunkText: section });
      continue;
    }
    let cursor = 0;
    while (cursor < w.length) {
      const end = Math.min(cursor + target, w.length);
      const chunk = w.slice(cursor, end).join(' ');
      out.push({ chunkIndex: idx++, chunkText: chunk });
      if (end >= w.length) break;
      cursor = Math.max(0, end - overlap);
    }
  }

  return out;
}
