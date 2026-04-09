import { useNavigate } from 'react-router-dom';
import { useDeals } from '../context/DealContext';
import ProductTag from '../components/ProductTag';
import { X } from 'lucide-react';

export default function ExcludedSkus() {
  const { deals, includeSku } = useDeals();
  const navigate = useNavigate();

  const excluded = [];
  deals.forEach(deal => {
    deal.skus.filter(s => !s.participating).forEach(sku => {
      excluded.push({ deal, sku });
    });
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Excluded SKUs</h1>
        <p className="text-gray-500 mt-1">All SKUs excluded from deals across all products</p>
      </div>

      {excluded.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400 text-lg">No excluded SKUs</p>
          <p className="text-gray-400 text-sm mt-1">All SKUs are currently participating in their deals</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">Deal</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {excluded.map(({ deal, sku }, i) => (
                <tr key={`${deal.id}-${sku.sku}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => navigate(`/deal/${deal.id}`)}
                      className="font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {deal.id}
                    </button>
                  </td>
                  <td className="px-6 py-3.5"><ProductTag parent={deal.parent} /></td>
                  <td className="px-6 py-3.5 font-mono text-sm font-semibold">{sku.sku}</td>
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
    </div>
  );
}
