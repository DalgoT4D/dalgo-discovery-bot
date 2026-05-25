export interface RrfInput<T extends { id: string; source?: string }> {
  lists: T[][];
  k?: number;
  boostBySource?: Record<string, number>;
  topK?: number;
}

export interface FusedResult<T> {
  item: T;
  score: number;
}

export function fuseRrf<T extends { id: string; source?: string }>(
  input: RrfInput<T>,
): FusedResult<T>[] {
  const k = input.k ?? 60;
  const boosts = input.boostBySource ?? {};
  const scores = new Map<string, number>();
  const items = new Map<string, T>();

  for (const list of input.lists) {
    list.forEach((item, idx) => {
      const rank = idx + 1;
      const contribution = 1 / (k + rank);
      const prev = scores.get(item.id) ?? 0;
      scores.set(item.id, prev + contribution);
      if (!items.has(item.id)) items.set(item.id, item);
    });
  }

  const fused: FusedResult<T>[] = [];
  for (const [id, score] of scores.entries()) {
    const item = items.get(id)!;
    const boost = item.source ? boosts[item.source] ?? 1 : 1;
    fused.push({ item, score: score * boost });
  }
  fused.sort((a, b) => b.score - a.score);
  return input.topK ? fused.slice(0, input.topK) : fused;
}
