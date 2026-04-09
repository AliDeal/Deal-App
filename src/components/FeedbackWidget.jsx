import { useState, useRef, useEffect } from 'react';
import { Plus, X, MessageSquare, Check } from 'lucide-react';
import { format } from 'date-fns';

export default function FeedbackWidget() {
  const [mode, setMode] = useState('idle'); // 'idle', 'placing', 'typing', 'viewing'
  const [text, setText] = useState('');
  const [clickPos, setClickPos] = useState(null);
  const textareaRef = useRef(null);
  const [feedbacks, setFeedbacks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dealapp-feedback') || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    if (mode === 'typing' && textareaRef.current) textareaRef.current.focus();
  }, [mode]);

  // Listen for clicks on the page when in placing mode
  useEffect(() => {
    if (mode !== 'placing') return;
    const handleClick = (e) => {
      // Ignore clicks on the widget itself
      if (e.target.closest('[data-feedback-widget]')) return;
      e.preventDefault();
      e.stopPropagation();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      setClickPos({ x: e.clientX, y: e.clientY, pageX: e.clientX + scrollX, pageY: e.clientY + scrollY });
      setMode('typing');
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [mode]);

  // Change cursor when placing
  useEffect(() => {
    if (mode === 'placing') {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = '';
    }
    return () => { document.body.style.cursor = ''; };
  }, [mode]);

  const save = (list) => {
    setFeedbacks(list);
    localStorage.setItem('dealapp-feedback', JSON.stringify(list));
  };

  const handleSubmit = () => {
    if (!text.trim() || !clickPos) return;
    save([{
      id: Date.now(),
      text: text.trim(),
      x: clickPos.pageX,
      y: clickPos.pageY,
      page: window.location.hash || window.location.pathname,
      timestamp: new Date().toISOString(),
      resolved: false,
    }, ...feedbacks]);
    setText('');
    setClickPos(null);
    setMode('idle');
  };

  const handleCancel = () => {
    setText('');
    setClickPos(null);
    setMode('idle');
  };

  const toggleResolve = (id) => {
    save(feedbacks.map(f => f.id === id ? { ...f, resolved: !f.resolved } : f));
  };

  const handleDelete = (id) => {
    save(feedbacks.filter(f => f.id !== id));
  };

  const unresolvedCount = feedbacks.filter(f => !f.resolved).length;

  const handleButtonClick = () => {
    if (mode === 'idle') {
      setMode('placing');
    } else if (mode === 'placing') {
      setMode('idle');
    } else if (mode === 'typing') {
      handleCancel();
    } else if (mode === 'viewing') {
      setMode('idle');
    }
  };

  const toggleViewing = () => {
    setMode(mode === 'viewing' ? 'idle' : 'viewing');
  };

  return (
    <div data-feedback-widget>
      {/* Main + button */}
      <button
        onClick={handleButtonClick}
        className={`fixed top-4 right-16 z-50 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all cursor-pointer ${
          mode === 'placing'
            ? 'bg-blue-600 hover:bg-blue-700 animate-pulse'
            : mode === 'typing'
            ? 'bg-gray-600 hover:bg-gray-700'
            : 'bg-brand-orange hover:bg-orange-600'
        }`}
        title={mode === 'placing' ? 'Click anywhere to place comment' : 'Add comment'}
      >
        {mode === 'typing' || mode === 'viewing'
          ? <X size={16} className="text-white" />
          : <Plus size={18} className="text-white" />
        }
      </button>

      {/* Placement hint */}
      {mode === 'placing' && (
        <div className="fixed top-14 right-16 z-50 bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
          Click anywhere on the page to place your comment
        </div>
      )}

      {/* View comments button (only when comments exist) */}
      {feedbacks.length > 0 && mode !== 'typing' && (
        <button
          onClick={toggleViewing}
          className={`fixed top-4 right-28 z-50 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all cursor-pointer ${
            mode === 'viewing' ? 'bg-gray-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
          title="View comments"
        >
          <MessageSquare size={14} className="text-white" />
        </button>
      )}

      {/* Comment count badge */}
      {unresolvedCount > 0 && mode !== 'viewing' && (
        <span className="fixed top-2 right-26 z-50 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full pointer-events-none">
          {unresolvedCount}
        </span>
      )}

      {/* Comment input popover at click position */}
      {mode === 'typing' && clickPos && (
        <div
          className="fixed z-50 w-72 bg-white rounded-xl shadow-xl border border-gray-200"
          style={{ left: Math.min(clickPos.x, window.innerWidth - 300), top: Math.min(clickPos.y + 10, window.innerHeight - 180) }}
        >
          {/* Pin indicator */}
          <div className="absolute -top-2 left-4 w-4 h-4 bg-brand-orange rounded-full border-2 border-white shadow" />
          <div className="p-3">
            <textarea
              ref={textareaRef}
              placeholder="Leave a comment..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={handleCancel} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-40 cursor-pointer"
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments panel */}
      {mode === 'viewing' && (
        <div className="fixed top-14 right-16 z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 max-h-[70vh] flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Comments ({feedbacks.length})</h3>
            <p className="text-[10px] text-gray-400">{unresolvedCount} unresolved</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {feedbacks.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No comments yet</div>
            )}
            {feedbacks.map(fb => (
              <div key={fb.id} className={`px-4 py-3 ${fb.resolved ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${fb.resolved ? 'line-through text-gray-400' : 'text-gray-700'}`}>{fb.text}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {format(new Date(fb.timestamp), 'MMM d, h:mm a')} &middot; {fb.page}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleResolve(fb.id)}
                      className={`w-6 h-6 flex items-center justify-center rounded-full cursor-pointer ${
                        fb.resolved
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={fb.resolved ? 'Reopen' : 'Mark as resolved'}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(fb.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 cursor-pointer"
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
