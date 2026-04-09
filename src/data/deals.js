export const MARKETPLACES = {
  US: { name: 'United States', flag: 'US', code: 'US' },
  CA: { name: 'Canada', flag: 'CA', code: 'CA' },
};

export const PRODUCTS = {
  B4: { name: 'Bamboo 4PC', color: '#66bb6a', shortName: 'B4' },
  B6: { name: 'Bamboo 6PC', color: '#2e7d32', shortName: 'B6' },
  S4: { name: 'Satin 4PC', color: '#64b5f6', shortName: 'S4' },
  S6: { name: 'Satin 6PC', color: '#1a3a6b', shortName: 'S6' },
  SS4: { name: 'Satin Stripe 4PC', color: '#9e9e9e', shortName: 'SS4' },
};

export const DEAL_TYPES = {
  LD: { name: 'Lightning Deal', color: '#e67e22' },
  BD: { name: 'Best Deal', color: '#3498db' },
  'Lightning Deal': { name: 'Lightning Deal', color: '#e67e22' },
  'Best Deal': { name: 'Best Deal', color: '#3498db' },
};

// SKUs per product with cost structure for margin calculation
// Margin = Deal Price - COGS - FBA Fee - Referral Fee - PPC Spend
export const PRODUCT_SKUS = {
  B4: [
    { sku: 'B4-WHT-Q', variant: 'White - Queen', asin: 'B0XXXXXX01', dealPrice: 34.99, cogs: 8.50, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 3.20 },
    { sku: 'B4-WHT-K', variant: 'White - King', asin: 'B0XXXXXX02', dealPrice: 39.99, cogs: 9.80, fbaFee: 6.40, referralFee: 6.00, ppcSpend: 3.50 },
    { sku: 'B4-GRY-Q', variant: 'Grey - Queen', asin: 'B0XXXXXX03', dealPrice: 34.99, cogs: 8.50, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 2.90 },
    { sku: 'B4-GRY-K', variant: 'Grey - King', asin: 'B0XXXXXX04', dealPrice: 39.99, cogs: 9.80, fbaFee: 6.40, referralFee: 6.00, ppcSpend: 3.10 },
    { sku: 'B4-NVY-Q', variant: 'Navy - Queen', asin: 'B0XXXXXX05', dealPrice: 34.99, cogs: 8.50, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 3.40 },
    { sku: 'B4-NVY-K', variant: 'Navy - King', asin: 'B0XXXXXX06', dealPrice: 39.99, cogs: 9.80, fbaFee: 6.40, referralFee: 6.00, ppcSpend: 3.80 },
    { sku: 'B4-BEG-Q', variant: 'Beige - Queen', asin: 'B0XXXXXX07', dealPrice: 34.99, cogs: 8.50, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 2.70 },
    { sku: 'B4-BEG-K', variant: 'Beige - King', asin: 'B0XXXXXX08', dealPrice: 39.99, cogs: 9.80, fbaFee: 6.40, referralFee: 6.00, ppcSpend: 3.00 },
  ],
  B6: [
    { sku: 'B6-WHT-Q', variant: 'White - Queen', asin: 'B0YYYYYY01', dealPrice: 44.99, cogs: 11.20, fbaFee: 6.80, referralFee: 6.75, ppcSpend: 4.10 },
    { sku: 'B6-WHT-K', variant: 'White - King', asin: 'B0YYYYYY02', dealPrice: 49.99, cogs: 12.50, fbaFee: 7.40, referralFee: 7.50, ppcSpend: 4.50 },
    { sku: 'B6-GRY-Q', variant: 'Grey - Queen', asin: 'B0YYYYYY03', dealPrice: 44.99, cogs: 11.20, fbaFee: 6.80, referralFee: 6.75, ppcSpend: 3.80 },
    { sku: 'B6-GRY-K', variant: 'Grey - King', asin: 'B0YYYYYY04', dealPrice: 49.99, cogs: 12.50, fbaFee: 7.40, referralFee: 7.50, ppcSpend: 4.20 },
    { sku: 'B6-NVY-Q', variant: 'Navy - Queen', asin: 'B0YYYYYY05', dealPrice: 44.99, cogs: 11.20, fbaFee: 6.80, referralFee: 6.75, ppcSpend: 4.30 },
    { sku: 'B6-NVY-K', variant: 'Navy - King', asin: 'B0YYYYYY06', dealPrice: 49.99, cogs: 12.50, fbaFee: 7.40, referralFee: 7.50, ppcSpend: 4.60 },
  ],
  S4: [
    { sku: 'S4-WHT-Q', variant: 'White - Queen', asin: 'B0ZZZZZZ01', dealPrice: 29.99, cogs: 6.80, fbaFee: 5.20, referralFee: 4.50, ppcSpend: 2.80 },
    { sku: 'S4-WHT-K', variant: 'White - King', asin: 'B0ZZZZZZ02', dealPrice: 34.99, cogs: 7.90, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 3.10 },
    { sku: 'S4-BLK-Q', variant: 'Black - Queen', asin: 'B0ZZZZZZ03', dealPrice: 29.99, cogs: 6.80, fbaFee: 5.20, referralFee: 4.50, ppcSpend: 2.60 },
    { sku: 'S4-BLK-K', variant: 'Black - King', asin: 'B0ZZZZZZ04', dealPrice: 34.99, cogs: 7.90, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 2.90 },
    { sku: 'S4-PNK-Q', variant: 'Pink - Queen', asin: 'B0ZZZZZZ05', dealPrice: 29.99, cogs: 6.80, fbaFee: 5.20, referralFee: 4.50, ppcSpend: 3.00 },
    { sku: 'S4-PNK-K', variant: 'Pink - King', asin: 'B0ZZZZZZ06', dealPrice: 34.99, cogs: 7.90, fbaFee: 5.80, referralFee: 5.25, ppcSpend: 3.30 },
  ],
  S6: [
    { sku: 'S6-WHT-Q', variant: 'White - Queen', asin: 'B0AAAAAA01', dealPrice: 39.99, cogs: 9.50, fbaFee: 6.20, referralFee: 6.00, ppcSpend: 3.60 },
    { sku: 'S6-WHT-K', variant: 'White - King', asin: 'B0AAAAAA02', dealPrice: 44.99, cogs: 10.80, fbaFee: 6.80, referralFee: 6.75, ppcSpend: 4.00 },
    { sku: 'S6-BLK-Q', variant: 'Black - Queen', asin: 'B0AAAAAA03', dealPrice: 39.99, cogs: 9.50, fbaFee: 6.20, referralFee: 6.00, ppcSpend: 3.40 },
    { sku: 'S6-BLK-K', variant: 'Black - King', asin: 'B0AAAAAA04', dealPrice: 44.99, cogs: 10.80, fbaFee: 6.80, referralFee: 6.75, ppcSpend: 3.80 },
  ],
  SS4: [
    { sku: 'SS4-WHT-Q', variant: 'White - Queen', asin: 'B0BBBBBB01', dealPrice: 32.99, cogs: 7.50, fbaFee: 5.50, referralFee: 4.95, ppcSpend: 3.00 },
    { sku: 'SS4-WHT-K', variant: 'White - King', asin: 'B0BBBBBB02', dealPrice: 37.99, cogs: 8.80, fbaFee: 6.10, referralFee: 5.70, ppcSpend: 3.30 },
    { sku: 'SS4-GRY-Q', variant: 'Grey - Queen', asin: 'B0BBBBBB03', dealPrice: 32.99, cogs: 7.50, fbaFee: 5.50, referralFee: 4.95, ppcSpend: 2.80 },
    { sku: 'SS4-GRY-K', variant: 'Grey - King', asin: 'B0BBBBBB04', dealPrice: 37.99, cogs: 8.80, fbaFee: 6.10, referralFee: 5.70, ppcSpend: 3.10 },
  ],
};

