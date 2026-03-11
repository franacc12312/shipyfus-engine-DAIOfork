import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '@daio/shared';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    run_id: 'run-1',
    name: 'Test Product',
    description: 'A generated product',
    idea_spec: null,
    plan: null,
    tech_stack: null,
    directory_path: '/tmp/prod-1',
    deploy_url: 'https://test.vercel.app',
    domain_name: null,
    analytics_enabled: false,
    posthog_project_id: null,
    github_repo_owner: 'TheDAIO',
    github_repo_name: 'test-product-run1',
    github_repo_url: 'https://github.com/TheDAIO/test-product-run1',
    github_default_branch: 'main',
    github_clone_url: 'https://github.com/TheDAIO/test-product-run1.git',
    github_is_private: true,
    github_sync_status: 'synced',
    github_last_synced_at: '2026-03-11T17:00:00.000Z',
    github_last_sync_error: null,
    status: 'deployed',
    created_at: '2026-03-11T17:00:00.000Z',
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('renders deploy and GitHub links when both exist', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProductCard product={makeProduct()} />
      </MemoryRouter>,
    );

    expect(html).toContain('Visit');
    expect(html).toContain('GitHub');
    expect(html).toContain('https://github.com/TheDAIO/test-product-run1');
  });

  it('omits the GitHub link when repository metadata is missing', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProductCard product={makeProduct({ github_repo_url: null })} />
      </MemoryRouter>,
    );

    expect(html).not.toContain('GitHub');
  });
});
