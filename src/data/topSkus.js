// =============================================================================
// TOP SKUs RANKING — used by the "Top Excluded SKUs" section on the Dashboard.
//
// There are TWO ways the rankings can be set:
//
//   1) UPLOAD A CSV through the Dashboard UI ("Upload CSV" button in the
//      Top Excluded SKUs section). The upload is remembered in your browser
//      via localStorage. This is the easiest path while there's no backend.
//      Caveat: each teammate will have to upload their own CSV until we add
//      a backend that shares the rankings across users.
//
//   2) HARDCODE THEM in the TOP_SKUS object below. Anything in this file
//      is the "default" — it ships to every user via the deploy. Uploaded
//      rankings always override the defaults if both exist.
//
// CSV FORMAT (for option 1):
//   Two columns: Parent,SKU
//   The order of rows within each parent = the priority (top row = rank #1).
//   Example:
//     Parent,SKU
//     B4,B4-WHT-Q
//     B4,B4-WHT-K
//     B6,B6-NVY-K
//   You can download a starter template from the Dashboard.
// =============================================================================

// Static defaults — kept empty for now. Uploaded rankings override these.
export const TOP_SKUS = {
  B4:  [],
  B6:  [],
  S4:  [],
  S6:  [],
  SS4: [],
};

// ----- Rank lookups (work against any rankings object you pass in) -----------

// Returns the rank (1-based) of a SKU within its parent product, against
// whichever rankings object you pass in. Returns Infinity if the SKU isn't
// listed — that pushes unranked SKUs to the end when sorting.
export function getSkuRankIn(rankings, parentCode, skuCode) {
  const list = (rankings && rankings[parentCode]) || [];
  const idx = list.indexOf(skuCode);
  return idx === -1 ? Infinity : idx + 1;
}

export function hasRankingsIn(rankings, parentCode) {
  return ((rankings && rankings[parentCode]) || []).length > 0;
}

// Backwards-compat helpers that read from the static TOP_SKUS object.
export function getSkuRank(parentCode, skuCode) {
  return getSkuRankIn(TOP_SKUS, parentCode, skuCode);
}
export function hasRankings(parentCode) {
  return hasRankingsIn(TOP_SKUS, parentCode);
}

// ----- CSV parsing -----------------------------------------------------------

// Parses a Parent,SKU CSV into a rankings object.
// Returns { rankings, count, errors }. Tolerant of:
//   - leading BOM (Excel exports)
//   - CRLF / LF line endings
//   - quoted fields ("B4","B4-WHT-Q")
//   - blank rows
//   - an optional header row (auto-detected if it contains "parent" or "sku")
export function parseTopSkusCsv(csvText) {
  const rankings = {};
  const errors = [];
  let count = 0;

  if (!csvText || typeof csvText !== 'string') {
    return { rankings, count, errors: ['No CSV text provided'] };
  }

  const cleaned = csvText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { rankings, count, errors: ['CSV is empty'] };
  }

  const isHeader = (() => {
    const lower = lines[0].toLowerCase();
    return lower.includes('parent') || lower.includes('sku');
  })();
  const startIdx = isHeader ? 1 : 0;

  if (lines.length === startIdx) {
    return { rankings, count, errors: ['CSV has a header but no data rows'] };
  }

  const stripQuotes = s => s.replace(/^["']|["']$/g, '').trim();

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map(stripQuotes);
    if (parts.length < 2) {
      errors.push(`Row ${i + 1}: expected at least 2 columns (Parent,SKU)`);
      continue;
    }
    const parent = parts[0];
    const sku = parts[1];
    if (!parent || !sku) {
      errors.push(`Row ${i + 1}: empty parent or SKU`);
      continue;
    }
    if (!rankings[parent]) rankings[parent] = [];
    if (rankings[parent].includes(sku)) {
      errors.push(`Row ${i + 1}: duplicate SKU "${sku}" under parent "${parent}" (kept first occurrence)`);
      continue;
    }
    rankings[parent].push(sku);
    count++;
  }

  return { rankings, count, errors };
}

// A small starter CSV the user can download from the Dashboard, edit in
// Excel/Sheets, save as CSV, and upload back.
export const TOP_SKUS_CSV_TEMPLATE = `Parent,SKU
B4,B4-WHT-Q
B4,B4-WHT-K
B4,B4-GRY-Q
B6,B6-WHT-Q
B6,B6-NVY-K
S4,S4-WHT-Q
S6,S6-BLK-K
SS4,SS4-GRY-Q
`;

// ----- localStorage persistence (browser-local until backend exists) ---------

const STORAGE_KEY = 'dealapp.topSkus.v1';

export function loadStoredRankings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredRankings(rankings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredRankings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
