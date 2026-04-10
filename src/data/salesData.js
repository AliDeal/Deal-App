import { deals, PRODUCTS, PRODUCT_SKUS } from './deals';
import { eachDayOfInterval, format, subDays, isWithinInterval } from 'date-fns';

// Seed-based pseudo-random for consistent data across renders
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Base daily units per product (non-deal baseline)
const BASE_DAILY_UNITS = {
  B4: { min: 18, max: 35 },
  B6: { min: 12, max: 25 },
  S4: { min: 14, max: 28 },
  S6: { min: 6, max: 14 },
  SS4: { min: 5, max: 12 },
};

// Sample average prices used ONLY for synthetic revenue numbers in this
// generator. Real prices live in FinancialsContext / Deal Financials uploads.
// This map exists because PRODUCT_SKUS no longer carries dealPrice fields.
const SAMPLE_AVG_PRICE = {
  B4: 35, B6: 47, S4: 32, S6: 42, SS4: 35,
};

// Deal uplift multipliers (used for generating sample data)
const DEAL_UPLIFT = {
  LD: { min: 2.0, max: 3.5 },   // Lightning deals: 2-3.5x spike
  BD: { min: 1.6, max: 2.8 },   // Best deals: 1.6-2.8x sustained
};

// Expected deal multipliers set by the business for projections
// These are the multipliers we expect deals to achieve vs baseline
export const DEAL_MULTIPLIERS = {
  B4: { LD: 2.5, BD: 2.0 },
  B6: { LD: 2.8, BD: 2.2 },
  S4: { LD: 2.3, BD: 1.9 },
  S6: { LD: 2.4, BD: 2.0 },
  SS4: { LD: 2.2, BD: 1.8 },
};

// Per-SKU deal multipliers (can override product-level)
export const SKU_DEAL_MULTIPLIERS = {
  'B4-WHT-Q': { LD: 2.8, BD: 2.2 },
  'B4-WHT-K': { LD: 2.6, BD: 2.1 },
  'B4-GRY-Q': { LD: 2.4, BD: 1.9 },
  'B4-GRY-K': { LD: 2.3, BD: 1.8 },
  'B4-NVY-Q': { LD: 2.5, BD: 2.0 },
  'B4-NVY-K': { LD: 2.4, BD: 1.9 },
  'B4-BEG-Q': { LD: 2.6, BD: 2.1 },
  'B4-BEG-K': { LD: 2.5, BD: 2.0 },
  'B6-WHT-Q': { LD: 3.0, BD: 2.4 },
  'B6-WHT-K': { LD: 2.8, BD: 2.3 },
  'B6-GRY-Q': { LD: 2.7, BD: 2.1 },
  'B6-GRY-K': { LD: 2.6, BD: 2.0 },
  'B6-NVY-Q': { LD: 2.9, BD: 2.3 },
  'B6-NVY-K': { LD: 2.7, BD: 2.2 },
  'S4-WHT-Q': { LD: 2.5, BD: 2.0 },
  'S4-WHT-K': { LD: 2.3, BD: 1.9 },
  'S4-BLK-Q': { LD: 2.4, BD: 1.8 },
  'S4-BLK-K': { LD: 2.2, BD: 1.7 },
  'S4-PNK-Q': { LD: 2.3, BD: 1.9 },
  'S4-PNK-K': { LD: 2.1, BD: 1.8 },
  'S6-WHT-Q': { LD: 2.5, BD: 2.1 },
  'S6-WHT-K': { LD: 2.4, BD: 2.0 },
  'S6-BLK-Q': { LD: 2.3, BD: 1.9 },
  'S6-BLK-K': { LD: 2.2, BD: 1.8 },
  'SS4-WHT-Q': { LD: 2.3, BD: 1.9 },
  'SS4-WHT-K': { LD: 2.2, BD: 1.8 },
  'SS4-GRY-Q': { LD: 2.1, BD: 1.7 },
  'SS4-GRY-K': { LD: 2.0, BD: 1.6 },
};

// Generate daily sales data for all products from Jan 1, 2026 to May 31, 2026
export function generateSalesData() {
  const startDate = new Date(2026, 0, 1);
  const endDate = new Date(2026, 4, 31);
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const rand = seededRandom(42);

  const salesByProduct = {};

  Object.keys(PRODUCTS).forEach(productKey => {
    const base = BASE_DAILY_UNITS[productKey];
    const skus = PRODUCT_SKUS[productKey] || [];
    const productDeals = deals.filter(d => d.parent === productKey);

    const dailyData = allDays.map(day => {
      // Check if this day falls within any deal for this product
      const activeDeals = productDeals.filter(d =>
        isWithinInterval(day, { start: d.startDate, end: d.endDate })
      );
      const hasDeal = activeDeals.length > 0;
      const dealType = hasDeal ? activeDeals[0].type : null;
      const dealId = hasDeal ? activeDeals[0].id : null;

      // Base units with daily variance
      const dayOfWeek = day.getDay();
      const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.85 : 1.0;
      let baseUnits = Math.round(
        (base.min + rand() * (base.max - base.min)) * weekendMultiplier
      );

      // Apply deal uplift
      let totalUnits = baseUnits;
      if (hasDeal) {
        const uplift = DEAL_UPLIFT[dealType] || DEAL_UPLIFT.LD;
        const multiplier = uplift.min + rand() * (uplift.max - uplift.min);
        totalUnits = Math.round(baseUnits * multiplier);
      }

      // Distribute units across SKUs proportionally with variance
      const samplePrice = SAMPLE_AVG_PRICE[productKey] || 30;
      const skuBreakdown = skus.map((sku, idx) => {
        const skuShare = (1 / skus.length) + (rand() - 0.5) * 0.15;
        const skuUnits = Math.max(1, Math.round(totalUnits * skuShare));
        const skuRevenue = skuUnits * samplePrice;
        return {
          sku: sku.sku,
          variant: sku.variant,
          asin: sku.asin,
          units: skuUnits,
          revenue: skuRevenue,
        };
      });

      const actualTotalUnits = skuBreakdown.reduce((s, sk) => s + sk.units, 0);
      const totalRevenue = skuBreakdown.reduce((s, sk) => s + sk.revenue, 0);

      return {
        date: day,
        dateStr: format(day, 'yyyy-MM-dd'),
        dateLabel: format(day, 'MMM d'),
        units: actualTotalUnits,
        revenue: totalRevenue,
        hasDeal,
        dealType,
        dealId,
        skuBreakdown,
      };
    });

    salesByProduct[productKey] = dailyData;
  });

  return salesByProduct;
}

