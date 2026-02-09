import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '@daio/shared';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<Product[]>('/products');
      setProducts(data);
    } catch (err) {
      setError('Failed to fetch products');
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-zinc-100 tracking-wider">PRODUCTS</h2>
        <p className="text-xs text-zinc-500 mt-1">Autonomously built and deployed applications</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <span className="inline-block w-2 h-2 bg-terminal-green rounded-full animate-pulse" />
          Loading products...
        </div>
      ) : error ? (
        <div className="bg-zinc-950 border border-terminal-red/30 rounded-lg p-6 text-center">
          <p className="text-terminal-red text-sm">{error}</p>
          <button
            onClick={fetchProducts}
            className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-3 py-1 transition"
          >
            RETRY
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400 text-sm">No products built yet</p>
          <p className="text-zinc-600 text-xs mt-2">
            Start a run from the Dashboard to build your first product
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
