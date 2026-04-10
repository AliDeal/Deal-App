import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import { PRODUCTS, DEAL_TYPES, getTotalParentSkus } from '../data/deals';
import ProductTag from '../components/ProductTag';
import DealTypeBadge from '../components/DealTypeBadge';
import { format } from 'date-fns';
import { Filter, Search } from 'lucide-react';

export default function DealCalendar() {
  const { deals } = useDeals();
  const navigate = useNavigate();
  const [productFilter, setProductFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = deals.filter(d => {
    if (productFilter !== 'ALL' && d.parent !== productFilter) return false;
    if (typeFilter !== 'ALL' && d.type !== typeFilter) return false;
    if (search && !d.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by month
  const grouped = {};
  filtered.forEach(d => {
    const key = format(d.startDate, 'MMMM yyyy');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Deal Calendar</h1>
        <p className="text-gray-500 mt-1">Schedule and timeline of all deals</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Filters:</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setProductFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                productFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Products
            </button>
            {Object.entries(PRODUCTS).map(([key, prod]) => (
              <button
                key={key}
                onClick={() => setProductFilter(key)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: productFilter === key ? prod.color : prod.color + '15',
                  color: productFilter === key ? '#fff' : prod.color,
                }}
              >
                {prod.shortName}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <div className="flex gap-2">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('LD')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                typeFilter === 'LD' ? 'bg-brand-orange text-white' : 'bg-orange-50 text-brand-orange hover:bg-orange-100'
              }`}
            >
              Lightning Deal
            </button>
            <button
              onClick={() => setTypeFilter('BD')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                typeFilter === 'BD' ? 'bg-brand-blue text-white' : 'bg-blue-50 text-brand-blue hover:bg-blue-100'
              }`}
            >
              Best Deal
            </button>
          </div>

          <div className="ml-auto relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search deal ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        Showing {filtered.length} of {deals.length} deals
      </p>

      {/* Grouped by month */}
      {Object.entries(grouped).map(([month, monthDeals]) => (
        <div key={month} className="mb-8">
          <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-orange" />
            {month}
            <span className="text-sm font-normal text-gray-400">({monthDeals.length} deals)</span>
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Deal ID</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Start</th>
                  <th className="px-6 py-3">End</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">SKUs</th>
                </tr>
              </thead>
              <tbody>
                {monthDeals.map((deal, i) => {
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
                      <td className="px-6 py-3.5"><ProductTag parent={deal.parent} /></td>
                      <td className="px-6 py-3.5"><DealTypeBadge type={deal.type} /></td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{format(deal.startDate, 'MMM d')}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{format(deal.endDate, 'MMM d')}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{deal.duration} day{deal.duration > 1 ? 's' : ''}</td>
                      <td className="px-6 py-3.5">
                        <span className="text-sm font-medium text-green-600">{participating}</span>
                        <span className="text-sm text-gray-400">/{getTotalParentSkus(deal.parent)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
