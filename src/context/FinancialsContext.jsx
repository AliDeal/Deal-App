import { createContext, useContext, useState } from 'react';

// =============================================================================
// FINANCIALS MODEL
//
// Single canonical SKU record with this shape:
//   { tag, asin, sku, variant, normalPrice, cogs, fbaFee, referralRate, tacosPct }
//
// Key facts:
//   - referralFee is NOT stored. It's always derived as price × referralRate
//     because Amazon charges referral as a percentage of selling price. That means
//     a SKU has a different referral fee at normal price vs. at deal price.
//   - referralRate defaults to 0.15 (15%) for sheet sets / bedding category.
//   - Deal Price is NOT stored here. Deal prices vary per (deal, SKU) pair and
//     come exclusively from the Deal Financials upload. This file holds the
//     baseline product cost structure only.
//
// Helpers exposed by the context:
//   - getSkuFinancials(sku)            — lookup by SKU code
//   - getSkuFinancialsByAsin(asin)     — lookup by ASIN (fallback when SKU codes differ)
//   - findSku(sku, asin)               — sku-first, asin-fallback combined lookup
//
// Pure helpers (importable without the hook):
//   - calcReferralFee(item, price)     — price × referralRate (or normalPrice if no price)
//   - calcGrossMargin(item, price)     — price - cogs - fbaFee - referralFee
//   - calcGrossMarginPct(item, price)
//   - calcNetMargin(item, price)       — gross - (price × tacosPct/100)
//   - calcNetMarginPct(item, price)
// =============================================================================

const DEFAULT_REFERRAL_RATE = 0.15;

const FinancialsContext = createContext();

