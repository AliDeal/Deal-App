import { useState, useRef, useMemo } from 'react';
import { PRODUCTS } from '../data/deals';
import { useFinancials, calcGrossMargin, calcGrossMarginPct, calcNetMargin, calcNetMarginPct } from '../context/FinancialsContext';
import { Upload, Download, Package, Globe, Tag, Calendar, CheckCircle2, AlertCircle, Filter, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, getISOWeek, isWithinInterval, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

// Parse the messy Amazon Deal Dashboard CSV
function parseDealDashboardCSV(text) {
  const results = [];
  // Split by newlines but handle quoted fields with newlines
  const rows = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.trim()) rows.push(current);
      current = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(current);

  if (rows.length < 2) return [];

  // The CSV has a tricky structure: the header has "Product nameASIN, SKU" as a
  // quoted field with a comma, making the header have one more column than data rows.
  // Data rows: [0]=Date, [1]=TAG, [2]=ASIN, [3]=SKU name, [4]=Pricing(quoted,multiline),
  //   [5]=Deal price info, [6]=Discount, [7]=Committed, [8]=InStock, [9]=Action,
  //   [10]=Reference Price, [11]=Max Deal Price, [12+]=Deal ID...
  // We detect Reference Price and Deal Price by scanning each row for the numeric
  // price columns after the text columns.

  for (let r = 1; r < rows.length; r++) {
    const cols = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < rows[r].length; i++) {
      const c = rows[r][i];
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { cols.push(field.trim()); field = ''; }
      else field += c;
    }
    cols.push(field.trim());

    if (cols.length < 5) continue;

    // Data row column positions (verified from actual CSV):
    // [0]=Date, [1]=TAG, [2]=ASIN, [3]=SKU name,
    // [4]=Pricing details (quoted multi-line), [5]=Deal discount info,
    // [6]=Discount per unit, [7]=Committed units, [8]=InStock+Fulfilled,
    // [9]=Action, [10]=Reference Price (col K), [11]=Max Deal Price (col L),
    // [12]=Deal ID (col N)
    const dateStr = cols[0];
    const tag = cols[1];
    const asin = cols[2];
    let skuName = cols[3] || '';
    const refPriceRaw = cols[10] || '';
    const dealPriceRaw = cols[11] || '';
    // Deal ID can be at col 12 or further
    let dealId = '';
    for (let ci = 12; ci < Math.min(cols.length, 20); ci++) {
      const val = (cols[ci] || '').trim();
      if (/^D\d{3,}$/.test(val)) { dealId = val; break; }
    }

    // Skip if no date or tag
    if (!dateStr || !tag) continue;

    // Parse date (M/D/YYYY or MM/DD/YYYY)
    let date = null;
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[0]) - 1;
        const d = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        date = new Date(y, m, d);
      }
    } catch { continue; }
    if (!date || isNaN(date.getTime())) continue;

    // Clean SKU name - remove appended error messages
    const errorPhrases = ['Valid Reference Price missing', 'No inventory', 'Inactive SKU', 'Featured ASIN', 'Learn more'];
    errorPhrases.forEach(phrase => {
      const idx = skuName.indexOf(phrase);
      if (idx > 0) skuName = skuName.substring(0, idx);
    });

    // Parse reference price from column K
    let referencePrice = null;
    let refPriceStatus = 'ok';
    const refTrimmed = refPriceRaw.trim();
    const refClean = refTrimmed.replace(/[US$,]/g, '').trim();
    const refNum = parseFloat(refClean);

    if (refTrimmed === '#N/A' || refTrimmed === '' || refTrimmed.includes('ineligible') || refTrimmed.includes('reference price')) {
      refPriceStatus = 'no_reference';
    } else if (refTrimmed.includes('Inactive') || refTrimmed.includes('Active')) {
      refPriceStatus = 'inactive';
    } else if (!isNaN(refNum) && refNum > 0) {
      referencePrice = refNum;
    } else {
      const numMatch = refTrimmed.match(/[\d]+\.?\d*/);
      if (numMatch) {
        referencePrice = parseFloat(numMatch[0]);
      } else {
        refPriceStatus = 'no_reference';
      }
    }

    // Parse deal price from column L (Max Deal Price)
    // Values can be: numeric (71.24), #N/A (no ref price), #VALUE! (closed SKU),
    // or error text like "This ASIN is ineligible..."
    let dealPrice = null;
    let dealPriceStatus = 'ok';
    const dpTrimmed = dealPriceRaw.trim();
    // Strip currency symbols: $, US$, US, commas
    const dpClean = dpTrimmed.replace(/[US$,]/g, '').trim();
    const dpNum = parseFloat(dpClean);

    if (dpTrimmed === '#N/A' || dpTrimmed === '' || dpTrimmed.includes('ineligible') || dpTrimmed.includes('reference price')) {
      // #N/A or error text = no reference price on Amazon
      dealPriceStatus = 'no_reference';
    } else if (dpTrimmed === '#VALUE!' || dpTrimmed.includes('Inactive') || dpTrimmed.includes('Active')) {
      // #VALUE! or inactive = closed SKU on Amazon
      dealPriceStatus = 'closed';
    } else if (!isNaN(dpNum) && dpNum > 0) {
      dealPrice = dpNum;
    } else {
      // Fallback: try to extract any number from the string
      const numMatch = dpTrimmed.match(/[\d]+\.?\d*/);
      if (numMatch) {
        dealPrice = parseFloat(numMatch[0]);
      } else {
        dealPriceStatus = 'no_reference';
      }
    }

    // Determine participation
    let participating = true;
    let exclusionReason = '';
    if (refPriceStatus === 'no_reference') {
      participating = false;
      exclusionReason = 'No reference price';
    } else if (refPriceStatus === 'inactive') {
      participating = false;
      exclusionReason = 'Inactive SKU';
    } else if (dealPriceStatus === 'no_reference') {
      participating = false;
      exclusionReason = 'No reference price';
    } else if (dealPriceStatus === 'closed') {
      participating = false;
      exclusionReason = 'Closed on Amazon';
    }

    // Parse committed units / in stock
    const stockRaw = cols[8] || '';
    const stockMatch = stockRaw.match(/(\d+)/);
    const inStock = stockMatch ? parseInt(stockMatch[0]) : 0;
    if (inStock === 0 && participating) {
      participating = false;
      exclusionReason = 'No inventory';
    }

    results.push({
      date,
      dateStr: format(date, 'yyyy-MM-dd'),
      tag,
      asin,
      skuName,
      referencePrice,
      dealPrice,
      refPriceStatus,
      dealPriceStatus,
      dealId,
      participating,
      exclusionReason,
      inStock,
    });
  }
  return results;
}

