export const PAGE_SIZE = 20;

export function mergePage<T extends { id: string }>(existing: T[], incoming: T[], pageSize: number) {
  const seen = new Set(existing.map(i => i.id));
  const items = [...existing, ...incoming.filter(i => !seen.has(i.id))];
  return { items, hasMore: incoming.length === pageSize };
}
