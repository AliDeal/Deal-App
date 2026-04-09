import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const [feedbacks, setFeedbacks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dealapp-feedback') || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
  }, [open]);

  const save = (list) => {
    setFeedbacks(list);
    localStorage.setItem('dealapp-feedback', JSON.stringify(list));
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    save([{
      id: Date.now(),
      text: text.trim(),
      page: window.location.pathname,
      timestamp: new Date().toISOString(),
    }, ...feedbacks]);
    setText('');
    setOpen(false);
  };

  const handleDelete = (id) => {
    save(feedbacks.filter(f => f.id !== id));
  };

  return (
    <>
      {/* Floating + button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-4 right-16 z-50 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all cursor-pointer ${
          open
            ? 'bg-gray-600 hover:bg-gray-700'
            : 'bg-brand-orange hover:bg-orange-600'
        }`}
        title="Leave a comment"
      >
        {open
          ? <X size={16} className="text-white" />
          : <Plus size={18} className="text-white" />
        }
      </button>

      {/* Comment popover */}
      {open && (
        <div className="fixed top-14 right-16 z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200">
          <div className="p-4">
            <textarea
              ref={textareaRef}
              placeholder="Leave a comment..."
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => { setOpen(false); setText(''); }}
                className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-40 font-medium cursor-pointer"
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show comment count badge */}
      {feedbacks.length > 0 && !open && (
        <span className="fixed top-2 right-14 z-50 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full pointer-events-none">
          {feedbacks.length}
        </span>
      )}
    </>
  );
}
