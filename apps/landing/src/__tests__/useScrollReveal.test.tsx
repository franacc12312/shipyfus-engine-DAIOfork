import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useScrollReveal } from '../hooks/useScrollReveal';

afterEach(cleanup);

function TestComponent() {
  const ref = useScrollReveal<HTMLDivElement>();
  return <div ref={ref} data-testid="reveal-target" className="reveal">Content</div>;
}

describe('useScrollReveal', () => {
  it('returns a ref that attaches to the element', () => {
    const { getByTestId } = render(<TestComponent />);
    const el = getByTestId('reveal-target');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('reveal');
  });

  it('calls IntersectionObserver.observe on mount', () => {
    const mockObserve = vi.fn();
    const mockDisconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
      observe: mockObserve,
      unobserve: vi.fn(),
      disconnect: mockDisconnect,
      takeRecords: () => [],
    })));

    render(<TestComponent />);
    expect(mockObserve).toHaveBeenCalled();
  });
});