// Aggregate daily data into weekly buckets
export function aggregateWeekly(dailyData) {
  const weeks = {};
  dailyData.forEach(day => {
    const weekStart = subDays(day.date, day.date.getDay());
    const key = format(weekStart, 'yyyy-MM-dd');
    if (!weeks[key]) {
      weeks[key] = {
        date: weekStart,
        dateStr: key,
        dateLabel: format(weekStart, 'MMM d'),
        units: 0,
        revenue: 0,
        hasDeal: false,
        dealDays: 0,
        totalDays: 0,
      };
    }
    weeks[key].units += day.units;
    weeks[key].revenue += day.revenue;
    weeks[key].totalDays += 1;
    if (day.hasDeal) {
      weeks[key].hasDeal = true;
      weeks[key].dealDays += 1;
    }
  });
  return Object.values(weeks).sort((a, b) => a.date - b.date);
}

// Aggregate daily data into monthly buckets
export function aggregateMonthly(dailyData) {
  const months = {};
  dailyData.forEach(day => {
    const key = format(day.date, 'yyyy-MM');
    if (!months[key]) {
      months[key] = {
        date: new Date(day.date.getFullYear(), day.date.getMonth(), 1),
        dateStr: key,
        dateLabel: format(day.date, 'MMM yyyy'),
        units: 0,
        revenue: 0,
        hasDeal: false,
        dealDays: 0,
        totalDays: 0,
      };
    }
    months[key].units += day.units;
    months[key].revenue += day.revenue;
    months[key].totalDays += 1;
    if (day.hasDeal) {
      months[key].hasDeal = true;
      months[key].dealDays += 1;
    }
  });
  return Object.values(months).sort((a, b) => a.date - b.date);
}

// Calculate performance benchmarks for a product's deal periods
export function calcDealBenchmarks(dailyData, benchmarkDays = 30) {
  const dealPeriods = [];
  let currentDeal = null;

  dailyData.forEach((day, idx) => {
    if (day.hasDeal && (!currentDeal || currentDeal.dealId !== day.dealId)) {
      if (currentDeal) dealPeriods.push(currentDeal);
      currentDeal = {
        dealId: day.dealId,
        dealType: day.dealType,
        startIdx: idx,
        endIdx: idx,
        startDate: day.date,
        endDate: day.date,
        dealDays: [],
      };
    }
    if (day.hasDeal && currentDeal) {
      currentDeal.endIdx = idx;
      currentDeal.endDate = day.date;
      currentDeal.dealDays.push(day);
    }
    if (!day.hasDeal && currentDeal) {
      dealPeriods.push(currentDeal);
      currentDeal = null;
    }
  });
  if (currentDeal) dealPeriods.push(currentDeal);

  return dealPeriods.map(period => {
    // Average daily units during deal
    const dealAvgUnits = period.dealDays.reduce((s, d) => s + d.units, 0) / period.dealDays.length;
    const dealTotalUnits = period.dealDays.reduce((s, d) => s + d.units, 0);
    const dealTotalRevenue = period.dealDays.reduce((s, d) => s + d.revenue, 0);

    // Benchmark: average daily units for N days before the deal
    const benchmarkStart = Math.max(0, period.startIdx - benchmarkDays);
    const benchmarkSlice = dailyData.slice(benchmarkStart, period.startIdx).filter(d => !d.hasDeal);
    const benchmarkAvgUnits = benchmarkSlice.length > 0
      ? benchmarkSlice.reduce((s, d) => s + d.units, 0) / benchmarkSlice.length
      : dealAvgUnits;

    const pctChange = benchmarkAvgUnits > 0
      ? ((dealAvgUnits - benchmarkAvgUnits) / benchmarkAvgUnits) * 100
      : 0;

    return {
      dealId: period.dealId,
      dealType: period.dealType,
      startDate: period.startDate,
      endDate: period.endDate,
      days: period.dealDays.length,
      totalUnits: dealTotalUnits,
      totalRevenue: dealTotalRevenue,
      avgDailyUnits: Math.round(dealAvgUnits),
      benchmarkAvgUnits: Math.round(benchmarkAvgUnits),
      pctChange: pctChange,
      benchmarkPeriod: benchmarkSlice.length,
    };
  });
}
