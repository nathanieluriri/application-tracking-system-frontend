export interface Labeled {
  id: string;
  label: string;
}

/**
 * Lightweight fuzzy entity resolver — no external dependency.
 *
 * Scores each item's label against the query using a blend of:
 *  - normalized substring containment (query inside label, or vice-versa), and
 *  - token overlap (how many query words appear as label words / prefixes).
 * Returns the best item above a confidence cutoff, or null. A small, dependency-
 * free matcher is plenty for resolving a short phrase ("backend engineer") to a
 * known entity ("Senior Backend Engineer"); anything it can't confidently match
 * falls through to the LLM upstream.
 */

const MATCH_THRESHOLD = 0.45;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  const n = normalize(value);
  return n ? n.split(" ") : [];
}

/** 0..1 score; higher is a better match. */
function score(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (q === l) return 1;

  // Substring containment is a strong signal in either direction.
  if (l.includes(q) || q.includes(l)) {
    const [shorter, longer] = q.length <= l.length ? [q, l] : [l, q];
    return 0.6 + 0.4 * (shorter.length / longer.length);
  }

  // Token overlap: fraction of query tokens that appear as a label token
  // (exact or prefix match handles minor variations like "engineer"/"engineers").
  const qTokens = tokens(q);
  const lTokens = tokens(l);
  if (qTokens.length === 0 || lTokens.length === 0) return 0;

  let hits = 0;
  for (const qt of qTokens) {
    if (
      lTokens.some(
        (lt) => lt === qt || (qt.length >= 3 && (lt.startsWith(qt) || qt.startsWith(lt))),
      )
    ) {
      hits += 1;
    }
  }
  return hits / qTokens.length;
}

/** Return the closest item to `query`, or null if below the confidence cutoff. */
export function bestMatch<T extends Labeled>(query: string, items: T[]): T | null {
  if (!query.trim() || items.length === 0) return null;

  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const s = score(query, item.label);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