// Default sample data — replaced when the user uploads via Product Financials.
// Holds the baseline product cost structure only. Deal prices live in the
// Deal Financials uploaded data, since they vary per (deal, SKU).
const DEFAULT_FINANCIALS = [
  { tag: 'B4', asin: 'B0XXXXXX01', sku: 'B4-WHT-Q', variant: 'White - Queen', normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralRate: 0.15, tacosPct: 12.0 },
  { tag: 'B4', asin: 'B0XXXXXX02', sku: 'B4-WHT-K', variant: 'White - King',  normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralRate: 0.15, tacosPct: 11.5 },
  { tag: 'B4', asin: 'B0XXXXXX03', sku: 'B4-GRY-Q', variant: 'Grey - Queen',  normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralRate: 0.15, tacosPct: 10.8 },
  { tag: 'B4', asin: 'B0XXXXXX04', sku: 'B4-GRY-K', variant: 'Grey - King',   normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralRate: 0.15, tacosPct: 11.2 },
  { tag: 'B4', asin: 'B0XXXXXX05', sku: 'B4-NVY-Q', variant: 'Navy - Queen',  normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralRate: 0.15, tacosPct: 13.1 },
  { tag: 'B4', asin: 'B0XXXXXX06', sku: 'B4-NVY-K', variant: 'Navy - King',   normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralRate: 0.15, tacosPct: 12.4 },
  { tag: 'B4', asin: 'B0XXXXXX07', sku: 'B4-BEG-Q', variant: 'Beige - Queen', normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralRate: 0.15, tacosPct: 9.5  },
  { tag: 'B4', asin: 'B0XXXXXX08', sku: 'B4-BEG-K', variant: 'Beige - King',  normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralRate: 0.15, tacosPct: 10.0 },
  { tag: 'B6', asin: 'B0YYYYYY01', sku: 'B6-WHT-Q', variant: 'White - Queen', normalPrice: 54.99, cogs: 11.20, fbaFee: 6.80, referralRate: 0.15, tacosPct: 14.2 },
  { tag: 'B6', asin: 'B0YYYYYY02', sku: 'B6-WHT-K', variant: 'White - King',  normalPrice: 59.99, cogs: 12.50, fbaFee: 7.40, referralRate: 0.15, tacosPct: 13.8 },
  { tag: 'B6', asin: 'B0YYYYYY03', sku: 'B6-GRY-Q', variant: 'Grey - Queen',  normalPrice: 54.99, cogs: 11.20, fbaFee: 6.80, referralRate: 0.15, tacosPct: 12.9 },
  { tag: 'B6', asin: 'B0YYYYYY04', sku: 'B6-GRY-K', variant: 'Grey - King',   normalPrice: 59.99, cogs: 12.50, fbaFee: 7.40, referralRate: 0.15, tacosPct: 13.1 },
  { tag: 'B6', asin: 'B0YYYYYY05', sku: 'B6-NVY-Q', variant: 'Navy - Queen',  normalPrice: 54.99, cogs: 11.20, fbaFee: 6.80, referralRate: 0.15, tacosPct: 15.0 },
  { tag: 'B6', asin: 'B0YYYYYY06', sku: 'B6-NVY-K', variant: 'Navy - King',   normalPrice: 59.99, cogs: 12.50, fbaFee: 7.40, referralRate: 0.15, tacosPct: 14.5 },
  { tag: 'S4', asin: 'B0ZZZZZZ01', sku: 'S4-WHT-Q', variant: 'White - Queen', normalPrice: 39.99, cogs: 6.80, fbaFee: 5.20, referralRate: 0.15, tacosPct: 11.0 },
  { tag: 'S4', asin: 'B0ZZZZZZ02', sku: 'S4-WHT-K', variant: 'White - King',  normalPrice: 44.99, cogs: 7.90, fbaFee: 5.80, referralRate: 0.15, tacosPct: 10.5 },
  { tag: 'S4', asin: 'B0ZZZZZZ03', sku: 'S4-BLK-Q', variant: 'Black - Queen', normalPrice: 39.99, cogs: 6.80, fbaFee: 5.20, referralRate: 0.15, tacosPct: 10.2 },
  { tag: 'S4', asin: 'B0ZZZZZZ04', sku: 'S4-BLK-K', variant: 'Black - King',  normalPrice: 44.99, cogs: 7.90, fbaFee: 5.80, referralRate: 0.15, tacosPct: 9.8  },
  { tag: 'S4', asin: 'B0ZZZZZZ05', sku: 'S4-PNK-Q', variant: 'Pink - Queen',  normalPrice: 39.99, cogs: 6.80, fbaFee: 5.20, referralRate: 0.15, tacosPct: 12.3 },
  { tag: 'S4', asin: 'B0ZZZZZZ06', sku: 'S4-PNK-K', variant: 'Pink - King',   normalPrice: 44.99, cogs: 7.90, fbaFee: 5.80, referralRate: 0.15, tacosPct: 11.8 },
  { tag: 'S6', asin: 'B0AAAAAA01', sku: 'S6-WHT-Q', variant: 'White - Queen', normalPrice: 49.99, cogs: 9.50, fbaFee: 6.20, referralRate: 0.15, tacosPct: 13.0 },
  { tag: 'S6', asin: 'B0AAAAAA02', sku: 'S6-WHT-K', variant: 'White - King',  normalPrice: 54.99, cogs: 10.80, fbaFee: 6.80, referralRate: 0.15, tacosPct: 12.5 },
  { tag: 'S6', asin: 'B0AAAAAA03', sku: 'S6-BLK-Q', variant: 'Black - Queen', normalPrice: 49.99, cogs: 9.50, fbaFee: 6.20, referralRate: 0.15, tacosPct: 11.8 },
  { tag: 'S6', asin: 'B0AAAAAA04', sku: 'S6-BLK-K', variant: 'Black - King',  normalPrice: 54.99, cogs: 10.80, fbaFee: 6.80, referralRate: 0.15, tacosPct: 12.0 },
  { tag: 'SS4', asin: 'B0BBBBBB01', sku: 'SS4-WHT-Q', variant: 'White - Queen', normalPrice: 42.99, cogs: 7.50, fbaFee: 5.50, referralRate: 0.15, tacosPct: 11.5 },
  { tag: 'SS4', asin: 'B0BBBBBB02', sku: 'SS4-WHT-K', variant: 'White - King',  normalPrice: 47.99, cogs: 8.80, fbaFee: 6.10, referralRate: 0.15, tacosPct: 11.0 },
  { tag: 'SS4', asin: 'B0BBBBBB03', sku: 'SS4-GRY-Q', variant: 'Grey - Queen',  normalPrice: 42.99, cogs: 7.50, fbaFee: 5.50, referralRate: 0.15, tacosPct: 10.3 },
  { tag: 'SS4', asin: 'B0BBBBBB04', sku: 'SS4-GRY-K', variant: 'Grey - King',   normalPrice: 47.99, cogs: 8.80, fbaFee: 6.10, referralRate: 0.15, tacosPct: 10.8 },
];

