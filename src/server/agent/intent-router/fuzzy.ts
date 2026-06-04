import Fuse from "fuse.js";

export interface Labeled {
  id: string;
  label: string;
}

/** Return the closest item to `query`, or null if below the confidence cutoff. */
export function bestMatch<T extends Labeled>(query: string, items: T[]): T | null {
  if (!query.trim() || items.length === 0) return null;
  const fuse = new Fuse(items, {
    keys: ["label"],
    includeScore: true,
    threshold: 0.45, // lower = stricter; 0 is exact
  });
  const results = fuse.search(query);
  if (results.length === 0) return null;
  const top = results[0];
  if (top.score != null && top.score > 0.45) return null;
  return top.item;
}
