import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Features from '../components/Features';

afterEach(cleanup);

describe('Features', () => {
  it('renders all feature titles', () => {
    render(<Features />);
    for (const title of ['Search at Machine Speed', 'Open Kitchen', 'Gets Smarter', 'Training Wheels Come Off']) {
      expect(screen.getAllByText(title).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders feature descriptions', () => {
    render(<Features />);
    expect(screen.getAllByText(/product\/market fit/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/No black boxes/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the correct number of feature cards', () => {
    const { container } = render(<Features />);
    const cards = container.querySelectorAll('.cyber-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });
});