// Calculate margin: Deal Price - COGS - FBA Fee - Referral Fee - PPC Spend
export function calcMargin(sku) {
  const margin = sku.dealPrice - sku.cogs - sku.fbaFee - sku.referralFee - sku.ppcSpend;
  return margin;
}

export function calcMarginPct(sku) {
  if (!sku.dealPrice) return 0;
  return (calcMargin(sku) / sku.dealPrice) * 100;
}

function parseDate(str) {
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const [d, m, y] = str.split('-');
  return new Date(parseInt(y), months[m], parseInt(d));
}

function normalizeDealType(type) {
  const t = type.trim();
  if (t === 'LD' || t === 'Lightning Deal') return 'LD';
  if (t === 'BD' || t === 'Best Deal') return 'BD';
  return t;
}

const csvData = `D001,B6,LD,02-Jan-2026,02-Jan-2026,1,02-Jan to 02-Jan,US
D002,B6,BD,06-Jan-2026,17-Jan-2026,12,06-Jan to 17-Jan,US
D003,S4,LD,15-Jan-2026,15-Jan-2026,1,15-Jan to 15-Jan,US
D004,B4,LD,16-Jan-2026,16-Jan-2026,1,16-Jan to 16-Jan,US
D005,S4,LD,22-Jan-2026,22-Jan-2026,1,22-Jan to 22-Jan,US
D006,B4,LD,23-Jan-2026,23-Jan-2026,1,23-Jan to 23-Jan,US
D007,B6,LD,24-Jan-2026,24-Jan-2026,1,24-Jan to 24-Jan,US
D008,B4,LD,27-Jan-2026,27-Jan-2026,1,27-Jan to 27-Jan,US
D009,S4,LD,29-Jan-2026,29-Jan-2026,1,29-Jan to 29-Jan,US
D010,B6,LD,01-Feb-2026,01-Feb-2026,1,01-Feb to 01-Feb,US
D011,B4,LD,06-Feb-2026,06-Feb-2026,1,06-Feb to 06-Feb,US
D012,B6,LD,06-Feb-2026,06-Feb-2026,1,06-Feb to 06-Feb,US
D013,S4,LD,06-Feb-2026,06-Feb-2026,1,06-Feb to 06-Feb,US
D014,B4,LD,14-Feb-2026,14-Feb-2026,1,14-Feb to 14-Feb,US
D015,S4,BD,09-Feb-2026,22-Feb-2026,14,09-Feb to 22-Feb,US
D016,B6,BD,13-Feb-2026,26-Feb-2026,14,13-Feb to 26-Feb,US
D017,B4,LD,21-Feb-2026,21-Feb-2026,1,21-Feb to 21-Feb,US
D018,S4,LD,26-Feb-2026,26-Feb-2026,1,26-Feb to 26-Feb,US
D019,B4,BD,26-Feb-2026,11-Mar-2026,14,26-Feb to 11-Mar,US
D020,S4,LD,08-Mar-2026,08-Mar-2026,1,08-Mar to 08-Mar,US
D021,B6,LD,04-Mar-2026,04-Mar-2026,1,04-Mar to 04-Mar,US
D022,B6,LD,09-Mar-2026,09-Mar-2026,1,09-Mar to 09-Mar,US
D023,S4,LD,13-Mar-2026,13-Mar-2026,1,13-Mar to 13-Mar,US
D024,B6,Lightning Deal,18-Mar-2026,18-Mar-2026,1,18-Mar to 18-Mar,US
D025,B4,Lightning Deal,18-Mar-2026,18-Mar-2026,1,18-Mar to 18-Mar,US
D026,S4,Lightning Deal,20-Mar-2026,20-Mar-2026,1,20-Mar to 20-Mar,US
D027,S4,Lightning Deal,25-Mar-2026,25-Mar-2026,1,25-Mar to 25-Mar,US
D028,B6,Lightning Deal,27-Mar-2026,27-Mar-2026,1,27-Mar to 27-Mar,US
D029,B4,Lightning Deal,30-Mar-2026,30-Mar-2026,1,30-Mar to 30-Mar,US
D030,S4,Best Deal,01-Apr-2026,14-Apr-2026,14,01-Apr to 14-Apr,US
D031,S6,Best Deal,01-Apr-2026,14-Apr-2026,14,01-Apr to 14-Apr,US
D032,SS4,Best Deal,01-Apr-2026,14-Apr-2026,14,01-Apr to 14-Apr,US
D033,B6,Best Deal,02-Apr-2026,15-Apr-2026,14,02-Apr to 15-Apr,US
D034,B4,Lightning Deal,11-Apr-2026,11-Apr-2026,1,11-Apr to 11-Apr,US
D035,B4,Lightning Deal,16-Apr-2026,16-Apr-2026,1,16-Apr to 16-Apr,US
D036,S4,Lightning Deal,20-Apr-2026,26-Apr-2026,7,20-Apr to 26-Apr,US
D037,B4,Best Deal,20-Apr-2026,03-May-2026,14,20-Apr to 03-May,US
D038,B6,Lightning Deal,20-Apr-2026,26-Apr-2026,7,20-Apr to 26-Apr,US
D039,S4,Lightning Deal,27-Apr-2026,03-May-2026,7,27-Apr to 03-May,US
D040,B6,Best Deal,27-Apr-2026,03-May-2026,7,27-Apr to 03-May,US
D041,B4,Lightning Deal,04-May-2026,10-May-2026,7,04-May to 10-May,US
D042,S4,Best Deal,06-May-2026,19-May-2026,7,06-May to 19-May,US
D043,B6,Best Deal,07-May-2026,20-May-2026,7,07-May to 20-May,US
D044,B4,Lightning Deal,11-May-2026,17-May-2026,7,11-May to 17-May,US
D045,B4,Lightning Deal,18-May-2026,24-May-2026,7,18-May to 24-May,US`;