// Generate week options (Mon-Sun) for a given year
function getWeekOptions(year) {
  const weeks = [];
  let d = startOfWeek(new Date(year, 0, 4), { weekStartsOn: 1 }); // ISO week 1
  while (d.getFullYear() <= year) {
    const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
    const weekNum = getISOWeek(d);
    weeks.push({
      value: format(d, 'yyyy-MM-dd'),
      label: `Week ${weekNum} (${format(d, 'MMM d')} - ${format(weekEnd, 'MMM d')})`,
      start: d,
      end: weekEnd,
    });
    d = addWeeks(d, 1);
    if (weekNum >= 52 && d.getFullYear() > year) break;
  }
  return weeks;
}

export default function DealFinancials() {
  const { financials, getSkuFinancials } = useFinancials();
  const fileRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [dealData, setDealData] = useState(() => {
    try {
      const s = localStorage.getItem('dealapp-deal-dashboard');
      return s ? JSON.parse(s, (k, v) => k === 'date' ? new Date(v) : v) : [];
    } catch { return []; }
  });

  // Filters
  const [productFilter, setProductFilter] = useState('ALL');
  const [showParticipating, setShowParticipating] = useState('all'); // 'all', 'yes', 'no'
  const [skuSearch, setSkuSearch] = useState('');
  const [selectedSkus, setSelectedSkus] = useState([]);
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const [dealTypeFilter, setDealTypeFilter] = useState('ALL'); // 'ALL', 'LD', 'BD'

  const weekOptions = useMemo(() => getWeekOptions(2026), []);

  // Default to current week (Week 15 = Apr 6-12 for 2026-04-09)
  const currentWeekDefault = useMemo(() => {
    const today = new Date(2026, 3, 9); // Apr 9, 2026
    const ws = startOfWeek(today, { weekStartsOn: 1 });
    return format(ws, 'yyyy-MM-dd');
  }, []);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekDefault);

  // Get unique tags and deal IDs from data
  const tags = useMemo(() => [...new Set(dealData.map(d => d.tag))], [dealData]);
  const dealIds = useMemo(() => [...new Set(dealData.filter(d => d.dealId).map(d => d.dealId))], [dealData]);

  // Available SKUs based on product filter
  const availableSkus = useMemo(() => {
    const items = productFilter === 'ALL' ? dealData : dealData.filter(d => d.tag === productFilter);
    const unique = new Map();
    items.forEach(d => { if (!unique.has(d.asin)) unique.set(d.asin, { asin: d.asin, skuName: d.skuName, tag: d.tag }); });
    return Array.from(unique.values());
  }, [dealData, productFilter]);

  const filteredSkuOptions = useMemo(() => {
    if (!skuSearch) return availableSkus;
    const q = skuSearch.toLowerCase();
    return availableSkus.filter(s => s.asin.toLowerCase().includes(q) || s.skuName.toLowerCase().includes(q));
  }, [availableSkus, skuSearch]);

  const toggleSku = (asin) => setSelectedSkus(prev => prev.includes(asin) ? prev.filter(s => s !== asin) : [...prev, asin]);
  const clearSkuFilter = () => { setSelectedSkus([]); setSkuSearch(''); };

  // Save deal data
  const saveDealData = (data) => {
    setDealData(data);
    localStorage.setItem('dealapp-deal-dashboard', JSON.stringify(data));
  };

  // Upload handler
  const processUploadedData = (csvText) => {
    const parsed = parseDealDashboardCSV(csvText);
    if (parsed.length === 0) {
      setUploadStatus({ type: 'error', message: 'No valid data rows found.' });
      return;
    }
    const existingMap = new Map();
    dealData.forEach(d => existingMap.set(`${d.dateStr}-${d.asin}`, d));
    parsed.forEach(d => existingMap.set(`${d.dateStr}-${d.asin}`, d));
    const merged = Array.from(existingMap.values());
    saveDealData(merged);
    const participating = parsed.filter(d => d.participating).length;
    const excluded = parsed.filter(d => !d.participating).length;
    setUploadStatus({
      type: 'success',
      message: `Imported ${parsed.length} SKUs (${participating} participating, ${excluded} excluded). Total records: ${merged.length}`,
    });
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          // Use first sheet or "Deals Dashboard" sheet if it exists
          const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('deal')) || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const csvText = XLSX.utils.sheet_to_csv(ws);
          processUploadedData(csvText);
        } catch (err) {
          setUploadStatus({ type: 'error', message: 'Failed to parse Excel file: ' + err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          processUploadedData(evt.target.result);
        } catch (err) {
          setUploadStatus({ type: 'error', message: 'Failed to parse CSV: ' + err.message });
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // Filter data
  const filtered = useMemo(() => {
    let data = dealData;
    if (productFilter !== 'ALL') data = data.filter(d => d.tag === productFilter);
    if (selectedSkus.length > 0) data = data.filter(d => selectedSkus.includes(d.asin));
    if (selectedWeek) {
      const weekOpt = weekOptions.find(w => w.value === selectedWeek);
      if (weekOpt) {
        data = data.filter(d => {
          const dd = new Date(d.date);
          return dd >= weekOpt.start && dd <= weekOpt.end;
        });
      }
    }
    if (showParticipating === 'yes') data = data.filter(d => d.participating);
    if (showParticipating === 'no') data = data.filter(d => !d.participating);
    // Deal type filter - infer from deal ID mapping or tag-based heuristic
    // For now we filter based on deal data if dealId is available in the deals context
    return data;
  }, [dealData, productFilter, selectedWeek, showParticipating, weekOptions]);

  // Group by deal ID for summary
  const dealSummary = useMemo(() => {
    const byDeal = {};
    filtered.forEach(d => {
      const key = d.dealId || 'No Deal ID';
      if (!byDeal[key]) byDeal[key] = { total: 0, participating: 0, excluded: 0, dates: new Set() };
      byDeal[key].total++;
      if (d.participating) byDeal[key].participating++;
      else byDeal[key].excluded++;
      byDeal[key].dates.add(d.dateStr);
    });
    return byDeal;
  }, [filtered]);

  // Build enriched table rows
  const tableRows = useMemo(() => {
    return filtered.map(d => {
      // Find matching financials by ASIN or by tag+skuName pattern
      let fin = financials.find(f => f.asin === d.asin);
      if (!fin) {
        // Try matching by tag
        fin = financials.find(f => f.tag === d.tag && d.skuName.toLowerCase().includes(f.sku?.toLowerCase() || '___'));
      }

      const normalPrice = fin?.normalPrice || null;
      const cogs = fin?.cogs || 0;
      const fbaFee = fin?.fbaFee || 0;
      const referralFee = fin?.referralFee || 0;
      const tacosPct = fin?.tacosPct || 0;

      // STR logic: Reference Price > Normal Price = Yes
      const strReflecting = d.referencePrice && normalPrice ? d.referencePrice > normalPrice : false;
      const strPct = d.referencePrice && normalPrice ? ((d.referencePrice - normalPrice) / normalPrice) * 100 : null;

      // Discount vs actual price
      const discountVsActual = normalPrice && d.dealPrice
        ? ((normalPrice - d.dealPrice) / normalPrice) * 100
        : null;

      // Discount vs STR (reference) price
      const discountVsSTR = d.referencePrice && d.dealPrice
        ? ((d.referencePrice - d.dealPrice) / d.referencePrice) * 100
        : null;

      // Deal margins (using deal price)
      let dealGrossMargin = null;
      let dealGrossMarginPct = null;
      let dealNetMargin = null;
      let dealNetMarginPct = null;
      if (d.dealPrice && fin) {
        dealGrossMargin = d.dealPrice - cogs - fbaFee - referralFee;
        dealGrossMarginPct = (dealGrossMargin / d.dealPrice) * 100;
        const tacosAmount = d.dealPrice * (tacosPct / 100);
        dealNetMargin = dealGrossMargin - tacosAmount;
        dealNetMarginPct = (dealNetMargin / d.dealPrice) * 100;
      }

      return {
        ...d,
        normalPrice,
        cogs,
        fbaFee,
        referralFee,
        tacosPct,
        strReflecting,
        strPct,
        discountVsActual,
        discountVsSTR,
        dealGrossMargin,
        dealGrossMarginPct,
        dealNetMargin,
        dealNetMarginPct,
        hasFinancials: !!fin,
      };
    });
  }, [filtered, financials]);

  const prod = productFilter !== 'ALL' ? PRODUCTS[productFilter] : null;

  const marginColor = (val) => {
    if (val === null) return 'text-gray-400';
    if (val < 0) return 'text-red-600';
    if (val < 15) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Deal Financials</h1>
        <p className="text-gray-500 mt-1">Pre-deal margin analysis with Amazon Deal Dashboard data</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-gray-500" />
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Amazon Deal Dashboard Import
            </span>
            <span className="text-xs text-gray-400">
              ({dealData.length} records loaded)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { saveDealData([]); setUploadStatus(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer"
            >
              Clear Data
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer"
            >
              <Upload size={13} /> Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} className="hidden" />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Upload the Amazon Deal Dashboard export (.csv or .xlsx). Required columns: Date, TAG, ASIN, SKU, Reference Price, Max Deal Price, Deal ID
        </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Week Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Calendar size={13} /> Week
            </label>
            <div className="relative">
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              >
                <option value="">All Weeks</option>
                {weekOptions.map(w => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Product Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Package size={13} /> Product
            </label>
            <div className="relative">
              <select
                value={productFilter}
                onChange={e => { setProductFilter(e.target.value); setSelectedSkus([]); setSkuSearch(''); }}
                className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                style={prod ? { borderColor: prod.color, color: prod.color } : {}}
              >
                <option value="ALL">All Products</option>
                {tags.map(t => {
                  const p = PRODUCTS[t];
                  return <option key={t} value={t}>{p ? `${p.shortName} - ${p.name}` : t}</option>;
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
              <Tag size={13} /> SKU Filter
            </label>
            <div className="relative">
              <div
                onClick={() => setSkuDropdownOpen(!skuDropdownOpen)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer flex items-center justify-between min-h-[38px]"
              >
                {selectedSkus.length === 0 ? (
                  <span className="text-gray-400">All SKUs</span>
                ) : (
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedSkus.slice(0, 2).map(asin => (
                      <span key={asin} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                        {asin.substring(0, 10)}
                        <button onClick={e => { e.stopPropagation(); toggleSku(asin); }} className="hover:text-blue-900 cursor-pointer"><X size={9} /></button>
                      </span>
                    ))}
                    {selectedSkus.length > 2 && <span className="text-[10px] text-gray-400 self-center">+{selectedSkus.length - 2}</span>}
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {selectedSkus.length > 0 && (
                    <button onClick={e => { e.stopPropagation(); clearSkuFilter(); }} className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"><X size={12} /></button>
                  )}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {skuDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 flex flex-col">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="relative">
                      <input
                        type="text" placeholder="Search ASIN or SKU..."
                        value={skuSearch} onChange={e => setSkuSearch(e.target.value)} autoFocus
                        className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <Tag size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  <div className="px-3 py-1 border-b border-gray-100 flex gap-2">
                    <button onClick={() => setSelectedSkus(availableSkus.map(s => s.asin))} className="text-[10px] text-blue-600 hover:underline cursor-pointer">Select all</button>
                    <button onClick={clearSkuFilter} className="text-[10px] text-gray-500 hover:underline cursor-pointer">Clear</button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {filteredSkuOptions.length === 0 && <div className="px-3 py-3 text-center text-gray-400 text-xs">No matching SKUs</div>}
                    {filteredSkuOptions.map(s => {
                      const isSelected = selectedSkus.includes(s.asin);
                      return (
                        <button key={s.asin} onClick={() => toggleSku(s.asin)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50 cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}>
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {isSelected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="font-mono text-gray-700">{s.asin}</span>
                          <span className="text-gray-400 truncate text-[10px]">{s.skuName}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 py-1.5 border-t border-gray-100">
                    <button onClick={() => setSkuDropdownOpen(false)} className="w-full px-3 py-1 bg-gray-800 text-white rounded text-xs font-medium hover:bg-gray-900 cursor-pointer">
                      Done {selectedSkus.length > 0 && `(${selectedSkus.length})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Deal Type Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Tag size={13} /> Deal Type
            </label>
            <div className="flex gap-1.5">
              <button onClick={() => setDealTypeFilter('ALL')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium cursor-pointer ${dealTypeFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
              <button onClick={() => setDealTypeFilter('LD')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium cursor-pointer ${dealTypeFilter === 'LD' ? 'bg-brand-orange text-white' : 'bg-orange-50 text-brand-orange hover:bg-orange-100'}`}>Lightning</button>
              <button onClick={() => setDealTypeFilter('BD')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium cursor-pointer ${dealTypeFilter === 'BD' ? 'bg-brand-blue text-white' : 'bg-blue-50 text-brand-blue hover:bg-blue-100'}`}>Best Deal</button>
            </div>
          </div>

          {/* Participation Filter */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter size={13} /> Participation
            </label>
            <div className="flex gap-1.5">
              {[['all', 'All'], ['yes', 'Participating'], ['no', 'Excluded']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setShowParticipating(val)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                    showParticipating === val ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Deal ID info */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Tag size={13} /> Deal IDs in View
            </label>
            <div className="flex flex-wrap gap-1 max-h-[42px] overflow-y-auto">
              {Object.keys(dealSummary).length === 0 && (
                <span className="text-xs text-gray-400 py-2">No deals in selected range</span>
              )}
              {Object.entries(dealSummary).map(([id, info]) => (
                <span key={id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {id} ({info.participating}/{info.total})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-3">
        Showing {tableRows.length} SKUs
        {tableRows.filter(r => r.participating).length > 0 && (
          <span className="text-green-600 ml-2">
            {tableRows.filter(r => r.participating).length} participating
          </span>
        )}
        {tableRows.filter(r => !r.participating).length > 0 && (
          <span className="text-red-500 ml-2">
            {tableRows.filter(r => !r.participating).length} excluded
          </span>
        )}
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-3 py-3">Tag</th>
                <th className="px-3 py-3">ASIN</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Deal ID</th>
                <th className="px-3 py-3">Normal Price</th>
                <th className="px-3 py-3 bg-blue-50/50">Deal Price</th>
                <th className="px-3 py-3 bg-blue-50/50">Disc vs Price</th>
                <th className="px-3 py-3">STR Price</th>
                <th className="px-3 py-3">Ref Price</th>
                <th className="px-3 py-3">Disc vs STR</th>
                <th className="px-3 py-3">STR</th>
                <th className="px-3 py-3">STR %</th>
                <th className="px-3 py-3">COGS</th>
                <th className="px-3 py-3">FBA</th>
                <th className="px-3 py-3">Referral</th>
                <th className="px-3 py-3 bg-green-50/50">Deal GM</th>
                <th className="px-3 py-3 bg-green-50/50">Deal GM%</th>
                <th className="px-3 py-3">TACOS%</th>
                <th className="px-3 py-3 bg-green-50/50">Deal NM</th>
                <th className="px-3 py-3 bg-green-50/50">Deal NM%</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const prodColor = PRODUCTS[row.tag]?.color || '#888';
                return (
                  <tr
                    key={`${row.dateStr}-${row.asin}-${i}`}
                    className={`text-sm ${!row.participating ? 'bg-red-50/30 opacity-70' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: prodColor }}>
                        {row.tag}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{row.asin}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-700 max-w-[150px] truncate" title={row.skuName}>{row.skuName}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-blue-600">{row.dealId || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">
                      {row.normalPrice ? `$${row.normalPrice.toFixed(2)}` : <span className="text-gray-400">—</span>}
                    </td>
                    {/* Deal Price */}
                    <td className="px-3 py-2.5 bg-blue-50/30">
                      {row.dealPrice ? (
                        <span className="text-xs font-semibold text-blue-700">${row.dealPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    {/* Discount vs Price */}
                    <td className="px-3 py-2.5 bg-blue-50/30">
                      {row.discountVsActual !== null ? (
                        <span className={`text-xs font-bold ${row.discountVsActual > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.discountVsActual.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {/* STR Price = Reference Price */}
                    <td className="px-3 py-2.5">
                      {row.referencePrice ? (
                        <span className="text-xs text-gray-700">${row.referencePrice.toFixed(2)}</span>
                      ) : <span className="text-[10px] text-gray-400">N/A</span>}
                    </td>
                    {/* Reference Price (same as STR) */}
                    <td className="px-3 py-2.5">
                      {row.referencePrice ? (
                        <span className="text-xs text-gray-600">${row.referencePrice.toFixed(2)}</span>
                      ) : <span className="text-[10px] text-gray-400">N/A</span>}
                    </td>
                    {/* Discount vs STR */}
                    <td className="px-3 py-2.5">
                      {row.discountVsSTR !== null ? (
                        <span className={`text-xs font-bold ${row.discountVsSTR > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.discountVsSTR.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {/* STR Reflecting */}
                    <td className="px-3 py-2.5">
                      {row.referencePrice && row.normalPrice ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          row.strReflecting ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row.strReflecting ? 'Yes' : 'No'}
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {/* STR % */}
                    <td className="px-3 py-2.5">
                      {row.strPct !== null ? (
                        <span className={`text-xs font-bold ${row.strPct > 0 ? 'text-green-600' : row.strPct < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                          {row.strPct > 0 ? '+' : ''}{row.strPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {/* Cost columns */}
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.hasFinancials ? `$${row.cogs.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.hasFinancials ? `$${row.fbaFee.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.hasFinancials ? `$${row.referralFee.toFixed(2)}` : '—'}</td>
                    {/* Deal Gross Margin */}
                    <td className="px-3 py-2.5 bg-green-50/30">
                      {row.dealGrossMargin !== null ? (
                        <span className={`text-xs font-bold ${marginColor(row.dealGrossMarginPct)}`}>
                          ${row.dealGrossMargin.toFixed(2)}
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 bg-green-50/30">
                      {row.dealGrossMarginPct !== null ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.dealGrossMarginPct >= 30 ? 'bg-green-100 text-green-700'
                            : row.dealGrossMarginPct >= 15 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {row.dealGrossMarginPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.hasFinancials ? `${row.tacosPct.toFixed(1)}%` : '—'}</td>
                    {/* Deal Net Margin */}
                    <td className="px-3 py-2.5 bg-green-50/30">
                      {row.dealNetMargin !== null ? (
                        <span className={`text-xs font-bold ${marginColor(row.dealNetMarginPct)}`}>
                          ${row.dealNetMargin.toFixed(2)}
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 bg-green-50/30">
                      {row.dealNetMarginPct !== null ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.dealNetMarginPct >= 20 ? 'bg-blue-100 text-blue-700'
                            : row.dealNetMarginPct >= 10 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {row.dealNetMarginPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    {/* Status */}
                    <td className="px-3 py-2.5">
                      {row.participating ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold" title={row.exclusionReason}>
                          {row.exclusionReason}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tableRows.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400">
            {dealData.length === 0 ? 'Upload an Amazon Deal Dashboard CSV to get started' : 'No data matches the current filters'}
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500">
            <strong>Deal GM</strong> = Deal Price - COGS - FBA - Referral &nbsp;|&nbsp;
            <strong>Deal NM</strong> = Deal GM - (Deal Price x TACOS%) &nbsp;|&nbsp;
            <strong>STR</strong> = Ref Price {'>'} Normal Price &nbsp;|&nbsp;
            <strong>Disc vs Price</strong> = (Normal - Deal) / Normal
          </p>
        </div>
      </div>
    </div>
  );
}
