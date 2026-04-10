import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import { getDealStats, getTotalParentSkus, PRODUCTS, MARKETPLACES } from '../data/deals';
import {
  TOP_SKUS,
  getSkuRankIn,
  hasRankingsIn,
  parseTopSkusCsv,
  loadStoredRankings,
  saveStoredRankings,
  clearStoredRankings,
  TOP_SKUS_CSV_TEMPLATE,
} from '../data/topSkus';
import ProductTag from '../components/ProductTag';
import DealTypeBadge from '../components/DealTypeBadge';
import { format } from 'date-fns';
import { Filter, Globe, Calendar, Tag, Package, Search, X, ChevronDown, ChevronRight, AlertTriangle, Trophy, Upload, Download, CheckCircle2, RotateCcw } from 'lucide-react';

export default function Dashboard() {
  const { deals } = useDeals();
  const navigate = useNavigate();

  // Filter state
  const [marketplace, setMarketplace] = useState('ALL');
  const [dealType, setDealType] = useState('ALL');
  const [product, setProduct] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  // Excluded SKUs modal: null = closed, 'list' = list view, dealId = drilled into a deal
  const [excludedModal, setExcludedModal] = useState(null);
  // Top Excluded SKUs: which deal the user has selected
  const [topExcludedDealId, setTopExcludedDealId] = useState('');
  // Top Excluded SKUs: rankings uploaded via CSV (lives in localStorage; null = none)
  const [uploadedRankings, setUploadedRankings] = useState(() => loadStoredRankings());
  // Upload feedback: { kind: 'success'|'error'|'warn', text, details? }
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  // The "active" rankings the section uses: uploaded if present, else the static defaults.
  const activeRankings = uploadedRankings || TOP_SKUS;
  const uploadedSkuCount = useMemo(() => {
    if (!uploadedRankings) return 0;
    return Object.values(uploadedRankings).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  }, [uploadedRankings]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      const { rankings, count, errors } = parseTopSkusCsv(typeof text === 'string' ? text : '');
      if (count === 0) {
        setUploadStatus({
          kind: 'error',
          text: 'No valid rows found in the CSV.',
          details: errors.slice(0, 3),
        });
      } else {
        setUploadedRankings(rankings);
        saveStoredRankings(rankings);
        setUploadStatus({
          kind: errors.length > 0 ? 'warn' : 'success',
          text: `Loaded ${count} SKUs across ${Object.keys(rankings).length} parent products.`,
          details: errors.length > 0 ? [`${errors.length} row${errors.length > 1 ? 's' : ''} skipped — check format`] : [],
        });
      }
    };
    reader.onerror = () => setUploadStatus({ kind: 'error', text: 'Could not read the file.' });
    reader.readAsText(file);
    // Reset so re-uploading the same filename triggers onChange again
    e.target.value = '';
  };

  const handleClearUpload = () => {
    setUploadedRankings(null);
    clearStoredRankings();
    setUploadStatus({ kind: 'success', text: 'Cleared uploaded rankings.' });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TOP_SKUS_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top-skus-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const productEntries = Object.entries(PRODUCTS);
  const filteredProducts = productSearch
    ? productEntries.filter(([key, p]) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.shortName.toLowerCase().includes(productSearch.toLowerCase()))
    : productEntries;

  // Apply filters
  const today = new Date();

  const filtered = deals.filter(d => {
    if (marketplace !== 'ALL' && d.marketplace !== marketplace) return false;
    if (dealType !== 'ALL' && d.type !== dealType) return false;
    if (product !== 'ALL' && d.parent !== product) return false;
    if (startDate) {
      const from = new Date(startDate);
      if (d.endDate < from) return false;
    }
    if (endDate) {
      const to = new Date(endDate);
      if (d.startDate > to) return false;
    }
    return true;
  }).sort((a, b) => {
    // Sort: active deals first, then upcoming (closest first), then past (most recent first)
    const aActive = a.startDate <= today && a.endDate >= today;
    const bActive = b.startDate <= today && b.endDate >= today;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    if (aActive && bActive) return a.startDate - b.startDate;

    const aUpcoming = a.startDate > today;
    const bUpcoming = b.startDate > today;
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    if (aUpcoming && bUpcoming) return a.startDate - b.startDate; // closest upcoming first

    // Both past: most recent first
    return b.startDate - a.startDate;
  });

  const stats = getDealStats(filtered);
  const activeDeals = filtered.filter(d => d.startDate <= today && d.endDate >= today);
  const hasFilters = marketplace !== 'ALL' || dealType !== 'ALL' || product !== 'ALL' || startDate || endDate;

  // Upcoming deals (start date in the future) that have at least one excluded SKU
  const upcomingDealsWithExclusions = filtered
    .filter(d => d.startDate > today)
    .filter(d => d.skus.some(s => !s.participating))
    .sort((a, b) => a.startDate - b.startDate);

  // Deals (any time) that have at least one exclusion — for the Top Excluded picker
  const dealsWithExclusions = filtered
    .filter(d => d.skus.some(s => !s.participating))
    .sort((a, b) => a.startDate - b.startDate);
  const selectedTopExcludedDeal = dealsWithExclusions.find(d => d.id === topExcludedDealId);
  const topExcludedSkus = selectedTopExcludedDeal
    ? [...selectedTopExcludedDeal.skus.filter(s => !s.participating)]
        .sort((a, b) =>
          getSkuRankIn(activeRankings, selectedTopExcludedDeal.parent, a.sku) -
          getSkuRankIn(activeRankings, selectedTopExcludedDeal.parent, b.sku)
        )
        .slice(0, 5)
    : [];

  const clearFilters = () => {
    setMarketplace('ALL');
    setDealType('ALL');
    setProduct('ALL');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of all your Amazon deals</p>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Marketplace Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Globe size={13} /> Marketplace
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => setMarketplace('ALL')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  marketplace === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMarketplace('US')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  marketplace === 'US' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                US
              </button>
              <button
                onClick={() => setMarketplace('CA')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  marketplace === 'CA' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                CA
              </button>
            </div>
          </div>

          {/* Deal Type Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Tag size={13} /> Deal Type
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => setDealType('ALL')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  dealType === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDealType('LD')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  dealType === 'LD' ? 'bg-brand-orange text-white' : 'bg-orange-50 text-brand-orange hover:bg-orange-100'
                }`}
              >
                LD
              </button>
              <button
                onClick={() => setDealType('BD')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  dealType === 'BD' ? 'bg-brand-blue text-white' : 'bg-blue-50 text-brand-blue hover:bg-blue-100'
                }`}
              >
                BD
              </button>
            </div>
          </div>

          {/* Product Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Package size={13} /> Product
            </label>
            <div className="relative">
              <div
                onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm font-medium bg-white cursor-pointer flex items-center justify-between"
                style={product !== 'ALL' ? { borderColor: PRODUCTS[product]?.color, color: PRODUCTS[product]?.color } : {}}
              >
                <span>{product === 'ALL' ? 'All Products' : `${PRODUCTS[product]?.shortName} - ${PRODUCTS[product]?.name}`}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </div>
              {productDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 flex flex-col">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text" placeholder="Search products..."
                        value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <button
                      onClick={() => { setProduct('ALL'); setProductDropdownOpen(false); setProductSearch(''); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer ${product === 'ALL' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}
                    >
                      All Products
                    </button>
                    {filteredProducts.map(([key, prod]) => (
                      <button
                        key={key}
                        onClick={() => { setProduct(key); setProductDropdownOpen(false); setProductSearch(''); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer ${product === key ? 'bg-blue-50 font-semibold' : ''}`}
                        style={product === key ? { color: prod.color } : {}}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: prod.color }} />
                        {prod.shortName} - {prod.name}
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="px-3 py-3 text-center text-gray-400 text-xs">No matching products</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl p-5 border-t-4 border-brand-orange shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Deals</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.ld} LD &middot; {stats.bd} BD</p>
          <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            {hasFilters ? 'Filtered' : 'Active tracking'}
          </span>
        </div>

        {/* Excluded SKUs — clickable, opens modal */}
        <button
          onClick={() => setExcludedModal('list')}
          className="bg-white rounded-xl p-5 border-t-4 border-brand-red shadow-sm text-left hover:shadow-md hover:bg-red-50/30 transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Excluded SKUs</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.excludedSkus}</p>
              <p className="text-sm text-gray-500 mt-1">
                {upcomingDealsWithExclusions.length === 0
                  ? 'No upcoming deals affected'
                  : `${upcomingDealsWithExclusions.length} upcoming deal${upcomingDealsWithExclusions.length > 1 ? 's' : ''} affected`}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-red-400 mt-1 transition-colors" />
          </div>
        </button>

        {/* Active Now — expanded with product codes + dates */}
        <div className="bg-white rounded-xl p-5 border-t-4 border-brand-blue shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Now</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{activeDeals.length}</p>
          <p className="text-sm text-gray-500 mt-1">Running deals</p>
          {activeDeals.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {activeDeals.map(d => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/deal/${d.id}`)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="px-1.5 py-0.5 rounded text-white font-bold text-[10px]"
                      style={{ backgroundColor: PRODUCTS[d.parent]?.color }}
                    >
                      {d.parent}
                    </span>
                    <span className="font-semibold text-gray-700">{d.id}</span>
                  </span>
                  <span className="text-gray-500">
                    {format(d.startDate, 'MMM d')}{d.duration > 1 ? ` – ${format(d.endDate, 'MMM d')}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Excluded SKUs Section */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        {/* Hidden file input — triggered by the Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChosen}
          className="hidden"
        />

        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            <h2 className="text-base font-bold text-gray-800">Top Excluded SKUs</h2>
            <span className="text-xs text-gray-400 hidden sm:inline">Top 5 highest-priority SKUs excluded from a deal</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Download a starter CSV you can edit and upload"
            >
              <Download size={13} /> Template
            </button>
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              <Upload size={13} /> {uploadedRankings ? 'Replace CSV' : 'Upload CSV'}
            </button>
            {uploadedRankings && (
              <button
                onClick={handleClearUpload}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Clear the uploaded rankings"
              >
                <RotateCcw size={13} /> Clear
              </button>
            )}
            <select
              value={topExcludedDealId}
              onChange={e => setTopExcludedDealId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer min-w-[260px]"
            >
              <option value="">Select a deal…</option>
              {dealsWithExclusions.map(d => {
                const excludedCount = d.skus.filter(s => !s.participating).length;
                return (
                  <option key={d.id} value={d.id}>
                    {d.id} — {d.parent} — {format(d.startDate, 'MMM d, yyyy')} ({excludedCount} excluded)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Upload status banner */}
        {uploadStatus && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-sm flex items-start gap-2 ${
            uploadStatus.kind === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            uploadStatus.kind === 'warn' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {uploadStatus.kind === 'success' && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            {uploadStatus.kind === 'warn' && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            {uploadStatus.kind === 'error' && <X size={16} className="mt-0.5 shrink-0" />}
            <div className="flex-1">
              <p className="font-semibold">{uploadStatus.text}</p>
              {uploadStatus.details && uploadStatus.details.length > 0 && (
                <ul className="mt-1 text-xs opacity-80 list-disc list-inside">
                  {uploadStatus.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
            <button onClick={() => setUploadStatus(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Persistence caveat — only show when an upload is loaded */}
        {uploadedRankings && (
          <div className="mb-3 text-xs text-gray-500 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-500" />
            <span>
              {uploadedSkuCount} ranked SKUs loaded from your upload — saved in this browser only.
              Teammates won't see these until we add a backend.
            </span>
          </div>
        )}

        {!selectedTopExcludedDeal && (
          <div className="text-center py-6 text-gray-400 text-sm">
            {dealsWithExclusions.length === 0
              ? 'No deals currently have any excluded SKUs.'
              : uploadedRankings
                ? 'Pick a deal above to see its top 5 most important excluded SKUs.'
                : 'Upload a CSV of your ranked SKUs, then pick a deal above.'}
          </div>
        )}

        {selectedTopExcludedDeal && !hasRankingsIn(activeRankings, selectedTopExcludedDeal.parent) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">No rankings yet for {selectedTopExcludedDeal.parent}</p>
                <p className="text-amber-700 mt-1">
                  Upload a CSV that includes <strong>{selectedTopExcludedDeal.parent}</strong> rows to rank its SKUs by importance.
                  Showing the first 5 excluded SKUs by code in the meantime:
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedTopExcludedDeal && topExcludedSkus.length > 0 && (
          <div className="mt-3 overflow-hidden border border-gray-100 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 w-12">Rank</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Variant</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody>
                {topExcludedSkus.map((s, i) => {
                  const rank = getSkuRankIn(activeRankings, selectedTopExcludedDeal.parent, s.sku);
                  return (
                    <tr key={s.sku} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 font-bold text-amber-600">
                        {rank === Infinity ? '—' : `#${rank}`}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold">{s.sku}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{s.variant}</td>
                      <td className="px-4 py-2.5 text-sm">
                        {s.excludeReason
                          ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{s.excludeReason}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excluded SKUs Modal */}
      {excludedModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setExcludedModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {excludedModal !== 'list' && (
                  <button
                    onClick={() => setExcludedModal('list')}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <ChevronRight size={18} className="rotate-180" />
                  </button>
                )}
                <h2 className="text-lg font-bold text-gray-800">
                  {excludedModal === 'list'
                    ? 'Upcoming Deals with Excluded SKUs'
                    : `Excluded SKUs in ${excludedModal}`}
                </h2>
              </div>
              <button
                onClick={() => setExcludedModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto">
              {excludedModal === 'list' && (
                upcomingDealsWithExclusions.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    <p className="text-base">No upcoming deals have excluded SKUs.</p>
                    <p className="text-sm mt-1">All your scheduled deals are running with full SKU coverage.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3">Deal ID</th>
                        <th className="px-6 py-3">Product</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Dates</th>
                        <th className="px-6 py-3">Excluded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingDealsWithExclusions.map((d, i) => {
                        const excludedCount = d.skus.filter(s => !s.participating).length;
                        return (
                          <tr
                            key={d.id}
                            onClick={() => setExcludedModal(d.id)}
                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                          >
                            <td className="px-6 py-3 font-bold text-gray-800">{d.id}</td>
                            <td className="px-6 py-3">
                              <span
                                className="px-2 py-0.5 rounded text-white font-bold text-xs"
                                style={{ backgroundColor: PRODUCTS[d.parent]?.color }}
                              >
                                {d.parent}
                              </span>
                            </td>
                            <td className="px-6 py-3"><DealTypeBadge type={d.type} /></td>
                            <td className="px-6 py-3 text-sm text-gray-600">
                              {format(d.startDate, 'MMM d')}
                              {d.duration > 1 ? ` – ${format(d.endDate, 'MMM d, yyyy')}` : `, ${format(d.startDate, 'yyyy')}`}
                            </td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                {excludedCount}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

              {excludedModal !== 'list' && (() => {
                const drillDeal = filtered.find(d => d.id === excludedModal);
                if (!drillDeal) {
                  return <div className="px-6 py-12 text-center text-gray-400">Deal not found</div>;
                }
                const excludedSkus = drillDeal.skus.filter(s => !s.participating);
                return (
                  <div>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{drillDeal.parent}</span>
                      {' · '}
                      {format(drillDeal.startDate, 'MMM d, yyyy')}
                      {drillDeal.duration > 1 && ` – ${format(drillDeal.endDate, 'MMM d, yyyy')}`}
                      {' · '}
                      {drillDeal.typeName}
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="px-6 py-3">SKU</th>
                          <th className="px-6 py-3">Variant</th>
                          <th className="px-6 py-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excludedSkus.map((s, i) => (
                          <tr key={s.sku} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-6 py-3 font-mono text-sm font-semibold">{s.sku}</td>
                            <td className="px-6 py-3 text-sm text-gray-600">{s.variant}</td>
                            <td className="px-6 py-3 text-sm">
                              {s.excludeReason
                                ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{s.excludeReason}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-6 py-3 border-t border-gray-100 text-right">
                      <button
                        onClick={() => { setExcludedModal(null); navigate(`/deal/${drillDeal.id}`); }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        Open full deal →
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <p className="text-sm text-gray-500 mb-3">
        Showing {filtered.length} of {deals.length} deals
      </p>

      {/* Deals Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">
            {hasFilters ? 'Filtered Deals' : 'All Deals'}
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="px-6 py-3">Deal ID</th>
              <th className="px-6 py-3">Marketplace</th>
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Date Range</th>
              <th className="px-6 py-3">Duration</th>
              <th className="px-6 py-3">SKUs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((deal, i) => {
              const participating = deal.skus.filter(s => s.participating).length;
              return (
                <tr
                  key={deal.id}
                  onClick={() => navigate(`/deal/${deal.id}`)}
                  className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="px-6 py-3.5 font-bold text-gray-800">{deal.id}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      deal.marketplace === 'US'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {deal.marketplace === 'US' ? 'US' : 'CA'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5"><ProductTag parent={deal.parent} /></td>
                  <td className="px-6 py-3.5"><DealTypeBadge type={deal.type} /></td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">
                    {format(deal.startDate, 'MMM d, yyyy')} &ndash; {format(deal.endDate, 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">
                    {deal.duration} day{deal.duration > 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-sm font-medium text-green-600">{participating}</span>
                    <span className="text-sm text-gray-400">/{getTotalParentSkus(deal.parent)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400">
            No deals match the current filters
          </div>
        )}
      </div>
    </div>
  );
}
