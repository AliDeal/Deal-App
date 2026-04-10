import { useState, useRef, useMemo } from 'react';
import { PRODUCTS } from '../data/deals';
import {
  useFinancials, calcGrossMargin, calcGrossMarginPct, calcNetMargin, calcNetMarginPct, calcReferralFee,
} from '../context/FinancialsContext';
import { Upload, Download, RotateCcw, Package, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';

export default function ProductFinancials() {
  const { financials, updateFinancials, resetToDefault } = useFinancials();
  const [productFilter, setProductFilter] = useState('ALL');
  const [selectedSkus, setSelectedSkus] = useState([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileRef = useRef(null);
  const skuDropdownRef = useRef(null);

  // Get unique tags from data (dynamic — not hardcoded)
  const tags = useMemo(() => [...new Set(financials.map(f => f.tag))], [financials]);

  // SKUs available based on product filter
  const availableSkus = useMemo(() => {
    const items = productFilter === 'ALL' ? financials : financials.filter(f => f.tag === productFilter);
    return items.map(f => ({ sku: f.sku, variant: f.variant, tag: f.tag }));
  }, [financials, productFilter]);

  // Filtered SKU list for dropdown search
  const filteredSkuOptions = useMemo(() => {
    if (!skuSearch) return availableSkus;
    const q = skuSearch.toLowerCase();
    return availableSkus.filter(s =>
      s.sku.toLowerCase().includes(q) || s.variant.toLowerCase().includes(q)
    );
  }, [availableSkus, skuSearch]);

  // Final filtered data
  const filtered = useMemo(() => {
    let data = financials;
    if (productFilter !== 'ALL') data = data.filter(f => f.tag === productFilter);
    if (selectedSkus.length > 0) data = data.filter(f => selectedSkus.includes(f.sku));
    return data;
  }, [financials, productFilter, selectedSkus]);

  // Summary by tag (for the cards)
  const summaryByTag = useMemo(() => {
    return tags.map(tag => {
      const items = financials.filter(f => f.tag === tag);
      const avgGM = items.reduce((s, i) => s + calcGrossMarginPct(i), 0) / items.length;
      const avgNM = items.reduce((s, i) => s + calcNetMarginPct(i), 0) / items.length;
      return { tag, count: items.length, avgGM, avgNM };
    });
  }, [financials, tags]);

  const toggleSku = (sku) => {
    setSelectedSkus(prev =>
      prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
    );
  };

  const clearSkuFilter = () => {
    setSelectedSkus([]);
    setSkuSearch('');
  };

  // CSV upload handler
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          setUploadStatus({ type: 'error', message: 'CSV file is empty or has no data rows.' });
          return;
        }

        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9%]/g, ''));

        const colMap = {};
        header.forEach((h, i) => {
          if (['tag', 'product', 'parent'].includes(h)) colMap.tag = i;
          if (['asin'].includes(h)) colMap.asin = i;
          if (['sku'].includes(h)) colMap.sku = i;
          if (['variant', 'name', 'description'].includes(h)) colMap.variant = i;
          if (['normalprice', 'price', 'listprice', 'regularprice'].includes(h)) colMap.normalPrice = i;
          if (['cogs', 'cost', 'costofgoods'].includes(h)) colMap.cogs = i;
          if (['fbafee', 'fba', 'fulfillment', 'fulfillmentfee'].includes(h)) colMap.fbaFee = i;
          // Preferred new column: Referral Rate (decimal 0.15 or percentage 15)
          if (['referralrate', 'referral', 'commission', 'commissionrate'].includes(h)) colMap.referralRate = i;
          // Legacy column: Referral Fee (we'll convert to rate using normal price)
          if (['referralfee'].includes(h)) colMap.referralFee = i;
          if (['tacos', 'tacos%', 'tacospct', 'adspend%'].includes(h)) colMap.tacosPct = i;
        });

        // Either Referral Rate or legacy Referral Fee must be present
        const baseRequired = ['tag', 'asin', 'sku', 'normalPrice', 'cogs', 'fbaFee'];
        const missing = baseRequired.filter(r => colMap[r] === undefined);
        if (colMap.referralRate === undefined && colMap.referralFee === undefined) {
          missing.push('referralRate (or referralFee)');
        }
        if (missing.length > 0) {
          setUploadStatus({
            type: 'error',
            message: `Missing columns: ${missing.join(', ')}. Required: Tag, ASIN, SKU, Normal Price, COGS, FBA Fee, Referral Rate (or legacy Referral Fee)`,
          });
          return;
        }

        // Helper: parse a referral rate value that could be a decimal (0.15) or a percent (15)
        const parseRate = (raw) => {
          const n = parseFloat(raw);
          if (isNaN(n)) return null;
          // Treat values > 1 as percentages, ≤ 1 as decimals
          return n > 1 ? n / 100 : n;
        };

        const data = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (cols.length < header.length) continue;

          const normalPrice = parseFloat(cols[colMap.normalPrice]) || 0;

          // Resolve referral rate: prefer the explicit rate column, fall back to fee/price
          let referralRate = null;
          if (colMap.referralRate !== undefined) {
            referralRate = parseRate(cols[colMap.referralRate]);
          }
          if ((referralRate === null || isNaN(referralRate)) && colMap.referralFee !== undefined) {
            const fee = parseFloat(cols[colMap.referralFee]) || 0;
            referralRate = normalPrice > 0 ? fee / normalPrice : 0.15;
          }
          if (referralRate === null || isNaN(referralRate)) referralRate = 0.15;

          data.push({
            tag: cols[colMap.tag] || '',
            asin: cols[colMap.asin] || '',
            sku: cols[colMap.sku] || '',
            variant: colMap.variant !== undefined ? cols[colMap.variant] : '',
            normalPrice,
            cogs: parseFloat(cols[colMap.cogs]) || 0,
            fbaFee: parseFloat(cols[colMap.fbaFee]) || 0,
            referralRate,
            tacosPct: colMap.tacosPct !== undefined ? parseFloat(cols[colMap.tacosPct]) || 0 : 0,
          });
        }

        if (data.length === 0) {
          setUploadStatus({ type: 'error', message: 'No valid data rows found in the file.' });
          return;
        }

        updateFinancials(data);
        setProductFilter('ALL');
        setSelectedSkus([]);
        setUploadStatus({ type: 'success', message: `Imported ${data.length} SKUs successfully.` });
      } catch (err) {
        setUploadStatus({ type: 'error', message: 'Failed to parse CSV. Please check the format.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const header = 'Tag,ASIN,SKU,Variant,Normal Price,COGS,FBA Fee,Referral Rate,TACOS%';
    const sample = 'B4,B0XXXXXX01,B4-WHT-Q,White - Queen,44.99,8.50,5.80,0.15,12.0';
    const blob = new Blob([header + '\n' + sample + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_financials_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const header = 'Tag,ASIN,SKU,Variant,Normal Price,COGS,FBA Fee,Referral Rate,Referral Fee,TACOS%,Gross Margin,Gross Margin %,Net Margin,Net Margin %';
    const rows = financials.map(f => {
      const gm = calcGrossMargin(f);
      const gmPct = calcGrossMarginPct(f);
      const nm = calcNetMargin(f);
      const nmPct = calcNetMarginPct(f);
      const refFee = calcReferralFee(f);
      return `${f.tag},${f.asin},${f.sku},${f.variant || ''},${f.normalPrice},${f.cogs},${f.fbaFee},${(f.referralRate ?? 0.15).toFixed(4)},${refFee.toFixed(2)},${f.tacosPct},${gm.toFixed(2)},${gmPct.toFixed(1)},${nm.toFixed(2)},${nmPct.toFixed(1)}`;
    });
    const blob = new Blob([header + '\n' + rows.join('\n') + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_financials_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Product Financials</h1>
        <p className="text-gray-500 mt-1">ASIN/SKU cost structure, margins, and profitability</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-gray-500" />
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Import / Export</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer"
            >
              <Download size={13} /> Template
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
        >
          <Upload size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-600">Click to upload CSV</p>
          <p className="text-xs text-gray-400 mt-1">
            Required: Tag, ASIN, SKU, Normal Price, COGS, FBA Fee, Referral Rate (decimal 0.15 or percent 15), TACOS%
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Optional: Variant. Legacy "Referral Fee" column still accepted (auto-converted to rate).
            Deal prices belong in <a href="#/deal-financials" className="text-blue-600 hover:underline">Deal Financials</a>, not here.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleUpload}
            className="hidden"
          />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Dropdown */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Package size={13} /> Product
            </label>
            <div className="relative">
              <select
                value={productFilter}
                onChange={e => { setProductFilter(e.target.value); setSelectedSkus([]); setSkuSearch(''); }}
                className="w-full appearance-none px-3 py-2.5 pr-8 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                style={productFilter !== 'ALL' && PRODUCTS[productFilter]
                  ? { borderColor: PRODUCTS[productFilter].color, color: PRODUCTS[productFilter].color }
                  : {}
                }
              >
                <option value="ALL">All Products ({financials.length} SKUs)</option>
                {tags.map(tag => {
                  const prod = PRODUCTS[tag];
                  const count = financials.filter(f => f.tag === tag).length;
                  return (
                    <option key={tag} value={tag}>
                      {prod ? `${prod.shortName} - ${prod.name}` : tag} ({count} SKUs)
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* SKU Multi-Select Dropdown with Search */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Search size={13} /> SKU Filter
            </label>
            <div className="relative" ref={skuDropdownRef}>
              <div
                onClick={() => setSkuDropdownOpen(!skuDropdownOpen)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer flex items-center justify-between min-h-[42px]"
              >
                {selectedSkus.length === 0 ? (
                  <span className="text-gray-400">All SKUs</span>
                ) : (
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedSkus.slice(0, 3).map(sku => (
                      <span
                        key={sku}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                      >
                        {sku}
                        <button
                          onClick={e => { e.stopPropagation(); toggleSku(sku); }}
                          className="hover:text-blue-900 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {selectedSkus.length > 3 && (
                      <span className="text-xs text-gray-400 self-center">+{selectedSkus.length - 3} more</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {selectedSkus.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); clearSkuFilter(); }}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Dropdown panel */}
              {skuDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 flex flex-col">
                  {/* Search */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search SKU or variant..."
                        value={skuSearch}
                        onChange={e => setSkuSearch(e.target.value)}
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="px-3 py-1.5 border-b border-gray-100 flex gap-2">
                    <button
                      onClick={() => setSelectedSkus(availableSkus.map(s => s.sku))}
                      className="text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      onClick={clearSkuFilter}
                      className="text-xs text-gray-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* SKU list */}
                  <div className="flex-1 overflow-y-auto">
                    {filteredSkuOptions.length === 0 && (
                      <div className="px-3 py-4 text-center text-gray-400 text-sm">No matching SKUs</div>
                    )}
                    {filteredSkuOptions.map(s => {
                      const isSelected = selectedSkus.includes(s.sku);
                      const prod = PRODUCTS[s.tag];
                      return (
                        <button
                          key={s.sku}
                          onClick={() => toggleSku(s.sku)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 cursor-pointer ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: prod?.color || '#888' }}
                          />
                          <span className="font-mono font-medium text-gray-800">{s.sku}</span>
                          <span className="text-gray-400 text-xs truncate">{s.variant}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Done button */}
                  <div className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => setSkuDropdownOpen(false)}
                      className="w-full px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 cursor-pointer"
                    >
                      Done {selectedSkus.length > 0 && `(${selectedSkus.length} selected)`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {summaryByTag.map(s => {
          const prod = PRODUCTS[s.tag];
          const isActive = productFilter === s.tag;
          return (
            <button
              key={s.tag}
              onClick={() => { setProductFilter(isActive ? 'ALL' : s.tag); setSelectedSkus([]); }}
              className={`bg-white rounded-xl p-4 shadow-sm text-left cursor-pointer transition-all border-2 ${
                isActive ? 'border-current' : 'border-transparent hover:shadow-md'
              }`}
              style={isActive ? { borderColor: prod?.color } : {}}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: prod?.color || '#888' }} />
                <span className="text-sm font-bold text-gray-700">{s.tag}</span>
                <span className="text-xs text-gray-400">{s.count} SKUs</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-gray-500">Gross</p>
                  <p className={`text-sm font-bold ${s.avgGM >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {s.avgGM.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net</p>
                  <p className={`text-sm font-bold ${s.avgNM >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {s.avgNM.toFixed(1)}%
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter indicator */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          Showing {filtered.length} of {financials.length} SKUs
          {(productFilter !== 'ALL' || selectedSkus.length > 0) && (
            <button
              onClick={() => { setProductFilter('ALL'); clearSkuFilter(); }}
              className="ml-2 text-blue-600 hover:underline cursor-pointer text-xs font-medium"
            >
              Clear filters
            </button>
          )}
        </p>
      </div>

      {/* Financials Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">ASIN</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Normal Price</th>
                <th className="px-4 py-3">COGS</th>
                <th className="px-4 py-3">FBA Fee</th>
                <th className="px-4 py-3">Referral</th>
                <th className="px-4 py-3">Gross Margin</th>
                <th className="px-4 py-3">GM %</th>
                <th className="px-4 py-3">TACOS %</th>
                <th className="px-4 py-3">Net Margin</th>
                <th className="px-4 py-3">NM %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const gm = calcGrossMargin(item);
                const gmPct = calcGrossMarginPct(item);
                const nm = calcNetMargin(item);
                const nmPct = calcNetMarginPct(item);
                const prod = PRODUCTS[item.tag];
                return (
                  <tr
                    key={`${item.sku}-${i}`}
                    className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: prod?.color || '#888' }}
                      >
                        {item.tag}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{item.asin}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 font-mono">{item.sku}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">${item.normalPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">${item.cogs.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">${item.fbaFee.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      ${calcReferralFee(item).toFixed(2)}
                      <span className="text-[10px] text-gray-400 ml-1">({((item.referralRate ?? 0.15) * 100).toFixed(0)}%)</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${gm >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${gm.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        gmPct >= 30 ? 'bg-green-100 text-green-700'
                          : gmPct >= 15 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {gmPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.tacosPct.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${nm >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        ${nm.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        nmPct >= 20 ? 'bg-blue-100 text-blue-700'
                          : nmPct >= 10 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {nmPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400">
            No SKUs match the current filters
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500">
            <strong>Referral Fee</strong> = Price &times; Referral Rate (default 15%) &nbsp;|&nbsp;
            <strong>Gross Margin</strong> = Price - COGS - FBA - Referral &nbsp;|&nbsp;
            <strong>Net Margin</strong> = Gross Margin - (Price &times; TACOS%)
          </p>
        </div>
      </div>
    </div>
  );
}
