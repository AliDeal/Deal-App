import { Construction } from 'lucide-react';

export default function Placeholder({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-96">
      <Construction size={48} className="text-gray-300 mb-4" />
      <h2 className="text-2xl font-bold text-gray-400">{title}</h2>
      <p className="text-gray-400 mt-2">This section is coming soon</p>
    </div>
  );
}
