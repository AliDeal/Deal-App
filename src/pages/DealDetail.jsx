import { useParams, useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import { useFinancials, calcGrossMargin, calcGrossMarginPct, calcNetMargin, calcNetMarginPct } from '../context/FinancialsContext';
import ProductTag from '../components/ProductTag';
import DealTypeBadge from '../components/DealTypeBadge';
import { format } from 'date-fns';
import { ArrowLeft, Check, X, AlertTriangle, MessageSquare, Send, Trash2, ArrowRightLeft } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function DealDetail() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const { deals, excludeSku, includeSku, updateSkuStatus, addComment, deleteComment } = useDeals();
  const { financials, getSkuFinancials } = useFinancials();
  const deal = deals.find(d => d.id === dealId);
  const [excludeModal, setExcludeModal] = useState(null);
  const [reason, setReason] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  // Deal price overrides per SKU (local state, keyed by sku id)
  const [dealPrices, setDealPrices] = useState({});

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

  const participating = deal.skus.filter(s => s.participating);
  const excluded = deal.skus.filter(s => !s.participating);

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

  const setDealPrice = (sku, value) => {
    setDealPrices(prev => ({ ...prev, [sku]: value }));
  };

  const EXCLUDE_REASONS = [
    'Low stock',
    'Low margin',
    'STR not reflecting',
    'Price issue',
    'Suppressed listing',
    'Other',
  ];

  // Build enriched SKU data by merging financials + deal dashboard data
  const enrichSku = (sku) => {
    // Get product financials (COGS, FBA, Referral, etc.)
    const fin = getSkuFinancials(sku.sku);
    // Find matching deal dashboard entry by ASIN
    const dashEntry = dealDashboardForDeal.find(d => d.asin === sku.asin);

    if (!fin && !dashEntry) return { ...sku, hasFinancials: false };

    const normalPrice = fin?.normalPrice || null;
    const cogs = fin?.cogs || 0;
    const fbaFee = fin?.fbaFee || 0;
    const referralFee = fin?.referralFee || 0;
    const tacosPct = fin?.tacosPct || 0;

    // Deal price: from dashboard data first, then manual override
    const manualPriceStr = dealPrices[sku.sku];
    const manualPrice = manualPriceStr ? parseFloat(manualPriceStr) : null;
    const dashDealPrice = dashEntry?.dealPrice || null;
    const dealPrice = manualPrice || dashDealPrice;
    const hasDealPrice = dealPrice && !isNaN(dealPrice) && dealPrice > 0;

    // Reference price from deal dashboard
    const referencePrice = dashEntry?.referencePrice || null;

    // STR: reference price > normal price
    const strReflecting = referencePrice && normalPrice ? referencePrice > normalPrice : null;
    const strPct = referencePrice && normalPrice ? ((referencePrice - normalPrice) / normalPrice) * 100 : null;

    // Discount vs actual price
    const discountVsActual = normalPrice && dealPrice ? ((normalPrice - dealPrice) / normalPrice) * 100 : null;

    // Discount vs STR
    const discountVsSTR = referencePrice && dealPrice ? ((referencePrice - dealPrice) / referencePrice) * 100 : null;

    // Dashboard participation status
    const dashParticipating = dashEntry ? dashEntry.participating : null;
    const dashExclusionReason = dashEntry ? dashEntry.exclusionReason : '';

    const finObj = fin || { normalPrice: normalPrice, cogs, fbaFee, referralFee, tacosPct };

    return {
      ...sku,
      hasFinancials: !!fin,
      hasDashboard: !!dashEntry,
      normalPrice,
      cogs,
      fbaFee,
      referralFee,
      tacosPct,
      // Normal margins
      grossMargin: fin ? calcGrossMargin(fin) : null,
      grossMarginPct: fin ? calcGrossMarginPct(fin) : null,
      netMargin: fin ? calcNetMargin(fin) : null,
      netMarginPct: fin ? calcNetMarginPct(fin) : null,
      // Deal data from dashboard
      dealPrice: hasDealPrice ? dealPrice : null,
      referencePrice,
      strReflecting,
      strPct,
      discountVsActual,
      discountVsSTR,
      dashParticipating,
      dashExclusionReason,
      // Deal margins (using deal price)
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
                <p className="text-2xl font-bold text-green-600">{participating.length}</p>
                <p className="text-xs text-gray-500">Participating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{excluded.length}</p>
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
                        <td className="px-3 py-3 text-sm text-gray-600">${sku.referralFee.toFixed(2)}</td>
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
                        {/* Deal Price - auto from dashboard or manual input */}
                        <td className="px-3 py-3 bg-blue-50/30">
                          {sku.dealPrice ? (
                            <span className="text-sm font-semibold text-blue-700">${sku.dealPrice.toFixed(2)}</span>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input
                                type="number" step="0.01"
                                placeholder={sku.normalPrice?.toFixed(2) || '—'}
                                value={dealPrices[sku.sku] || ''}
                                onChange={e => setDealPrice(sku.sku, e.target.value)}
                                className="w-24 pl-5 pr-2 py-1 border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                              />
                            </div>
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
          {hasDealDashboard && (
            <p className="text-xs text-blue-600 mt-1">Deal prices auto-populated from Deal Financials upload ({dealDashboardForDeal.length} SKUs matched)</p>
          )}
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
