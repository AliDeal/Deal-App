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
  Layers, Grid3x3, Eye, Upload, Download, CheckCircle2, AlertCircle,
} from 'lucide-react';

const LOOKBACK_OPTIONS = [
  { value: 30, label: 'L30' },
  { value: 60, label: 'L60' },
  { value: 90, label: 'L90' },
];

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
  const [startDate, setStartDate] = useState('2026-04-08');

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

  // Calculate baseline avg from lookback (non-deal days only)
  const baselineData = lookbackData.filter(d => !d.hasDeal);
  const baselineAvg = baselineData.length > 0
    ? baselineData.reduce((s, d) => s + d.units, 0) / baselineData.length
    : 0;

  // SKU-level baseline averages
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

  // Build chart data: combine lookback + deal period with projected line
  const chartData = useMemo(() => {
    if (!currentDeal) return [];

    // Show from lookback start through deal end (or current date)
    const chartEnd = currentDeal.endDate < refDate ? currentDeal.endDate : refDate;
    const allDays = rawDaily.filter(d => d.date >= lookbackStart && d.date <= chartEnd);

    if (viewLevel === 'sku' && selectedSku) {
      const skuBase = skuBaselines[selectedSku]?.avg || 0;
      const mult = getMultiplier(selectedSku, product, currentDeal?.type);

      return allDays.map(d => {
        const skuData = d.skuBreakdown.find(sk => sk.sku === selectedSku);
        const actual = skuData?.units || 0;
        const isDealDay = d.hasDeal && d.dealId === currentDeal?.id;
        const projected = isDealDay ? Math.round(skuBase * mult) : null;
        return {
          dateLabel: d.dateLabel,
          date: d.date,
          actual,
          projected,
          baseline: Math.round(skuBase),
          isDealDay,
        };
      });
    }

    // Parent level — use average of SKU multipliers
    const parentMult = getMultiplier('', product, currentDeal?.type);
    return allDays.map(d => {
      const isDealDay = d.hasDeal && d.dealId === currentDeal?.id;
      const projected = isDealDay ? Math.round(baselineAvg * parentMult) : null;
      return {
        dateLabel: d.dateLabel,
        date: d.date,
        actual: d.units,
        projected,
        baseline: Math.round(baselineAvg),
        isDealDay,
      };
    });
  }, [rawDaily, lookbackStart, refDate, currentDeal, viewLevel, selectedSku, baselineAvg, skuBaselines, product]);

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
        <p className="text-gray-500 text-xs">Baseline avg: {data.baseline}</p>
        {data.isDealDay && (
          <p className="text-xs font-semibold text-brand-orange mt-1">Deal Active</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: prod.color }} />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-purple-500" />
                Projected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-gray-300 border-dashed" />
                L{lookback} Baseline
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

              {/* Baseline reference line */}
              <ReferenceLine
                y={chartData[0]?.baseline || 0}
                stroke="#d1d5db"
                strokeDasharray="6 4"
                label={{ value: `L${lookback} avg: ${chartData[0]?.baseline}`, position: 'right', fontSize: 10, fill: '#9ca3af' }}
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
            <div className="flex items-center gap-2">
              <Grid3x3 size={18} className="text-blue-500" />
              <h2 className="text-lg font-bold text-gray-800">SKU-Level Performance</h2>
            </div>
            <span className="text-xs text-gray-400">
              Baseline: L{lookback} days before deal start &middot; {parentSummary?.dealDays} deal days elapsed
            </span>
          </div>

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

          {/* Parent totals row */}
          {parentSummary && (
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
              <strong>L{lookback} Avg</strong> = Avg daily units for {lookback} non-deal days before deal start &nbsp;|&nbsp;
              <strong>Expected</strong> = L{lookback} Avg &times; Multiplier &nbsp;|&nbsp;
              <strong>vs Projected</strong> = (Actual - Projected) / Projected &nbsp;|&nbsp;
              <strong>vs Baseline</strong> = (Actual Avg - L{lookback} Avg) / L{lookback} Avg
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
