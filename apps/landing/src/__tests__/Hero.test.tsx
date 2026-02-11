import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Hero from '../components/Hero';

afterEach(cleanup);

describe('Hero', () => {
  it('renders the headline text', () => {
    render(<Hero />);
    expect(screen.getAllByText(/Fully Autonomous/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Product Studio/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the CTA link pointing to dashboard', () => {
    render(<Hero />);
    const ctas = screen.getAllByText(/See it in action/);
    expect(ctas[0].closest('a')).toHaveAttribute('href', 'https://daio.app');
  });

  it('renders the subtitle describing the pipeline', () => {
    render(<Hero />);
    expect(screen.getAllByText(/machine speed/).length).toBeGreaterThanOrEqual(1);
  });
});