// ----- Pure calculation helpers ---------------------------------------------

// Resolve the referral rate for an item, with fallbacks for legacy uploads.
// Order: explicit referralRate → derive from legacy referralFee/normalPrice → default 15%.
function resolveReferralRate(item) {
  if (typeof item?.referralRate === 'number' && !isNaN(item.referralRate)) {
    return item.referralRate;
  }
  if (typeof item?.referralFee === 'number' && item?.normalPrice) {
    return item.referralFee / item.normalPrice;
  }
  return DEFAULT_REFERRAL_RATE;
}

export function calcReferralFee(item, price) {
  const p = price ?? item?.normalPrice ?? 0;
  return p * resolveReferralRate(item);
}

export function calcGrossMargin(item, price) {
  if (!item) return 0;
  const p = price ?? item.normalPrice;
  return p - (item.cogs || 0) - (item.fbaFee || 0) - calcReferralFee(item, p);
}

export function calcGrossMarginPct(item, price) {
  const p = price ?? item?.normalPrice;
  if (!p) return 0;
  return (calcGrossMargin(item, price) / p) * 100;
}

export function calcNetMargin(item, price) {
  if (!item) return 0;
  const p = price ?? item.normalPrice;
  const tacosAmount = p * ((item.tacosPct || 0) / 100);
  return calcGrossMargin(item, price) - tacosAmount;
}

export function calcNetMarginPct(item, price) {
  const p = price ?? item?.normalPrice;
  if (!p) return 0;
  return (calcNetMargin(item, price) / p) * 100;
}

// ----- Schema migration for stored data --------------------------------------

// If the user has old localStorage records, migrate them in-memory so
// calculations work without re-uploading.
function migrateRecord(r) {
  const out = { ...r };
  if (typeof out.referralRate !== 'number') {
    if (typeof out.referralFee === 'number' && out.normalPrice) {
      out.referralRate = out.referralFee / out.normalPrice;
    } else {
      out.referralRate = DEFAULT_REFERRAL_RATE;
    }
  }
  // Drop legacy fields that no longer belong on the financials record.
  delete out.referralFee;     // now derived dynamically
  delete out.ppcSpend;        // dead data
  delete out.defaultDealPrice; // deal prices live in Deal Financials uploads, not here
  return out;
}

function migrateAll(records) {
  if (!Array.isArray(records)) return DEFAULT_FINANCIALS;
  return records.map(migrateRecord);
}

// ----- React context --------------------------------------------------------

export function FinancialsProvider({ children }) {
  const [financials, setFinancials] = useState(() => {
    try {
      const stored = localStorage.getItem('dealapp-financials');
      if (!stored) return DEFAULT_FINANCIALS;
      return migrateAll(JSON.parse(stored));
    } catch {
      return DEFAULT_FINANCIALS;
    }
  });

  const updateFinancials = (data) => {
    const migrated = migrateAll(data);
    setFinancials(migrated);
    try {
      localStorage.setItem('dealapp-financials', JSON.stringify(migrated));
    } catch {
      // ignore storage errors
    }
  };

  const getSkuFinancials = (skuCode) => {
    if (!skuCode) return undefined;
    return financials.find(f => f.sku === skuCode);
  };

  const getSkuFinancialsByAsin = (asin) => {
    if (!asin) return undefined;
    return financials.find(f => f.asin === asin);
  };

  // Look up by SKU code, falling back to ASIN. Returns undefined if neither matches.
  const findSku = (skuCode, asin) => {
    return getSkuFinancials(skuCode) || getSkuFinancialsByAsin(asin);
  };

  const getProductFinancials = (tag) => {
    return financials.filter(f => f.tag === tag);
  };

  const resetToDefault = () => {
    updateFinancials(DEFAULT_FINANCIALS);
  };

  return (
    <FinancialsContext.Provider value={{
      financials,
      updateFinancials,
      getSkuFinancials,
      getSkuFinancialsByAsin,
      findSku,
      getProductFinancials,
      resetToDefault,
    }}>
      {children}
    </FinancialsContext.Provider>
  );
}

export function useFinancials() {
  return useContext(FinancialsContext);
}
