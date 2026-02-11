import { Link } from 'react-router-dom';
import type { Product } from '@daio/shared';

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-100">{product.name}</h3>
        <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
          product.status === 'deployed'
            ? 'bg-terminal-green/20 text-terminal-green'
            : 'bg-zinc-700 text-zinc-300'
        }`}>
          {product.status}
        </span>
      </div>

      <p className="text-xs text-zinc-400 mb-3 line-clamp-2">
        {typeof product.description === 'string' ? product.description : ''}
      </p>

      {product.tech_stack && typeof product.tech_stack === 'object' && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(product.tech_stack as Record<string, unknown>).language && (
            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
              {String((product.tech_stack as Record<string, unknown>).language)}
            </span>
          )}
          {(product.tech_stack as Record<string, unknown>).framework && (
            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
              {String((product.tech_stack as Record<string, unknown>).framework)}
            </span>
          )}
          {Array.isArray((product.tech_stack as Record<string, unknown>).keyDependencies) &&
            ((product.tech_stack as Record<string, unknown>).keyDependencies as string[]).map((dep) => (
              <span key={dep} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                {dep}
              </span>
            ))
          }
        </div>
      )}

      <div className="flex items-center justify-between text-[10px]">
        {product.deploy_url ? (
          <a
            href={product.deploy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terminal-green hover:underline"
          >
            Visit &rarr;
          </a>
        ) : (
          <span className="text-zinc-600">No deployment</span>
        )}

        {product.run_id && (
          <Link to={`/runs/${product.run_id}`} className="text-zinc-500 hover:text-zinc-300">
            View Run
          </Link>
        )}
      </div>

      <div className="text-[9px] text-zinc-600 mt-2">
        {new Date(product.created_at).toLocaleString()}
      </div>
    </div>
  );
}
