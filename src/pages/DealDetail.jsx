import { useParams, useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import {
  useFinancials,
  calcGrossMargin, calcGrossMarginPct, calcNetMargin, calcNetMarginPct, calcReferralFee,
} from '../context/FinancialsContext';
import { getTotalParentSkus } from '../data/deals';
import ProductTag from '../components/ProductTag';
import DealTypeBadge from '../components/DealTypeBadge';
import { format } from 'date-fns';
import { ArrowLeft, Check, X, AlertTriangle, MessageSquare, Send, Trash2, ArrowRightLeft, Pencil, Clock } from 'lucide-react';
import { useState, useMemo } from 'react';

// localStorage key for per-deal manual deal-price overrides:
//   { [dealId]: { [skuCode]: priceNumber } }
const MANUAL_OVERRIDES_KEY = 'dealapp.manualDealPrices.v1';

function loadManualOverrides() {
  try {
    const s = localStorage.getItem(MANUAL_OVERRIDES_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function saveManualOverrides(map) {
  try {
    localStorage.setItem(MANUAL_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export default function DealDetail() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const { deals, excludeSku, includeSku, addComment, deleteComment } = useDeals();
  const { findSku } = useFinancials();
  const deal = deals.find(d => d.id === dealId);
  const [excludeModal, setExcludeModal] = useState(null);
  const [reason, setReason] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  // Per-deal manual deal-price overrides, persisted to localStorage so they
  // survive page refresh. Shape: { [skuCode]: priceNumber }
  const [dealPrices, setDealPrices] = useState(() => {
    const all = loadManualOverrides();
    return all[dealId] || {};
  });
  // Which SKU row is currently in edit mode (one at a time)
  const [editingSku, setEditingSku] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  // Price history modal: null = closed, skuCode = open showing that SKU's history
  const [historyModalSku, setHistoryModalSku] = useState(null);

  // Load deal dashboard data from localStorage (uploaded in Deal Financials)
  const dealDashboardData = useMemo(() => {
    try {
      const s = localStorage.getItem('dealapp-deal-dashboard');
      return s ? JSON.parse(s, (k, v) => k === 'date' ? new Date(v) : v) : [];
    } catch { return []; }
  }, []);

  // Find matching deal dashboard records for this deal
  // Match by deal ID first, then by tag + date range overlap
  const dealDashboardForDeal = useMemo(() => {
    if (!deal) return [];
    // Try matching by deal ID
    let matches = dealDashboardData.filter(d => d.dealId === dealId);
    // If no deal ID match, try matching by tag and date range
    if (matches.length === 0) {
      matches = dealDashboardData.filter(d => {
        if (d.tag !== deal.parent) return false;
        const dd = new Date(d.date);
        return dd >= deal.startDate && dd <= deal.endDate;
      });
    }
    // If still no match, try just by tag and closest date
    if (matches.length === 0) {
      matches = dealDashboardData.filter(d => d.tag === deal.parent);
      if (matches.length > 0) {
        // Get the latest date entries
        const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestDate = sorted[0].dateStr;
        matches = sorted.filter(d => d.dateStr === latestDate);
      }
    }
    // Deduplicate by ASIN (keep latest)
    const byAsin = new Map();
    matches.forEach(d => {
      const existing = byAsin.get(d.asin);
      if (!existing || new Date(d.date) > new Date(existing.date)) {
        byAsin.set(d.asin, d);
      }
    });
    return Array.from(byAsin.values());
  }, [deal, dealDashboardData, dealId]);

  const hasDealDashboard = dealDashboardForDeal.length > 0;

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Deal not found</p>
      </div>
    );
  }

  // If we have deal dashboard data, use those SKUs instead of hardcoded sample data
  const effectiveSkus = useMemo(() => {
    if (!hasDealDashboard) return deal.skus;
    // Build SKU list from deal dashboard data, enriched with participation status
    return dealDashboardForDeal.map(d => ({
      sku: d.skuName,
      asin: d.asin,
      variant: d.skuName,
      participating: d.participating,
      strReflecting: true,
      excludeReason: d.exclusionReason || '',
    }));
  }, [deal.skus, dealDashboardForDeal, hasDealDashboard]);

  const participating = effectiveSkus.filter(s => s.participating);
  const excluded = effectiveSkus.filter(s => !s.participating);

  const handleExclude = () => {
    if (excludeModal) {
      excludeSku(deal.id, excludeModal, reason || 'No reason provided');
      setExcludeModal(null);
      setReason('');
    }
  };

  const handleAddComment = () => {
    if (commentText.trim()) {
      addComment(deal.id, commentText.trim(), commentAuthor.trim() || 'User');
      setCommentText('');
    }
  };

  // Save a manual override for a SKU's deal price (persists to localStorage)
  const setDealPrice = (skuCode, value) => {
    const num = value === '' ? null : parseFloat(value);
    setDealPrices(prev => {
      const next = { ...prev };
      if (num === null || isNaN(num) || num <= 0) {
        delete next[skuCode];
      } else {
        next[skuCode] = num;
      }
      const all = loadManualOverrides();
      all[dealId] = next;
      saveManualOverrides(all);
      return next;
    });
  };

  const startEditingPrice = (skuCode, currentValue) => {
    setEditingSku(skuCode);
    setEditingValue(currentValue != null ? String(currentValue) : '');
  };
  const commitEditingPrice = () => {
    if (editingSku) {
      setDealPrice(editingSku, editingValue);
    }
    setEditingSku(null);
    setEditingValue('');
  };
  const cancelEditingPrice = () => {
    setEditingSku(null);
    setEditingValue('');
  };

  const EXCLUDE_REASONS = [
    'Low stock',
    'Low margin',
    'STR not reflecting',
    'Price issue',
    'Suppressed listing',
    'Other',
  ];

  // Build enriched SKU data by merging financials + deal dashboard data.
  // Financials are looked up via FinancialsContext (sku code first, ASIN fallback).
  // Deal price precedence: manual override → Deal Financials upload → empty.
  // No seeded default — deal prices are per-(deal, SKU) so a single per-SKU
  // default would be misleading. Empty until uploaded or manually entered.
  const enrichSku = (sku) => {
    const fin = findSku(sku.sku, sku.asin);
    const dashEntry = dealDashboardForDeal.find(d => d.asin === sku.asin);

    if (!fin && !dashEntry) return { ...sku, hasFinancials: false };

    const normalPrice = fin?.normalPrice || null;
    const cogs = fin?.cogs || 0;
    const fbaFee = fin?.fbaFee || 0;
    const tacosPct = fin?.tacosPct || 0;

    // Deal price precedence: manual override → upload → empty
    const manualPrice = typeof dealPrices[sku.sku] === 'number' ? dealPrices[sku.sku] : null;
    const dashDealPrice = dashEntry?.dealPrice || null;
    const dealPrice = manualPrice || dashDealPrice;
    const hasDealPrice = dealPrice && !isNaN(dealPrice) && dealPrice > 0;
    const dealPriceSource = manualPrice ? 'manual' : dashDealPrice ? 'upload' : null;

    // Reference price from deal dashboard
    const referencePrice = dashEntry?.referencePrice || null;

    // STR: reference price > normal price
    const strReflecting = referencePrice && normalPrice ? referencePrice > normalPrice : null;
    const strPct = referencePrice && normalPrice ? ((referencePrice - normalPrice) / normalPrice) * 100 : null;

    // Discount vs actual / STR
    const discountVsActual = normalPrice && dealPrice ? ((normalPrice - dealPrice) / normalPrice) * 100 : null;
    const discountVsSTR = referencePrice && dealPrice ? ((referencePrice - dealPrice) / referencePrice) * 100 : null;

    // Dashboard participation status
    const dashParticipating = dashEntry ? dashEntry.participating : null;
    const dashExclusionReason = dashEntry ? dashEntry.exclusionReason : '';

    return {
      ...sku,
      hasFinancials: !!fin,
      hasDashboard: !!dashEntry,
      normalPrice,
      cogs,
      fbaFee,
      // Referral fee shown in the BASE columns is computed at normal price.
      // The deal-margin columns recompute it at the deal price internally.
      referralFee: fin ? calcReferralFee(fin, normalPrice) : 0,
      referralRate: fin?.referralRate ?? 0.15,
      tacosPct,
      // Normal margins (at normal price — referral computed dynamically inside)
      grossMargin: fin ? calcGrossMargin(fin) : null,
      grossMarginPct: fin ? calcGrossMarginPct(fin) : null,
      netMargin: fin ? calcNetMargin(fin) : null,
      netMarginPct: fin ? calcNetMarginPct(fin) : null,
      // Deal data
      dealPrice: hasDealPrice ? dealPrice : null,
      dealPriceSource,
      referencePrice,
      strReflecting,
      strPct,
      discountVsActual,
      discountVsSTR,
      dashParticipating,
      dashExclusionReason,
      // Deal-price-based referral fee (this is the one that uses the lower price)
      dealReferralFee: hasDealPrice && fin ? calcReferralFee(fin, dealPrice) : null,
      // Deal margins (referral recomputed at deal price inside calc functions)
      dealGrossMargin: hasDealPrice && fin ? calcGrossMargin(fin, dealPrice) : null,
      dealGrossMarginPct: hasDealPrice && fin ? calcGrossMarginPct(fin, dealPrice) : null,
      dealNetMargin: hasDealPrice && fin ? calcNetMargin(fin, dealPrice) : null,
      dealNetMarginPct: hasDealPrice && fin ? calcNetMarginPct(fin, dealPrice) : null,
    };
  };

  const marginColor = (val) => {
    if (val < 0) return 'text-red-600';
    if (val < 15) return 'text-amber-600';
    return 'text-green-600';
  };

  const marginBadge = (val) => {
    if (val < 0) return 'bg-red-100 text-red-700';
    if (val < 15) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div>
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm cursor-pointer"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Deal Info Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-800">{deal.id}</h1>
              <ProductTag parent={deal.parent} />
              <DealTypeBadge type={deal.type} />
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                deal.marketplace === 'US' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
              }`}>
                {deal.marketplace}
              </span>
            </div>
            <p className="text-gray-500">
              {format(deal.startDate, 'MMMM d, yyyy')} &ndash; {format(deal.endDate, 'MMMM d, yyyy')}
              <span className="ml-3 text-gray-400">({deal.duration} day{deal.duration > 1 ? 's' : ''})</span>
            </p>
          </div>
          <div className="text-right">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {participating.length}
                  <span className="text-base font-normal text-gray-400">/{getTotalParentSkus(deal.parent)}</span>
                </p>
                <p className="text-xs text-gray-500">Participating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">
                  {excluded.length}
                  <span className="text-base font-normal text-gray-400">/{getTotalParentSkus(deal.parent)}</span>
                </p>
                <p className="text-xs text-gray-500">Excluded</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SKU Table - Participating */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Check size={18} className="text-green-600" />
          <h2 className="text-lg font-bold text-gray-800">Participating SKUs ({participating.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">ASIN</th>
                <th className="px-3 py-3">Normal Price</th>
                <th className="px-3 py-3">COGS</th>
                <th className="px-3 py-3">FBA</th>
                <th className="px-3 py-3">Referral</th>
                <th className="px-3 py-3">Gross Margin</th>
                <th className="px-3 py-3 bg-blue-50/50">Deal Price</th>
                <th className="px-3 py-3 bg-blue-50/50">Disc %</th>
                <th className="px-3 py-3">Ref Price</th>
                <th className="px-3 py-3">Disc vs STR</th>
                <th className="px-3 py-3">STR</th>
                <th className="px-3 py-3">STR %</th>
                <th className="px-3 py-3 bg-green-50/50">Deal GM</th>
                <th className="px-3 py-3 bg-green-50/50">Deal NM</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {participating.map((rawSku, i) => {
                const sku = enrichSku(rawSku);
                return (
                  <tr key={sku.sku} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-3 font-mono text-sm font-semibold text-gray-800">{sku.sku}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 font-mono">{sku.asin}</td>
                    {sku.hasFinancials ? (
                      <>
                        <td className="px-3 py-3 text-sm font-semibold text-gray-800">${sku.normalPrice.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">${sku.cogs.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">${sku.fbaFee.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-gray-600" title={`${((sku.referralRate ?? 0.15) * 100).toFixed(0)}% × normal price`}>
                          ${sku.referralFee.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${marginColor(sku.grossMarginPct)}`}>
                              ${sku.grossMargin.toFixed(2)}
                            </span>
                            <span className={`text-xs ${marginColor(sku.grossMarginPct)}`}>
                              {sku.grossMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        {/* Deal Price — click pencil to edit, click clock for history */}
                        <td className="px-3 py-3 bg-blue-50/30">
                          {editingSku === sku.sku ? (
                            <div className="relative flex items-center gap-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input
                                type="number" step="0.01"
                                autoFocus
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onBlur={commitEditingPrice}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEditingPrice();
                                  if (e.key === 'Escape') cancelEditingPrice();
                                }}
                                className="w-24 pl-5 pr-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                              />
                            </div>
                          ) : sku.dealPrice ? (
                            <div className="group flex items-center gap-1.5">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-blue-700">${sku.dealPrice.toFixed(2)}</span>
                                {sku.dealPriceSource === 'upload' && (
                                  <span className="text-[10px] text-blue-500 italic" title="From your Deal Financials upload">from upload</span>
                                )}
                                {sku.dealPriceSource === 'manual' && (
                                  <span className="text-[10px] text-amber-600 italic" title="Your manual override (saved in this browser)">manual</span>
                                )}
                              </div>
                              <button
                                onClick={() => startEditingPrice(sku.sku, sku.dealPrice)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity cursor-pointer p-0.5"
                                title="Edit deal price"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => setHistoryModalSku(sku.sku)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity cursor-pointer p-0.5"
                                title="View price history"
                              >
                                <Clock size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingPrice(sku.sku, '')}
                              className="text-xs text-blue-500 hover:underline cursor-pointer"
                            >
                              + add price
                            </button>
                          )}
                        </td>
                        {/* Discount vs Actual Price */}
                        <td className="px-3 py-3 bg-blue-50/30">
                          {sku.discountVsActual !== null ? (
                            <span className={`text-xs font-bold ${sku.discountVsActual > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {sku.discountVsActual.toFixed(1)}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {/* Reference Price */}
                        <td className="px-3 py-3">
                          {sku.referencePrice ? (
                            <span className="text-sm text-gray-700">${sku.referencePrice.toFixed(2)}</span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {/* Discount vs STR */}
                        <td className="px-3 py-3">
                          {sku.discountVsSTR !== null ? (
                            <span className={`text-xs font-bold ${sku.discountVsSTR > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {sku.discountVsSTR.toFixed(1)}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {/* STR Reflecting */}
                        <td className="px-3 py-3">
                          {sku.strReflecting !== null ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              sku.strReflecting ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {sku.strReflecting ? 'Yes' : 'No'}
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {/* STR % */}
                        <td className="px-3 py-3">
                          {sku.strPct !== null ? (
                            <span className={`text-xs font-bold ${sku.strPct > 0 ? 'text-green-600' : sku.strPct < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                              {sku.strPct > 0 ? '+' : ''}{sku.strPct.toFixed(1)}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {/* Deal Gross Margin */}
                        <td className="px-3 py-3 bg-green-50/30">
                          {sku.dealGrossMargin !== null ? (
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold ${marginColor(sku.dealGrossMarginPct)}`}>
                                ${sku.dealGrossMargin.toFixed(2)}
                              </span>
                              <span className={`text-xs ${marginColor(sku.dealGrossMarginPct)}`}>
                                {sku.dealGrossMarginPct.toFixed(1)}%
                              </span>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        {/* Deal Net Margin */}
                        <td className="px-3 py-3 bg-green-50/30">
                          {sku.dealNetMargin !== null ? (
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold ${marginColor(sku.dealNetMarginPct)}`}>
                                ${sku.dealNetMargin.toFixed(2)}
                              </span>
                              <span className={`text-xs ${marginColor(sku.dealNetMarginPct)}`}>
                                {sku.dealNetMarginPct.toFixed(1)}%
                              </span>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                      </>
                    ) : (
                      <td colSpan={12} className="px-3 py-3 text-center">
                        <span className="text-xs text-gray-400">
                          No financials data &mdash;{' '}
                          <button onClick={() => navigate('/financials')} className="text-blue-600 hover:underline cursor-pointer">
                            upload in Product Financials
                          </button>
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <button
                        onClick={() => { setExcludeModal(sku.sku); setReason(''); }}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        Exclude
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {participating.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-400">No participating SKUs</div>
        )}

        {/* Legend */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-6">
          <p className="text-xs text-gray-500">
            <strong>Gross Margin</strong> = Price - COGS - FBA - Referral
          </p>
          <p className="text-xs text-gray-500">
            <strong>Deal GM</strong> = Deal Price - COGS - FBA - Referral &nbsp;|&nbsp;
            <strong>Deal NM</strong> = Deal GM - (Deal Price &times; TACOS%) &nbsp;|&nbsp;
            <strong>STR</strong> = Ref Price {'>'} Normal Price
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <strong>Referral fee = Price × 15%</strong>, recalculated at the deal price for Deal GM/NM.
            {hasDealDashboard
              ? <> Deal prices auto-populated from Deal Financials upload ({dealDashboardForDeal.length} SKUs matched).</>
              : <> Deal prices come from a <a href="#/deal-financials" className="text-blue-600 hover:underline">Deal Financials</a> upload (per-deal pricing). Until uploaded, click <strong>+ add price</strong> on a row to enter manually.</>
            }
          </p>
        </div>
      </div>

      {/* SKU Table - Excluded */}
      {excluded.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="text-lg font-bold text-gray-800">Excluded SKUs ({excluded.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3">ASIN</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {excluded.map((sku, i) => (
                <tr key={sku.sku} className={`${i % 2 === 0 ? 'bg-red-50/30' : 'bg-red-50/50'}`}>
                  <td className="px-6 py-3.5 font-mono text-sm font-semibold text-gray-800">{sku.sku}</td>
                  <td className="px-6 py-3.5 text-sm text-gray-500 font-mono">{sku.asin}</td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      <X size={12} /> {sku.excludeReason}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => includeSku(deal.id, sku.sku)}
                      className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors cursor-pointer"
                    >
                      Re-include
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-500" />
          <h2 className="text-lg font-bold text-gray-800">Comments ({deal.comments.length})</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {deal.comments.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-400">
              No comments yet. Add one below.
            </div>
          )}
          {deal.comments.map(comment => (
            <div key={comment.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      {comment.author.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{comment.author}</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(comment.timestamp), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 ml-9">{comment.text}</p>
                </div>
                <button
                  onClick={() => deleteComment(deal.id, comment.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Your name"
              value={commentAuthor}
              onChange={e => setCommentAuthor(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={14} /> Post
            </button>
          </div>
        </div>
      </div>

      {/* Price History Modal */}
      {historyModalSku && (() => {
        // Find this SKU's matching financials record so we can show variant + ASIN context
        const skuRow = effectiveSkus.find(s => s.sku === historyModalSku);
        const fin = skuRow ? findSku(skuRow.sku, skuRow.asin) : null;
        const asinForLookup = skuRow?.asin;
        // History pulls from ALL uploaded deal-dashboard records, not just this deal
        const history = dealDashboardData
          .filter(d => d.asin === asinForLookup && d.dealPrice && d.dealPrice > 0)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        // Group by dealId+date to dedupe duplicate same-day uploads
        const byKey = new Map();
        history.forEach(h => {
          const key = `${h.dealId || h.dateStr}-${h.dateStr}`;
          if (!byKey.has(key)) byKey.set(key, h);
        });
        const uniqueHistory = Array.from(byKey.values());

        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setHistoryModalSku(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-blue-500" />
                    <h2 className="text-lg font-bold text-gray-800">Deal Price History</h2>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-mono font-semibold">{historyModalSku}</span>
                    {skuRow?.variant && <span> · {skuRow.variant}</span>}
                    {asinForLookup && <span> · {asinForLookup}</span>}
                  </p>
                </div>
                <button
                  onClick={() => setHistoryModalSku(null)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {uniqueHistory.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    <p className="text-base">No deal price history yet.</p>
                    <p className="text-sm mt-1">
                      Upload a Deal Financials CSV at <a href="#/deal-financials" className="text-blue-600 hover:underline">/deal-financials</a> to start building history.
                    </p>
                    {fin?.defaultDealPrice && (
                      <p className="text-xs mt-3 text-gray-500">
                        Seeded default for this SKU: <strong>${fin.defaultDealPrice.toFixed(2)}</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Deal ID</th>
                        <th className="px-6 py-3">Deal Price</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueHistory.map((h, i) => (
                        <tr key={`${h.dealId}-${h.dateStr}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-6 py-3 text-sm text-gray-700">{format(new Date(h.date), 'MMM d, yyyy')}</td>
                          <td className="px-6 py-3 text-sm font-bold text-gray-800">{h.dealId || '—'}</td>
                          <td className="px-6 py-3 text-sm font-semibold text-blue-700">${h.dealPrice.toFixed(2)}</td>
                          <td className="px-6 py-3">
                            {h.participating ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Active</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold" title={h.exclusionReason || ''}>
                                Excluded
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Exclude Modal */}
      {excludeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Exclude SKU</h3>
            <p className="text-sm text-gray-600 mb-4">
              Excluding <strong>{excludeModal}</strong> from {deal.id}. Select a reason:
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {EXCLUDE_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    reason === r
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type a custom reason..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setExcludeModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExclude}
                disabled={!reason}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 cursor-pointer"
              >
                Exclude SKU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
