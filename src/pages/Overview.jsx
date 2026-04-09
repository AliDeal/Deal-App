import { useState } from 'react';
import { useDeals } from '../context/DealContext';
import { PRODUCTS, DEAL_TYPES } from '../data/deals';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { X, Calendar } from 'lucide-react';

export default function Overview() {
  const { deals } = useDeals();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // { product, type, deals }

  const today = new Date();

  // Group deals by product
  const byProduct = {};
  Object.keys(PRODUCTS).forEach(key => { byProduct[key] = []; });
  deals.forEach(d => {
    if (byProduct[d.parent]) byProduct[d.parent].push(d);
  });

  const openDealList = (productKey, type) => {
    const filtered = byProduct[productKey].filter(d => d.type === type);
    if (filtered.length === 0) return;
    // Group by month
    const grouped = {};
    filtered.forEach(d => {
      const monthKey = format(d.startDate, 'MMMM yyyy');
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(d);
    });
    setModal({
      product: PRODUCTS[productKey],
      productKey,
      typeName: DEAL_TYPES[type]?.name || type,
      typeColor: DEAL_TYPES[type]?.color || '#888',
      grouped,
      total: filtered.length,
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Overview</h1>
        <p className="text-gray-500 mt-1">Deal breakdown by product</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(byProduct).map(([key, productDeals]) => {
          const product = PRODUCTS[key];
          const ldCount = productDeals.filter(d => d.type === 'LD').length;
          const bdCount = productDeals.filter(d => d.type === 'BD').length;
          const totalSkus = productDeals.reduce((sum, d) => sum + d.skus.length, 0);
          const excludedSkus = productDeals.reduce((sum, d) => sum + d.skus.filter(s => !s.participating).length, 0);
          const nextDeal = productDeals
            .filter(d => d.startDate > today)
            .sort((a, b) => a.startDate - b.startDate)[0];
          const daysUntilNext = nextDeal ? differenceInDays(nextDeal.startDate, today) : null;

          return (
            <div key={key} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-1" style={{ backgroundColor: product.color }} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: product.color }}
                  >
                    {productDeals.length} deals
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => openDealList(key, 'LD')}
                    className={`bg-orange-50 rounded-lg p-3 text-center transition-all cursor-pointer ${
                      ldCount > 0 ? 'hover:bg-orange-100 hover:shadow-sm' : 'opacity-60'
                    }`}
                    disabled={ldCount === 0}
                  >
                    <p className="text-xl font-bold text-brand-orange">{ldCount}</p>
                    <p className="text-xs text-gray-500">Lightning</p>
                  </button>
                  <button
                    onClick={() => openDealList(key, 'BD')}
                    className={`bg-blue-50 rounded-lg p-3 text-center transition-all cursor-pointer ${
                      bdCount > 0 ? 'hover:bg-blue-100 hover:shadow-sm' : 'opacity-60'
                    }`}
                    disabled={bdCount === 0}
                  >
                    <p className="text-xl font-bold text-brand-blue">{bdCount}</p>
                    <p className="text-xs text-gray-500">Best Deal</p>
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Total SKUs in deals</span>
                    <span className="font-semibold">{totalSkus}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Excluded SKUs</span>
                    <span className="font-semibold text-red-500">{excludedSkus}</span>
                  </div>
                </div>

                {nextDeal && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Next deal</p>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => navigate(`/deal/${nextDeal.id}`)}
                        className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        {nextDeal.id} &mdash; {format(nextDeal.startDate, 'MMM d')}
                      </button>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        daysUntilNext <= 3 ? 'bg-red-100 text-red-700' :
                        daysUntilNext <= 7 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {daysUntilNext === 0 ? 'Today' :
                         daysUntilNext === 1 ? '1 day until deal' :
                         `${daysUntilNext} days until deal`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal List Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: modal.product.color }}
                >
                  {modal.product.shortName}
                </span>
                <h3 className="text-lg font-bold text-gray-800">
                  {modal.typeName}
                </h3>
                <span className="text-sm text-gray-400">({modal.total} deals)</span>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Deal list grouped by month */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {Object.entries(modal.grouped).map(([month, monthDeals]) => (
                <div key={month} className="mb-5 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={14} className="text-gray-400" />
                    <h4 className="text-sm font-bold text-gray-700">{month}</h4>
                    <span className="text-xs text-gray-400">({monthDeals.length})</span>
                  </div>
                  <div className="space-y-2 ml-5">
                    {monthDeals.map(deal => {
                      const isPast = deal.endDate < today;
                      const isActive = deal.startDate <= today && deal.endDate >= today;
                      return (
                        <button
                          key={deal.id}
                          onClick={() => { setModal(null); navigate(`/deal/${deal.id}`); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-blue-600">{deal.id}</span>
                            <span className="text-sm text-gray-600">
                              {format(deal.startDate, 'MMM d')}
                              {deal.duration > 1 && ` – ${format(deal.endDate, 'MMM d')}`}
                            </span>
                            {deal.duration > 1 && (
                              <span className="text-xs text-gray-400">({deal.duration} days)</span>
                            )}
                          </div>
                          <div>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                Active
                              </span>
                            )}
                            {isPast && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">
                                Completed
                              </span>
                            )}
                            {!isPast && !isActive && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
