import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import { getDealStats, PRODUCTS, MARKETPLACES } from '../data/deals';
import ProductTag from '../components/ProductTag';
import DealTypeBadge from '../components/DealTypeBadge';
import { format } from 'date-fns';
import { Filter, Globe, Calendar, Tag, Package } from 'lucide-react';

export default function Dashboard() {
  const { deals } = useDeals();
  const navigate = useNavigate();

  // Filter state
  const [marketplace, setMarketplace] = useState('ALL');
  const [dealType, setDealType] = useState('ALL');
  const [product, setProduct] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Apply filters
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
  });

  const stats = getDealStats(filtered);
  const today = new Date();
  const activeDeals = filtered.filter(d => d.startDate <= today && d.endDate >= today);
  const hasFilters = marketplace !== 'ALL' || dealType !== 'ALL' || product !== 'ALL' || startDate || endDate;

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
              <select
                value={product}
                onChange={e => setProduct(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                style={product !== 'ALL' ? { borderColor: PRODUCTS[product]?.color, color: PRODUCTS[product]?.color } : {}}
              >
                <option value="ALL">All Products</option>
                {Object.entries(PRODUCTS).map(([key, prod]) => (
                  <option key={key} value={key}>{prod.shortName} - {prod.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <div className="bg-white rounded-xl p-5 border-t-4 border-brand-orange shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Deals</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.ld} LD &middot; {stats.bd} BD</p>
          <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            {hasFilters ? 'Filtered' : 'Active tracking'}
          </span>
        </div>
        <div className="bg-white rounded-xl p-5 border-t-4 border-brand-green shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total SKUs</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.totalSkus}</p>
          <p className="text-sm text-gray-500 mt-1">Across {stats.products} products</p>
        </div>
        <div className="bg-white rounded-xl p-5 border-t-4 border-brand-red shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Excluded SKUs</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.excludedSkus}</p>
          <p className="text-sm text-gray-500 mt-1">Across all deals</p>
        </div>
        <div className="bg-white rounded-xl p-5 border-t-4 border-brand-blue shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Now</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{activeDeals.length}</p>
          <p className="text-sm text-gray-500 mt-1">Running deals</p>
        </div>
      </div>

      {/* Active Deals Banner */}
      {activeDeals.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-800">
            {activeDeals.length} Active Deal{activeDeals.length > 1 ? 's' : ''} Right Now
          </h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {activeDeals.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/deal/${d.id}`)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors cursor-pointer"
              >
                {d.id} - {d.product?.name} ({d.typeName})
              </button>
            ))}
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
                    <span className="text-sm text-gray-400">/{deal.skus.length}</span>
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
