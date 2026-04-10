import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import { PRODUCTS, DEAL_TYPES, PRODUCT_SKUS } from '../data/deals';
import {
  generateSalesData, DEAL_MULTIPLIERS, SKU_DEAL_MULTIPLIERS,
} from '../data/salesData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, BarChart, Bar, ReferenceArea, ComposedChart, Area,
} from 'recharts';
import { format, subDays, isWithinInterval, eachDayOfInterval } from 'date-fns';
import {
  Package, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Layers, Grid3x3, Eye, Upload, Download, CheckCircle2, AlertCircle, Search,
} from 'lucide-react';

const LOOKBACK_OPTIONS = [
  { value: 30, label: 'L30' },
  { value: 60, label: 'L60' },
  { value: 90, label: 'L90' },
];

// Returns true if `date` falls within ANY deal in `deals` for parent product `productKey`.
// Drives the "exclude deal days" baseline mode from the real deal calendar
// (DealContext) instead of relying on a synthetic hasDeal flag.
function isDealDayInCalendar(date, productKey, deals) {
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  for (const d of deals) {
    if (d.parent !== productKey) continue;
    if (t >= d.startDate.getTime() && t <= d.endDate.getTime()) return true;
  }
  return false;
}

// Linear regression over (x=index, y=value) → returns slope + intercept.
// Used to draw a trend line over the baseline series.
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// Load custom multipliers from localStorage, falling back to defaults
function loadMultipliers() {
  try {
    const stored = localStorage.getItem('dealapp-multipliers');
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

export default function CurrentDealPerformance() {
  const navigate = useNavigate();
  const { deals } = useDeals();
  const salesData = useMemo(() => generateSalesData(), []);
  const fileRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Custom multipliers (uploaded via CSV), keyed by SKU
  const [customMultipliers, setCustomMultipliers] = useState(loadMultipliers);

  const saveMultipliers = (data) => {
    setCustomMultipliers(data);
    localStorage.setItem('dealapp-multipliers', JSON.stringify(data));
  };

  // Get effective multiplier for a SKU
  const getMultiplier = (sku, productKey, dealType) => {
    // Custom uploaded multiplier takes priority
    if (customMultipliers[sku]) return customMultipliers[sku];
    // Then per-SKU defaults
    const skuMult = SKU_DEAL_MULTIPLIERS[sku];
    if (skuMult && skuMult[dealType]) return skuMult[dealType];
    // Then product-level defaults
    const prodMult = DEAL_MULTIPLIERS[productKey];
    if (prodMult && prodMult[dealType]) return prodMult[dealType];
    return 2.0;
  };

  // Upload multiplier CSV
  const handleMultiplierUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const lines = evt.target.result.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          setUploadStatus({ type: 'error', message: 'CSV is empty.' });
          return;
        }
        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
        const skuIdx = header.findIndex(h => h === 'sku');
        const multIdx = header.findIndex(h => ['multiplier', 'mult', 'dealmultiplier'].includes(h));
        if (skuIdx === -1 || multIdx === -1) {
          setUploadStatus({ type: 'error', message: 'CSV must have SKU and Multiplier columns.' });
          return;
        }
        const data = { ...customMultipliers };
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          const sku = cols[skuIdx];
          const mult = parseFloat(cols[multIdx]);
          if (sku && !isNaN(mult) && mult > 0) {
            data[sku] = mult;
            count++;
          }
        }
        saveMultipliers(data);
        setUploadStatus({ type: 'success', message: `Imported multipliers for ${count} SKUs.` });
      } catch {
        setUploadStatus({ type: 'error', message: 'Failed to parse CSV.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Download multiplier template pre-filled with all SKUs
  const handleDownloadTemplate = () => {
    const header = 'Tag,ASIN,SKU,Multiplier';
    const rows = Object.entries(PRODUCT_SKUS).flatMap(([tag, skus]) =>
      skus.map(s => {
        const existing = customMultipliers[s.sku] || SKU_DEAL_MULTIPLIERS[s.sku]?.LD || DEAL_MULTIPLIERS[tag]?.LD || 2.0;
        return `${tag},${s.asin},${s.sku},${existing}`;
      })
    );
    const blob = new Blob([header + '\n' + rows.join('\n') + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deal_multipliers_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filters
  const [product, setProduct] = useState('B4');
  const [viewLevel, setViewLevel] = useState('parent'); // 'parent' | 'sku'
  const [selectedSku, setSelectedSku] = useState('');
  const [lookback, setLookback] = useState(30);
  // 'all' = average across every day in the lookback window
  // 'exclude-deals' = exclude any day that falls inside a historical deal (per the deal calendar)
  // 'exclude-deals' is the default because it gives a cleaner "pure baseline velocity"
  const [baselineMode, setBaselineMode] = useState('exclude-deals');
  const [startDate, setStartDate] = useState('2026-04-08');
  const [tableView, setTableView] = useState('sku'); // 'parent' | 'sku'
  const [keywordSearch, setKeywordSearch] = useState('');

  const prod = PRODUCTS[product];

  // Find active/current deals for this product based on startDate
  const refDate = new Date(startDate);
  const productDeals = deals.filter(d => d.parent === product);
  const activeDeals = productDeals.filter(d =>
    isWithinInterval(refDate, { start: d.startDate, end: d.endDate })
  );
  // Also get the most recent deal if none active
  const recentDeals = activeDeals.length > 0
    ? activeDeals
    : productDeals.filter(d => d.startDate <= refDate).sort((a, b) => b.startDate - a.startDate).slice(0, 1);

  const currentDeal = recentDeals[0];

  // Get daily sales data for the product
  const rawDaily = salesData[product] || [];

  // Lookback period: go back N days from startDate
  const lookbackStart = subDays(refDate, lookback);
  const lookbackData = rawDaily.filter(d => d.date >= lookbackStart && d.date < (currentDeal?.startDate || refDate));

  // Deal period data
  const dealData = currentDeal
    ? rawDaily.filter(d =>
        isWithinInterval(d.date, { start: currentDeal.startDate, end: currentDeal.endDate }) &&
        d.date <= refDate
      )
    : [];

  // Calculate baseline avg from lookback.
  // baselineMode === 'exclude-deals' → drop any day that lands inside a historical
  // deal for this product (per the real deal calendar from DealContext).
  // baselineMode === 'all' → use every day in the lookback window as-is.
  const baselineData = baselineMode === 'exclude-deals'
    ? lookbackData.filter(d => !isDealDayInCalendar(d.date, product, deals))
    : lookbackData;
  const baselineAvg = baselineData.length > 0
    ? baselineData.reduce((s, d) => s + d.units, 0) / baselineData.length
    : 0;
  // Number of deal days that were excluded — surfaced in the UI so the user
  // can see how the exclusion changed the sample size.
  const excludedDealDays = lookbackData.length - baselineData.length;

  // SKU-level baseline averages — same exclusion logic as the parent baseline
  const skuBaselines = useMemo(() => {
    const result = {};
    if (baselineData.length === 0) return result;
    baselineData.forEach(d => {
      d.skuBreakdown.forEach(sk => {
        if (!result[sk.sku]) result[sk.sku] = { total: 0, count: 0 };
        result[sk.sku].total += sk.units;
        result[sk.sku].count += 1;
      });
    });
    Object.keys(result).forEach(k => {
      result[k].avg = result[k].total / result[k].count;
    });
    return result;
  }, [baselineData]);

  // Build chart data: combine lookback + deal period with projected line.
  //
  // The "baseline" per-day value is now DYNAMIC, not a flat average:
  //   - On non-deal days (per the deal calendar): baseline = actual sales for that day
  //     (because that day IS the natural baseline — the line traces real history)
  //   - On deal days (any historical deal in lookback OR the current deal):
  //     baseline = the running baselineAvg (or skuBase) so the line shows what
  //     we WOULD have done absent the deal. The actual line continues to show
  //     the deal-day spike, so the gap visually represents the uplift.
  //
  // A second "baselineTrend" series is a linear regression over the baseline
  // values, drawn as a smooth straight line over the period.
  const chartData = useMemo(() => {
    if (!currentDeal) return [];

    // Show from lookback start through deal end (or current date)
    const chartEnd = currentDeal.endDate < refDate ? currentDeal.endDate : refDate;
    const allDays = rawDaily.filter(d => d.date >= lookbackStart && d.date <= chartEnd);

    const isSkuView = viewLevel === 'sku' && selectedSku;
    const skuBase = isSkuView ? (skuBaselines[selectedSku]?.avg || 0) : 0;
    const parentMult = getMultiplier(isSkuView ? selectedSku : '', product, currentDeal?.type);
    const baseValue = isSkuView ? skuBase : baselineAvg;

    // First pass: build rows with the dynamic baseline value per day
    const rows = allDays.map(d => {
      const isHistoricalDealDay = isDealDayInCalendar(d.date, product, deals);
      const isCurrentDealDay = d.date >= currentDeal.startDate && d.date <= currentDeal.endDate;
      const actual = isSkuView
        ? (d.skuBreakdown.find(sk => sk.sku === selectedSku)?.units || 0)
        : d.units;

      // Per-day baseline:
      //   non-deal day → trace the actual historical sales (the line wiggles like the actual line)
      //   deal day → fall back to the lookback average (the line stays flat at "what we would have done")
      const baseline = (isHistoricalDealDay || isCurrentDealDay)
        ? Math.round(baseValue)
        : actual;

      // Projection: only drawn during the CURRENT deal period
      const projected = isCurrentDealDay ? Math.round(baseValue * parentMult) : null;

      return {
        dateLabel: d.dateLabel,
        date: d.date,
        actual,
        projected,
        baseline,
        isDealDay: isCurrentDealDay,
        isHistoricalDealDay,
      };
    });

    // Second pass: linear-regression trend line over the baseline values
    if (rows.length > 1) {
      const baselineValues = rows.map(r => r.baseline);
      const { slope, intercept } = linearRegression(baselineValues);
      rows.forEach((r, i) => {
        r.baselineTrend = Math.round(intercept + slope * i);
      });
    }

    return rows;
  }, [rawDaily, lookbackStart, refDate, currentDeal, viewLevel, selectedSku, baselineAvg, skuBaselines, product, deals]);

  // Deal region for chart highlight
  const dealChartRegion = currentDeal ? {
    start: format(currentDeal.startDate, 'MMM d'),
    end: format(currentDeal.endDate <= refDate ? currentDeal.endDate : refDate, 'MMM d'),
  } : null;

  // SKU-level table data
  const skuTableData = useMemo(() => {
    if (!currentDeal) return [];
    const skus = currentDeal.skus || [];
    return skus.map(sk => {
      const base = skuBaselines[sk.sku] || { avg: 0 };
      const mult = getMultiplier(sk.sku, product, currentDeal.type);
      const expectedDaily = Math.round(base.avg * mult);

      // Actual deal sales for this SKU
      const skuDealDays = dealData.map(d => {
        const skuData = d.skuBreakdown.find(s => s.sku === sk.sku);
        return skuData?.units || 0;
      });
      const actualTotal = skuDealDays.reduce((s, u) => s + u, 0);
      const actualDailyAvg = skuDealDays.length > 0 ? actualTotal / skuDealDays.length : 0;

      const projectedTotal = expectedDaily * (dealData.length || 1);
      const pctVsProjected = projectedTotal > 0
        ? ((actualTotal - projectedTotal) / projectedTotal) * 100
        : 0;
      const pctVsBaseline = base.avg > 0
        ? ((actualDailyAvg - base.avg) / base.avg) * 100
        : 0;

      return {
        sku: sk.sku,
        variant: sk.variant,
        asin: sk.asin,
        baselineAvg: Math.round(base.avg * 10) / 10,
        multiplier: mult,
        expectedDaily,
        projectedTotal,
        actualDailyAvg: Math.round(actualDailyAvg * 10) / 10,
        actualTotal,
        pctVsProjected,
        pctVsBaseline,
        dealDays: dealData.length,
      };
    });
  }, [currentDeal, dealData, skuBaselines, product]);

  // Parent-level summary
  const parentSummary = useMemo(() => {
    if (skuTableData.length === 0) return null;
    const totalProjected = skuTableData.reduce((s, sk) => s + sk.projectedTotal, 0);
    const totalActual = skuTableData.reduce((s, sk) => s + sk.actualTotal, 0);
    const pctVsProjected = totalProjected > 0
      ? ((totalActual - totalProjected) / totalProjected) * 100
      : 0;
    const avgMultiplier = skuTableData.reduce((s, sk) => s + sk.multiplier, 0) / skuTableData.length;
    return { totalProjected, totalActual, pctVsProjected, avgMultiplier, dealDays: skuTableData[0]?.dealDays || 0 };
  }, [skuTableData]);

  // Available SKUs for the selected product
  const availableSkus = useMemo(() => {
    const skus = currentDeal?.skus || [];
    return skus.filter(s => s.participating);
  }, [currentDeal]);

  // Custom tooltip
  const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800">{data.dateLabel}</p>
        <p className="text-gray-600">
          Actual: <span className="font-bold" style={{ color: prod.color }}>{data.actual}</span>
        </p>
        {data.projected !== null && (
          <p className="text-gray-600">
            Projected: <span className="font-bold text-purple-600">{data.projected}</span>
          </p>
        )}
        <p className="text-gray-500 text-xs">
          Baseline: {data.baseline}
          {data.baselineTrend !== undefined && <> · Trend: {data.baselineTrend}</>}
        </p>
        {data.isDealDay && (
          <p className="text-xs font-semibold text-brand-orange mt-1">Current Deal Active</p>
        )}
        {!data.isDealDay && data.isHistoricalDealDay && (
          <p className="text-xs font-semibold text-amber-600 mt-1">Historical Deal Day</p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Current Deal Performance</h1>
        <p className="text-gray-500 mt-1">Actual vs. projected sales for active deals</p>
      </div>

      {/* Multiplier Upload */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={15} className="text-gray-500" />
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Deal Multipliers</span>
            <span className="text-xs text-gray-400">
              ({Object.keys(customMultipliers).length} custom SKUs loaded)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer"
            >
              <Download size={13} /> Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer"
            >
              <Upload size={13} /> Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleMultiplierUpload}
              className="hidden"
            />
          </div>
        </div>
        {uploadStatus && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
            uploadStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {uploadStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {uploadStatus.message}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Product */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Package size={13} /> Product
            </label>
            <div className="relative">
              <select
                value={product}
                onChange={e => { setProduct(e.target.value); setSelectedSku(''); }}
                className="w-full appearance-none px-3 py-2 pr-8 border rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                style={{ borderColor: prod.color, color: prod.color }}
              >
                {Object.entries(PRODUCTS).map(([key, p]) => (
                  <option key={key} value={key}>{p.shortName} - {p.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* View Level */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Layers size={13} /> View
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setViewLevel('parent'); setSelectedSku(''); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5 ${
                  viewLevel === 'parent' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Layers size={13} /> Parent
              </button>
              <button
                onClick={() => setViewLevel('sku')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5 ${
                  viewLevel === 'sku' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Grid3x3 size={13} /> SKU
              </button>
            </div>
          </div>

          {/* SKU selector (when SKU view) */}
          {viewLevel === 'sku' && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <Eye size={13} /> SKU
              </label>
              <div className="relative">
                <select
                  value={selectedSku}
                  onChange={e => setSelectedSku(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                >
                  <option value="">Select SKU...</option>
                  {availableSkus.map(sk => (
                    <option key={sk.sku} value={sk.sku}>{sk.sku} — {sk.variant}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Lookback */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <TrendingUp size={13} /> Baseline
            </label>
            <div className="flex gap-1.5">
              {LOOKBACK_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setLookback(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                    lookback === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Baseline mode: include vs exclude historical deal days */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <TrendingUp size={13} /> Baseline Mode
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => setBaselineMode('all')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                  baselineMode === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Average across every day in the lookback window, including historical deal days"
              >
                All days
              </button>
              <button
                onClick={() => setBaselineMode('exclude-deals')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                  baselineMode === 'exclude-deals' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Exclude any day that falls within a historical deal — gives a pure baseline velocity"
              >
                Excl. deal days
              </button>
            </div>
            {baselineMode === 'exclude-deals' && excludedDealDays > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                {excludedDealDays} of {lookbackData.length} day{lookbackData.length === 1 ? '' : 's'} excluded
              </p>
            )}
          </div>

          {/* Reference Date */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Calendar size={13} /> As of Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Current Deal Info */}
      {currentDeal ? (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => navigate(`/deal/${currentDeal.id}`)}
                    className="text-xl font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {currentDeal.id}
                  </button>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: prod.color }}>
                    {prod.shortName}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: (DEAL_TYPES[currentDeal.type]?.color || '#888') + '20', color: DEAL_TYPES[currentDeal.type]?.color }}>
                    {DEAL_TYPES[currentDeal.type]?.name}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {format(currentDeal.startDate, 'MMM d')} &ndash; {format(currentDeal.endDate, 'MMM d, yyyy')}
                  <span className="ml-2 text-gray-400">({currentDeal.duration} days)</span>
                </p>
              </div>
            </div>
            {parentSummary && (
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Projected</p>
                  <p className="text-xl font-bold text-purple-600">{parentSummary.totalProjected.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Actual</p>
                  <p className="text-xl font-bold" style={{ color: prod.color }}>{parentSummary.totalActual.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold">vs Projected</p>
                  <div className="flex items-center gap-1">
                    {parentSummary.pctVsProjected >= 0
                      ? <ArrowUpRight size={18} className="text-green-600" />
                      : <ArrowDownRight size={18} className="text-red-500" />
                    }
                    <p className={`text-xl font-bold ${parentSummary.pctVsProjected >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {parentSummary.pctVsProjected >= 0 ? '+' : ''}{parentSummary.pctVsProjected.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 text-center">
          <p className="text-yellow-700 font-medium">No active or recent deal found for {prod.name} on {startDate}</p>
          <p className="text-yellow-600 text-sm mt-1">Try adjusting the date or product filter</p>
        </div>
      )}

      {/* Chart: Actual vs Projected */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">
              {viewLevel === 'sku' && selectedSku
                ? `${selectedSku} — Actual vs Projected`
                : `${prod.name} — Actual vs Projected`
              }
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: prod.color }} />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-purple-500" />
                Projected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-gray-400" />
                L{lookback} Baseline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-slate-400 opacity-60" />
                Trend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-orange-100" />
                Deal period
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval={Math.max(0, Math.floor(chartData.length / 14))}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />

              {/* Deal period highlight */}
              {dealChartRegion && (
                <ReferenceArea
                  x1={dealChartRegion.start}
                  x2={dealChartRegion.end}
                  fill="#f97316"
                  fillOpacity={0.06}
                  stroke="#f97316"
                  strokeOpacity={0.2}
                  strokeDasharray="4 4"
                />
              )}

              {/* Baseline line — dynamic, traces actual historical sales on
                  non-deal days and falls back to the average on deal days */}
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#9ca3af"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />

              {/* Baseline trend line — linear regression over the baseline series */}
              <Line
                type="linear"
                dataKey="baselineTrend"
                stroke="#94a3b8"
                strokeWidth={1.25}
                dot={false}
                strokeDasharray="0"
                isAnimationActive={false}
                opacity={0.6}
              />

              {/* Projected line (only during deal) */}
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls={false}
              />

              {/* Actual line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke={prod.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, stroke: prod.color, strokeWidth: 2, fill: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* SKU Performance Table */}
      {currentDeal && skuTableData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Grid3x3 size={18} className="text-blue-500" />
              <h2 className="text-lg font-bold text-gray-800">Performance</h2>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => setTableView('parent')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1 ${
                    tableView === 'parent' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Layers size={11} /> Parent
                </button>
                <button
                  onClick={() => setTableView('sku')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1 ${
                    tableView === 'sku' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Grid3x3 size={11} /> SKU
                </button>
              </div>
            </div>
            <span className="text-xs text-gray-400">
              Baseline: L{lookback} days before deal start &middot; {parentSummary?.dealDays} deal days elapsed
            </span>
          </div>

          {/* Parent-level aggregated view */}
          {tableView === 'parent' && parentSummary && (
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold">L{lookback} Avg/Day</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">{Math.round(baselineAvg)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Avg Multiplier</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">{parentSummary.avgMultiplier.toFixed(1)}x</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Projected Total</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">{parentSummary.totalProjected.toLocaleString()}</p>
                </div>
                <div className="rounded-lg p-4 text-center" style={{ backgroundColor: prod.color + '10' }}>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Actual Total</p>
                  <p className="text-xl font-bold mt-1" style={{ color: prod.color }}>{parentSummary.totalActual.toLocaleString()}</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${parentSummary.pctVsProjected >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 uppercase font-semibold">vs Projected</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {parentSummary.pctVsProjected >= 0 ? <TrendingUp size={16} className="text-green-600" /> : <TrendingDown size={16} className="text-red-500" />}
                    <p className={`text-xl font-bold ${parentSummary.pctVsProjected >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {parentSummary.pctVsProjected >= 0 ? '+' : ''}{parentSummary.pctVsProjected.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-bold text-gray-700 mb-2">{prod.name} ({prod.shortName}) — Deal {currentDeal.id}</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Deal Type:</span>
                    <span className="ml-2 font-semibold">{DEAL_TYPES[currentDeal.type]?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <span className="ml-2 font-semibold">{parentSummary.dealDays} days elapsed</span>
                  </div>
                  <div>
                    <span className="text-gray-500">SKUs:</span>
                    <span className="ml-2 font-semibold">{skuTableData.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tableView === 'sku' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">L{lookback} Avg/Day</th>
                  <th className="px-4 py-3">Multiplier</th>
                  <th className="px-4 py-3">Expected/Day</th>
                  <th className="px-4 py-3">Actual Avg/Day</th>
                  <th className="px-4 py-3">Projected Total</th>
                  <th className="px-4 py-3">Actual Total</th>
                  <th className="px-4 py-3">vs Projected</th>
                  <th className="px-4 py-3">vs Baseline</th>
                  <th className="px-4 py-3">Chart</th>
                </tr>
              </thead>
              <tbody>
                {skuTableData.map((sk, i) => (
                  <tr
                    key={sk.sku}
                    className={`hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">{sk.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sk.baselineAvg}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                        {sk.multiplier}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-purple-600">{sk.expectedDaily}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: prod.color }}>{sk.actualDailyAvg}</td>
                    <td className="px-4 py-3 text-sm text-purple-600">{sk.projectedTotal.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: prod.color }}>{sk.actualTotal.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        sk.pctVsProjected >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {sk.pctVsProjected >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {sk.pctVsProjected >= 0 ? '+' : ''}{sk.pctVsProjected.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        sk.pctVsBaseline >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {sk.pctVsBaseline >= 0 ? '+' : ''}{sk.pctVsBaseline.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setViewLevel('sku'); setSelectedSku(sk.sku); }}
                        className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/* Parent totals row */}
          {parentSummary && tableView === 'sku' && (
            <div className="px-4 py-3 border-t-2 border-gray-200 bg-gray-50 flex items-center gap-4">
              <span className="text-sm font-bold text-gray-700 w-64">TOTAL ({prod.shortName})</span>
              <div className="flex-1 flex items-center gap-8 text-sm">
                <div>
                  <span className="text-gray-500">Projected: </span>
                  <span className="font-bold text-purple-600">{parentSummary.totalProjected.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Actual: </span>
                  <span className="font-bold" style={{ color: prod.color }}>{parentSummary.totalActual.toLocaleString()}</span>
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    parentSummary.pctVsProjected >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {parentSummary.pctVsProjected >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {parentSummary.pctVsProjected >= 0 ? '+' : ''}{parentSummary.pctVsProjected.toFixed(1)}% vs projected
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              <strong>L{lookback} Avg</strong> = Avg daily units for {lookback} days before deal start
              {baselineMode === 'exclude-deals' && <> (<em>excluding historical deal days</em>)</>}
              {baselineMode === 'all' && <> (<em>including historical deal days</em>)</>}
              &nbsp;|&nbsp;
              <strong>Expected</strong> = L{lookback} Avg &times; Multiplier &nbsp;|&nbsp;
              <strong>vs Projected</strong> = (Actual - Projected) / Projected &nbsp;|&nbsp;
              <strong>vs Baseline</strong> = (Actual Avg - L{lookback} Avg) / L{lookback} Avg
            </p>
          </div>
        </div>
      )}

      {/* Keyword Ranking Trend */}
      {currentDeal && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-purple-500" />
              <h2 className="text-lg font-bold text-gray-800">Keyword Ranking Trend</h2>
            </div>
            <div className="relative w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search keywords..."
                value={keywordSearch}
                onChange={e => setKeywordSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>

          <div className="p-6">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
              <Search size={32} className="mx-auto text-purple-300 mb-3" />
              <h3 className="text-lg font-semibold text-purple-700 mb-2">Keyword Tracking Coming Soon</h3>
              <p className="text-sm text-purple-600 max-w-lg mx-auto mb-4">
                This section will show how keyword rankings trend as deals progress for {prod.name}.
                Connect your Datarova API key to enable real-time keyword rank tracking.
              </p>
              <div className="bg-white rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-xs font-semibold text-gray-700 mb-2">Planned Features:</p>
                <ul className="text-xs text-gray-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Keyword rank trend chart (daily rank during deal period)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Pre-deal vs during-deal rank comparison
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Top keywords by rank improvement
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Organic vs Sponsored rank split
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Search volume context per keyword
                  </li>
                </ul>
              </div>
              <p className="text-xs text-purple-500 mt-4">
                To enable, add your Datarova API key in Settings
              </p>
            </div>

            {/* Sample keyword table structure (placeholder data) */}
            <div className="mt-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-3">Keyword</th>
                    <th className="px-4 py-3">Search Volume</th>
                    <th className="px-4 py-3">Pre-Deal Rank</th>
                    <th className="px-4 py-3">Current Rank</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { kw: 'bamboo sheets king', vol: '22,400', pre: 15, cur: 8, trend: 'up' },
                    { kw: 'bamboo bed sheets', vol: '18,100', pre: 22, cur: 14, trend: 'up' },
                    { kw: 'cooling sheets', vol: '14,800', pre: 45, cur: 38, trend: 'up' },
                    { kw: 'bamboo sheets queen', vol: '12,500', pre: 12, cur: 6, trend: 'up' },
                    { kw: 'organic bamboo sheets', vol: '8,200', pre: 18, cur: 21, trend: 'down' },
                  ].filter(k => !keywordSearch || k.kw.includes(keywordSearch.toLowerCase()))
                  .map((k, i) => (
                    <tr key={i} className={`text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} opacity-40`}>
                      <td className="px-4 py-3 font-medium text-gray-700">{k.kw}</td>
                      <td className="px-4 py-3 text-gray-500">{k.vol}</td>
                      <td className="px-4 py-3 text-gray-600">#{k.pre}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">#{k.cur}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          k.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {k.trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {Math.abs(k.pre - k.cur)} positions
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">Sample data</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                Sample data shown above. Connect Datarova API for live keyword ranking data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
