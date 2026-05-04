interface Orderable {
  id: number;
}

export function computeInsertOrder<T extends Orderable>(
  list: T[],
  insertIndex: number,
  movedProjectId: number,
  getOrder: (p: T) => number,
): number {
  const filtered = list.filter((p) => p.id !== movedProjectId);
  const prev = filtered[insertIndex - 1];
  const next = filtered[insertIndex];
  if (!prev && !next) return 1024;
  if (!prev) return Math.max(1, getOrder(next!) - 1024);
  if (!next) return getOrder(prev) + 1024;
  const prevOrder = getOrder(prev);
  const nextOrder = getOrder(next);
  const mid = Math.floor((prevOrder + nextOrder) / 2);
  if (mid === prevOrder || mid === nextOrder) {
    return prevOrder + 1;
  }
  return mid;
}
