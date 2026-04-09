import { DEAL_TYPES } from '../data/deals';

export default function DealTypeBadge({ type }) {
  const dt = DEAL_TYPES[type];
  const name = dt?.name || type;
  const color = dt?.color || '#888';
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: color + '20', color }}
    >
      {name}
    </span>
  );
}