export const deals = csvData.split('\n').map(line => {
  const parts = line.split(',');
  const [id, parent, type, startStr, endStr, duration, weekLabel] = parts;
  const marketplace = (parts[7] || 'US').trim();
  const normalizedType = normalizeDealType(type);
  return {
    id: id.trim(),
    parent: parent.trim(),
    type: normalizedType,
    typeName: DEAL_TYPES[normalizedType]?.name || type.trim(),
    startDate: parseDate(startStr.trim()),
    endDate: parseDate(endStr.trim()),
    duration: parseInt(duration),
    weekLabel: weekLabel.trim(),
    marketplace,
    product: PRODUCTS[parent.trim()],
    skus: (PRODUCT_SKUS[parent.trim()] || []).map(s => ({
      ...s,
      participating: true,
      strReflecting: true,
      excludeReason: '',
    })),
    comments: [],
  };
});

export function getDealStats(dealList) {
  const ld = dealList.filter(d => d.type === 'LD').length;
  const bd = dealList.filter(d => d.type === 'BD').length;
  const products = new Set(dealList.map(d => d.parent));
  const totalSkus = dealList.reduce((sum, d) => sum + d.skus.length, 0);
  const excludedSkus = dealList.reduce((sum, d) => sum + d.skus.filter(s => !s.participating).length, 0);
  return { total: dealList.length, ld, bd, products: products.size, totalSkus, excludedSkus };
}
