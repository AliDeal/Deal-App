import { createContext, useContext, useState } from 'react';

const FinancialsContext = createContext();

// Default sample data — will be replaced by CSV upload
const DEFAULT_FINANCIALS = [
  { tag: 'B4', asin: 'B0XXXXXX01', sku: 'B4-WHT-Q', variant: 'White - Queen', normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralFee: 6.75, tacosPct: 12.0 },
  { tag: 'B4', asin: 'B0XXXXXX02', sku: 'B4-WHT-K', variant: 'White - King', normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralFee: 7.50, tacosPct: 11.5 },
  { tag: 'B4', asin: 'B0XXXXXX03', sku: 'B4-GRY-Q', variant: 'Grey - Queen', normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralFee: 6.75, tacosPct: 10.8 },
  { tag: 'B4', asin: 'B0XXXXXX04', sku: 'B4-GRY-K', variant: 'Grey - King', normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralFee: 7.50, tacosPct: 11.2 },
  { tag: 'B4', asin: 'B0XXXXXX05', sku: 'B4-NVY-Q', variant: 'Navy - Queen', normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralFee: 6.75, tacosPct: 13.1 },
  { tag: 'B4', asin: 'B0XXXXXX06', sku: 'B4-NVY-K', variant: 'Navy - King', normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralFee: 7.50, tacosPct: 12.4 },
  { tag: 'B4', asin: 'B0XXXXXX07', sku: 'B4-BEG-Q', variant: 'Beige - Queen', normalPrice: 44.99, cogs: 8.50, fbaFee: 5.80, referralFee: 6.75, tacosPct: 9.5 },
  { tag: 'B4', asin: 'B0XXXXXX08', sku: 'B4-BEG-K', variant: 'Beige - King', normalPrice: 49.99, cogs: 9.80, fbaFee: 6.40, referralFee: 7.50, tacosPct: 10.0 },
  { tag: 'B6', asin: 'B0YYYYYY01', sku: 'B6-WHT-Q', variant: 'White - Queen', normalPrice: 54.99, cogs: 11.20, fbaFee: 6.80, referralFee: 8.25, tacosPct: 14.2 },
  { tag: 'B6', asin: 'B0YYYYYY02', sku: 'B6-WHT-K', variant: 'White - King', normalPrice: 59.99, cogs: 12.50, fbaFee: 7.40, referralFee: 9.00, tacosPct: 13.8 },
  { tag: 'B6', asin: 'B0YYYYYY03', sku: 'B6-GRY-Q', variant: 'Grey - Queen', normalPrice: 54.99, cogs: 11.20, fbaFee: 6.80, referralFee: 8.25, tacosPct: 12.9 },
  { tag: 'B6', asin: 'B0YYYYYY04', sku: 'B6-GRY-K', variant: 'Grey - King', normalPrice: 59.99, cogs: 12.50, fbaFee: 7.40, referralFee: 9.00, tacosPct: 13.1 },
  { tag: 'B6', asin: 'B0YYYYYY05', sku: 'B6-NVY-Q', variant: 'Navy - Queen', normalPrice: 54.99, cogs: 11.20, fbaFee: 6.80, referralFee: 8.25, tacosPct: 15.0 },
  { tag: 'B6', asin: 'B0YYYYYY06', sku: 'B6-NVY-K', variant: 'Navy - King', normalPrice: 59.99, cogs: 12.50, fbaFee: 7.40, referralFee: 9.00, tacosPct: 14.5 },
  { tag: 'S4', asin: 'B0ZZZZZZ01', sku: 'S4-WHT-Q', variant: 'White - Queen', normalPrice: 39.99, cogs: 6.80, fbaFee: 5.20, referralFee: 6.00, tacosPct: 11.0 },
  { tag: 'S4', asin: 'B0ZZZZZZ02', sku: 'S4-WHT-K', variant: 'White - King', normalPrice: 44.99, cogs: 7.90, fbaFee: 5.80, referralFee: 6.75, tacosPct: 10.5 },
  { tag: 'S4', asin: 'B0ZZZZZZ03', sku: 'S4-BLK-Q', variant: 'Black - Queen', normalPrice: 39.99, cogs: 6.80, fbaFee: 5.20, referralFee: 6.00, tacosPct: 10.2 },
  { tag: 'S4', asin: 'B0ZZZZZZ04', sku: 'S4-BLK-K', variant: 'Black - King', normalPrice: 44.99, cogs: 7.90, fbaFee: 5.80, referralFee: 6.75, tacosPct: 9.8 },
  { tag: 'S4', asin: 'B0ZZZZZZ05', sku: 'S4-PNK-Q', variant: 'Pink - Queen', normalPrice: 39.99, cogs: 6.80, fbaFee: 5.20, referralFee: 6.00, tacosPct: 12.3 },
  { tag: 'S4', asin: 'B0ZZZZZZ06', sku: 'S4-PNK-K', variant: 'Pink - King', normalPrice: 44.99, cogs: 7.90, fbaFee: 5.80, referralFee: 6.75, tacosPct: 11.8 },
  { tag: 'S6', asin: 'B0AAAAAA01', sku: 'S6-WHT-Q', variant: 'White - Queen', normalPrice: 49.99, cogs: 9.50, fbaFee: 6.20, referralFee: 7.50, tacosPct: 13.0 },
  { tag: 'S6', asin: 'B0AAAAAA02', sku: 'S6-WHT-K', variant: 'White - King', normalPrice: 54.99, cogs: 10.80, fbaFee: 6.80, referralFee: 8.25, tacosPct: 12.5 },
  { tag: 'S6', asin: 'B0AAAAAA03', sku: 'S6-BLK-Q', variant: 'Black - Queen', normalPrice: 49.99, cogs: 9.50, fbaFee: 6.20, referralFee: 7.50, tacosPct: 11.8 },
  { tag: 'S6', asin: 'B0AAAAAA04', sku: 'S6-BLK-K', variant: 'Black - King', normalPrice: 54.99, cogs: 10.80, fbaFee: 6.80, referralFee: 8.25, tacosPct: 12.0 },
  { tag: 'SS4', asin: 'B0BBBBBB01', sku: 'SS4-WHT-Q', variant: 'White - Queen', normalPrice: 42.99, cogs: 7.50, fbaFee: 5.50, referralFee: 6.45, tacosPct: 11.5 },
  { tag: 'SS4', asin: 'B0BBBBBB02', sku: 'SS4-WHT-K', variant: 'White - King', normalPrice: 47.99, cogs: 8.80, fbaFee: 6.10, referralFee: 7.20, tacosPct: 11.0 },
  { tag: 'SS4', asin: 'B0BBBBBB03', sku: 'SS4-GRY-Q', variant: 'Grey - Queen', normalPrice: 42.99, cogs: 7.50, fbaFee: 5.50, referralFee: 6.45, tacosPct: 10.3 },
  { tag: 'SS4', asin: 'B0BBBBBB04', sku: 'SS4-GRY-K', variant: 'Grey - King', normalPrice: 47.99, cogs: 8.80, fbaFee: 6.10, referralFee: 7.20, tacosPct: 10.8 },
];

