import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRODUCTS, DEAL_TYPES } from '../data/deals';
import {
  generateSalesData, aggregateWeekly, aggregateMonthly, calcDealBenchmarks,
} from '../data/salesData';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, ReferenceArea, Legend, Cell,
} from 'recharts';
import { format } from 'date-fns';
import {
  Globe, Package, Calendar, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownRight, BarChart3, Minus, ChevronDown, ChevronRight,
} from 'lucide-react';

const VIEW_MODES = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const BENCHMARK_OPTIONS = [
  { value: 30, label: 'vs. 30-day avg' },
  { value: 60, label: 'vs. 60-day avg' },
  { value: 90, label: 'vs. 90-day avg' },
];

export default function HistoricalPerformance() {
  const navigate = useNavigate();
  const salesData = useMemo(() => generateSalesData(), []);

  // Filters
  const [product, setProduct] = useState('B4');
  const [marketplace, setMarketplace] = useState('ALL');
  const [viewMode, setViewMode] = useState('daily');
  const [metric, setMetric] = useState('units');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-05-31');
  const [benchmarkDays, setBenchmarkDays] = useState(30);
  const [expandedDeal, setExpandedDeal] = useState(null);

  // Get data for selected product
  const rawDaily = salesData[product] || [];
  const filteredDaily = rawDaily.filter(d => {
    if (startDate && d.dateStr < startDate) return false;
    if (endDate && d.dateStr > endDate) return false;
    return true;
  });

  // Aggregated views
  const chartData = useMemo(() => {
    if (viewMode === 'weekly') return aggregateWeekly(filteredDaily);
    if (viewMode === 'monthly') return aggregateMonthly(filteredDaily);
    return filteredDaily;
  }, [filteredDaily, viewMode]);

  // Benchmarks
  const benchmarks = useMemo(() => {
    return calcDealBenchmarks(rawDaily, benchmarkDays);
  }, [rawDaily, benchmarkDays]);

  // Filter benchmarks to date range
  const filteredBenchmarks = benchmarks.filter(b => {
    const bStart = format(b.startDate, 'yyyy-MM-dd');
    const bEnd = format(b.endDate, 'yyyy-MM-dd');
    if (startDate && bEnd < startDate) return false;
    if (endDate && bStart > endDate) return false;
    return true;
  });

  // Summary stats
  const totalUnits = filteredDaily.reduce((s, d) => s + d.units, 0);
  const totalRevenue = filteredDaily.reduce((s, d) => s + d.revenue, 0);
  const dealDays = filteredDaily.filter(d => d.hasDeal);
  const nonDealDays = filteredDaily.filter(d => !d.hasDeal);
  const avgDealUnits = dealDays.length > 0
    ? Math.round(dealDays.reduce((s, d) => s + d.units, 0) / dealDays.length)
    : 0;
  const avgNonDealUnits = nonDealDays.length > 0
    ? Math.round(nonDealDays.reduce((s, d) => s + d.units, 0) / nonDealDays.length)
    : 0;
  const overallUplift = avgNonDealUnits > 0
    ? (((avgDealUnits - avgNonDealUnits) / avgNonDealUnits) * 100).toFixed(1)
    : 0;

  const prod = PRODUCTS[product];

  // Custom tooltip
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800">{data.dateLabel}</p>
        <p className="text-gray-600">Units: <span className="font-bold">{data.units.toLocaleString()}</span></p>
        <p className="text-gray-600">Revenue: <span className="font-bold">${data.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
        {data.hasDeal && (
          <p className="mt-1 text-xs font-semibold text-brand-orange">
            {data.dealId ? `Deal: ${data.dealId}` : 'Deal Active'}
            {data.dealType && ` (${DEAL_TYPES[data.dealType]?.name})`}
          </p>
        )}
      </div>
    );
  };

  // Find deal regions for reference areas on chart
  const dealRegions = useMemo(() => {
    const regions = [];
    let current = null;
    filteredDaily.forEach(d => {
      if (d.hasDeal) {
        if (!current) current = { start: d.dateLabel, dealId: d.dealId, type: d.dealType };
        current.end = d.dateLabel;
      } else if (current) {
        regions.push(current);
        current = null;
      }
    });
    if (current) regions.push(current);
    return regions;
  }, [filteredDaily]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Historical Deal Performance</h1>
        <p className="text-gray-500 mt-1">Sales trends, deal impact analysis, and benchmarks</p>
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
                onChange={e => setProduct(e.target.value)}
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

          {/* Marketplace */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Globe size={13} /> Marketplace
            </label>
            <div className="flex gap-1.5">
              {['ALL', 'US', 'CA'].map(m => (
                <button
                  key={m}
                  onClick={() => setMarketplace(m)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    marketplace === m
                      ? (m === 'CA' ? 'bg-red-600 text-white' : m === 'US' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white')
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m === 'ALL' ? 'All' : m}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <BarChart3 size={13} /> View
            </label>
            <div className="flex gap-1.5">
              {Object.entries(VIEW_MODES).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    viewMode === key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="lg:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Calendar size={13} /> Date Range
            </label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Units</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Avg Deal Day</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{avgDealUnits} units</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Avg Non-Deal Day</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{avgNonDealUnits} units</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Deal Uplift</p>
          <div className="flex items-center gap-1 mt-1">
            {overallUplift > 0 ? <ArrowUpRight size={20} className="text-green-600" /> : <ArrowDownRight size={20} className="text-red-500" />}
            <p className={`text-2xl font-bold ${overallUplift > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {overallUplift > 0 ? '+' : ''}{overallUplift}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            Sales Trend &mdash; {PRODUCTS[product].name}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMetric('units')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
                metric === 'units' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Units
            </button>
            <button
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
                metric === 'revenue' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Revenue
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: prod.color + '40' }} />
            Non-deal period
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-orange-200" />
            Deal active
          </span>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              interval={viewMode === 'daily' ? Math.floor(chartData.length / 12) : 0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={v => metric === 'revenue' ? `$${(v/1000).toFixed(0)}k` : v}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Highlight deal periods */}
            {viewMode === 'daily' && dealRegions.map((region, i) => (
              <ReferenceArea
                key={i}
                x1={region.start}
                x2={region.end}
                fill="#f97316"
                fillOpacity={0.08}
                stroke="#f97316"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
              />
            ))}

            <Area
              type="monotone"
              dataKey={metric}
              stroke={prod.color}
              strokeWidth={2}
              fill={prod.color}
              fillOpacity={0.15}
              dot={false}
              activeDot={{ r: 4, stroke: prod.color, strokeWidth: 2, fill: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Performance Benchmarks */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-800">Deal-by-Deal Performance</h2>
          </div>
          <div className="flex gap-2">
            {BENCHMARK_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBenchmarkDays(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  benchmarkDays === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="px-6 py-3 w-8"></th>
              <th className="px-4 py-3">Deal</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Total Units</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Avg Daily (Deal)</th>
              <th className="px-4 py-3">Avg Daily (Pre-Deal)</th>
              <th className="px-4 py-3">% Change</th>
            </tr>
          </thead>
          <tbody>
            {filteredBenchmarks.map((b, i) => {
              const isExpanded = expandedDeal === b.dealId;
              // Find the daily data for this deal to get SKU breakdown
              const dealDailyData = filteredDaily.filter(d => d.dealId === b.dealId);
              // Aggregate SKU data across all deal days
              const skuTotals = {};
              dealDailyData.forEach(day => {
                day.skuBreakdown.forEach(sk => {
                  if (!skuTotals[sk.sku]) {
                    skuTotals[sk.sku] = { ...sk, units: 0, revenue: 0 };
                  }
                  skuTotals[sk.sku].units += sk.units;
                  skuTotals[sk.sku].revenue += sk.revenue;
                });
              });
              const skuList = Object.values(skuTotals);

              return (
                <>
                  <tr
                    key={b.dealId}
                    onClick={() => setExpandedDeal(isExpanded ? null : b.dealId)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-4 py-3.5 text-gray-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/deal/${b.dealId}`); }}
                        className="font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        {b.dealId}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: (DEAL_TYPES[b.dealType]?.color || '#888') + '20',
                          color: DEAL_TYPES[b.dealType]?.color || '#888',
                        }}
                      >
                        {DEAL_TYPES[b.dealType]?.name || b.dealType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">
                      {format(b.startDate, 'MMM d')} &ndash; {format(b.endDate, 'MMM d')}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{b.days}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">{b.totalUnits.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-800">${b.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-green-600">{b.avgDailyUnits}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{b.benchmarkAvgUnits}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        b.pctChange >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {b.pctChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {b.pctChange >= 0 ? '+' : ''}{b.pctChange.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  {/* Expanded SKU breakdown */}
                  {isExpanded && (
                    <tr key={`${b.dealId}-skus`}>
                      <td colSpan={10} className="px-0 py-0">
                        <div className="bg-gray-50 border-y border-gray-200">
                          <div className="px-10 py-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              SKU-Level Breakdown &mdash; {b.dealId}
                            </p>
                          </div>
                          <table className="w-full">
                            <thead>
                              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                <th className="px-10 py-2">SKU</th>
                                <th className="px-4 py-2">Variant</th>
                                <th className="px-4 py-2">ASIN</th>
                                <th className="px-4 py-2">Units Sold</th>
                                <th className="px-4 py-2">Revenue</th>
                                <th className="px-4 py-2">Avg/Day</th>
                                <th className="px-4 py-2">Share</th>
                              </tr>
                            </thead>
                            <tbody>
                              {skuList.map((sk, si) => {
                                const avgPerDay = b.days > 0 ? (sk.units / b.days).toFixed(1) : 0;
                                const share = b.totalUnits > 0 ? ((sk.units / b.totalUnits) * 100).toFixed(1) : 0;
                                return (
                                  <tr key={sk.sku} className={si % 2 === 0 ? 'bg-gray-50' : 'bg-white/60'}>
                                    <td className="px-10 py-2 font-mono text-sm font-semibold text-gray-700">{sk.sku}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{sk.variant}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500 font-mono">{sk.asin}</td>
                                    <td className="px-4 py-2 text-sm font-semibold text-gray-800">{sk.units.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-sm text-gray-700">${sk.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{avgPerDay}</td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full"
                                            style={{ width: `${share}%`, backgroundColor: prod.color }}
                                          />
                                        </div>
                                        <span className="text-xs text-gray-500">{share}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {filteredBenchmarks.length === 0 && (
          <div className="px-6 py-10 text-center text-gray-400">
            No deals found in the selected date range for this product
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500">
            <strong>% Change</strong> = ((Avg daily units during deal - Avg daily units for {benchmarkDays} days before deal) / Pre-deal avg) &times; 100.
            Click any row to expand SKU-level breakdown.
          </p>
        </div>
      </div>
    </div>
  );
}
