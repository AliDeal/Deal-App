import { PRODUCTS } from '../data/deals';

export default function ProductTag({ parent }) {
  const product = PRODUCTS[parent];
  if (!product) return <span className="text-sm text-gray-500">{parent}</span>;
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: product.color }}
    >
      {product.shortName}
    </span>
  );
}