export function calcGrossMargin(item, price) {
  const p = price ?? item.normalPrice;
  return p - item.cogs - item.fbaFee - item.referralFee;
}

export function calcGrossMarginPct(item, price) {
  const p = price ?? item.normalPrice;
  if (!p) return 0;
  return (calcGrossMargin(item, price) / p) * 100;
}

export function calcNetMargin(item, price) {
  const p = price ?? item.normalPrice;
  const tacosAmount = p * (item.tacosPct / 100);
  return calcGrossMargin(item, price) - tacosAmount;
}

export function calcNetMarginPct(item, price) {
  const p = price ?? item.normalPrice;
  if (!p) return 0;
  return (calcNetMargin(item, price) / p) * 100;
}

export function FinancialsProvider({ children }) {
  const [financials, setFinancials] = useState(() => {
    try {
      const stored = localStorage.getItem('dealapp-financials');
      return stored ? JSON.parse(stored) : DEFAULT_FINANCIALS;
    } catch { return DEFAULT_FINANCIALS; }
  });

  const updateFinancials = (data) => {
    setFinancials(data);
    localStorage.setItem('dealapp-financials', JSON.stringify(data));
  };

  const getSkuFinancials = (sku) => {
    return financials.find(f => f.sku === sku);
  };

  const getProductFinancials = (tag) => {
    return financials.filter(f => f.tag === tag);
  };

  const resetToDefault = () => {
    updateFinancials(DEFAULT_FINANCIALS);
  };

  return (
    <FinancialsContext.Provider value={{
      financials, updateFinancials, getSkuFinancials, getProductFinancials, resetToDefault,
    }}>
      {children}
    </FinancialsContext.Provider>
  );
}

export function useFinancials() {
  return useContext(FinancialsContext);
}
