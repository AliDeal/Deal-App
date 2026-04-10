// =============================================================================
// TOP SKUs RANKING — used by the "Top Excluded SKUs" section on the Dashboard.
//
// HOW TO FILL THIS IN:
//   For each parent product, list the SKU codes in order of importance.
//   The first SKU in the array is the most important (rank #1), the second
//   is rank #2, and so on. The Dashboard will use these rankings to surface
//   the "top 5 most important SKUs that got excluded" from any given deal.
//
// EXAMPLE:
//   B4: ['B4-WHT-Q', 'B4-WHT-K', 'B4-GRY-Q', 'B4-NVY-K', ...]
//   means B4-WHT-Q is the most important B4 SKU, B4-WHT-K is second, etc.
//
// WHILE THIS FILE IS EMPTY:
//   The Dashboard's "Top Excluded SKUs" section will show a friendly message
//   asking you to populate it. Nothing breaks — the rest of the app keeps
//   working normally.
//
// WHEN YOU HAVE YOUR REAL RANKINGS:
//   Either edit this file directly, or paste the rankings into a chat with
//   Claude and they'll fill it in for you. No code knowledge required.
// =============================================================================

export const TOP_SKUS = {
  B4:  [],   // e.g. ['B4-WHT-Q', 'B4-WHT-K', 'B4-GRY-Q', ...]
  B6:  [],
  S4:  [],
  S6:  [],
  SS4: [],
};

// Returns the rank (1-based) of a SKU within its parent product.
// Returns Infinity if the SKU isn't in the rankings — sorts unranked SKUs last.
export function getSkuRank(parentCode, skuCode) {
  const list = TOP_SKUS[parentCode] || [];
  const idx = list.indexOf(skuCode);
  return idx === -1 ? Infinity : idx + 1;
}

// Returns true if rankings have been provided for this parent product.
export function hasRankings(parentCode) {
  return (TOP_SKUS[parentCode] || []).length > 0;
}
