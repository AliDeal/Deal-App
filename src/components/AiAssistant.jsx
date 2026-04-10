import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useDeals } from '../context/DealContext';
import { useFinancials, calcGrossMargin, calcGrossMarginPct } from '../context/FinancialsContext';
import { PRODUCTS, DEAL_TYPES } from '../data/deals';
import { format } from 'date-fns';

function generateResponse(query, deals, findSku) {
  const q = query.toLowerCase();

  // Active / current deals
  if (q.includes('active') || q.includes('running') || q.includes('current deal')) {
    const today = new Date();
    const active = deals.filter(d => d.startDate <= today && d.endDate >= today);
    if (active.length === 0) return 'There are no active deals running right now.';
    const lines = active.map(d =>
      `  - **${d.id}** — ${PRODUCTS[d.parent]?.name} (${DEAL_TYPES[d.type]?.name}), ends ${format(d.endDate, 'MMM d')}`
    );
    return `There ${active.length === 1 ? 'is' : 'are'} **${active.length}** active deal${active.length > 1 ? 's' : ''} right now:\n${lines.join('\n')}`;
  }

  // Next / upcoming deals
  if (q.includes('next') || q.includes('upcoming') || q.includes('soon')) {
    const today = new Date();
    const upcoming = deals.filter(d => d.startDate > today).sort((a, b) => a.startDate - b.startDate).slice(0, 5);
    if (upcoming.length === 0) return 'No upcoming deals scheduled.';
    const lines = upcoming.map(d =>
      `  - **${d.id}** — ${PRODUCTS[d.parent]?.name} (${DEAL_TYPES[d.type]?.name}) on ${format(d.startDate, 'MMM d')}`
    );
    return `Next ${upcoming.length} upcoming deals:\n${lines.join('\n')}`;
  }

  // Product-specific queries
  const productMatch = Object.entries(PRODUCTS).find(([key, p]) =>
    q.includes(key.toLowerCase()) || q.includes(p.name.toLowerCase())
  );
  if (productMatch) {
    const [key, prod] = productMatch;
    const productDeals = deals.filter(d => d.parent === key);
    const ld = productDeals.filter(d => d.type === 'LD').length;
    const bd = productDeals.filter(d => d.type === 'BD').length;
    const totalSkus = productDeals.reduce((s, d) => s + d.skus.length, 0);
    const excluded = productDeals.reduce((s, d) => s + d.skus.filter(sk => !sk.participating).length, 0);
    return `**${prod.name} (${key})** has **${productDeals.length}** deals total:\n  - ${ld} Lightning Deals\n  - ${bd} Best Deals\n  - ${totalSkus} total SKUs across deals\n  - ${excluded} excluded SKUs`;
  }

  // Excluded SKUs
  if (q.includes('excluded') || q.includes('exclude')) {
    const allExcluded = [];
    deals.forEach(d => d.skus.filter(s => !s.participating).forEach(s => allExcluded.push({ deal: d, sku: s })));
    if (allExcluded.length === 0) return 'No SKUs are currently excluded from any deals.';
    const lines = allExcluded.slice(0, 8).map(({ deal, sku }) =>
      `  - **${sku.sku}** from ${deal.id} — Reason: ${sku.excludeReason}`
    );
    return `There are **${allExcluded.length}** excluded SKUs:\n${lines.join('\n')}${allExcluded.length > 8 ? `\n  - ...and ${allExcluded.length - 8} more` : ''}`;
  }

  // Margin queries (computed at normal price — deal-price margins require an
  // upload to be present, which we don't read here for simplicity).
  if (q.includes('margin') || q.includes('profit')) {
    const margins = [];
    deals.forEach(d => d.skus.filter(s => s.participating).forEach(s => {
      const fin = findSku(s.sku, s.asin);
      if (!fin) return;
      const margin = calcGrossMargin(fin);
      const pct = calcGrossMarginPct(fin);
      margins.push({ sku: s.sku, margin, pct, deal: d.id });
    }));
    const negative = margins.filter(m => m.margin < 0);
    const low = margins.filter(m => m.pct >= 0 && m.pct < 15);
    const avgPct = margins.length > 0 ? margins.reduce((s, m) => s + m.pct, 0) / margins.length : 0;
    let resp = `**Margin Summary:**\n  - Average margin: **${avgPct.toFixed(1)}%**\n  - ${negative.length} SKUs with negative margin\n  - ${low.length} SKUs with low margin (< 15%)`;
    if (negative.length > 0) {
      resp += '\n\n**Negative margin SKUs:**';
      negative.slice(0, 5).forEach(m => { resp += `\n  - ${m.sku} in ${m.deal}: $${m.margin.toFixed(2)} (${m.pct.toFixed(1)}%)`; });
    }
    return resp;
  }

  // Lightning vs Best deal
  if (q.includes('lightning') || q.includes('best deal') || q.includes('type')) {
    const ld = deals.filter(d => d.type === 'LD');
    const bd = deals.filter(d => d.type === 'BD');
    return `**Deal Type Breakdown:**\n  - **${ld.length}** Lightning Deals\n  - **${bd.length}** Best Deals\n  - Total: **${deals.length}** deals`;
  }

  // Summary / overview
  if (q.includes('summary') || q.includes('overview') || q.includes('how many') || q.includes('total')) {
    const products = new Set(deals.map(d => d.parent));
    const totalSkus = deals.reduce((s, d) => s + d.skus.length, 0);
    return `**Deal Tracker Summary:**\n  - **${deals.length}** total deals\n  - **${products.size}** products\n  - **${totalSkus}** total SKUs\n  - Date range: ${format(deals[0].startDate, 'MMM d, yyyy')} to ${format(deals[deals.length - 1].endDate, 'MMM d, yyyy')}`;
  }

  // Help
  if (q.includes('help') || q.includes('what can you')) {
    return `I can help you with:\n  - **"What are the active deals?"**\n  - **"Show upcoming deals"**\n  - **"Tell me about B4"** (or any product)\n  - **"Show excluded SKUs"**\n  - **"Margin summary"**\n  - **"Deal type breakdown"**\n  - **"Overall summary"**\n\nJust ask me anything about your deals!`;
  }

  return `I can answer questions about your deals, products, margins, and excluded SKUs. Try asking:\n  - "What deals are active?"\n  - "Tell me about B6"\n  - "Show margin summary"\n  - "What's upcoming?"\n\nType **help** for more options.`;
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I\'m your Deal Assistant. Ask me anything about your deals, products, margins, or SKUs.' },
  ]);
  const { deals } = useDeals();
  const { findSku } = useFinancials();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    // Simulate brief typing delay
    setTimeout(() => {
      const response = generateResponse(userMsg, deals, findSku);
      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    }, 400);
  };

  // Simple markdown-like bold rendering
  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
          {parts.map((part, j) =>
            j % 2 === 1
              ? <strong key={j} className="font-semibold">{part}</strong>
              : <span key={j}>{part}</span>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* AI Button - top right, next to comment button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all cursor-pointer ${
          open ? 'bg-purple-700 hover:bg-purple-800' : 'bg-purple-600 hover:bg-purple-700'
        }`}
        title="AI Assistant"
      >
        {open
          ? <X size={16} className="text-white" />
          : <Sparkles size={16} className="text-white" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed top-14 right-4 z-50 w-96 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col" style={{ height: '480px' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Deal Assistant</h3>
                <p className="text-xs text-purple-200">Ask about deals, margins, SKUs</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                }`}>
                  {renderText(msg.text)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Ask something..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 cursor-pointer"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
