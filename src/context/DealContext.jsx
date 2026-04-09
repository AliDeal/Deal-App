import { createContext, useContext, useState } from 'react';
import { deals as initialDeals } from '../data/deals';

const DealContext = createContext();

export function DealProvider({ children }) {
  const [deals, setDeals] = useState(initialDeals);

  const updateSkuStatus = (dealId, skuId, updates) => {
    setDeals(prev => prev.map(deal => {
      if (deal.id !== dealId) return deal;
      return {
        ...deal,
        skus: deal.skus.map(s => s.sku === skuId ? { ...s, ...updates } : s),
      };
    }));
  };

  const excludeSku = (dealId, skuId, reason) => {
    updateSkuStatus(dealId, skuId, { participating: false, excludeReason: reason });
  };

  const includeSku = (dealId, skuId) => {
    updateSkuStatus(dealId, skuId, { participating: true, excludeReason: '' });
  };

  const addComment = (dealId, text, author = 'User') => {
    setDeals(prev => prev.map(deal => {
      if (deal.id !== dealId) return deal;
      return {
        ...deal,
        comments: [
          ...deal.comments,
          { id: Date.now(), text, author, timestamp: new Date().toISOString() },
        ],
      };
    }));
  };

  const deleteComment = (dealId, commentId) => {
    setDeals(prev => prev.map(deal => {
      if (deal.id !== dealId) return deal;
      return {
        ...deal,
        comments: deal.comments.filter(c => c.id !== commentId),
      };
    }));
  };

  return (
    <DealContext.Provider value={{
      deals, setDeals, updateSkuStatus, excludeSku, includeSku, addComment, deleteComment,
    }}>
      {children}
    </DealContext.Provider>
  );
}

export function useDeals() {
  return useContext(DealContext);
}
