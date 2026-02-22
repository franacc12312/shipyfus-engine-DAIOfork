import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Navbar from '../components/Navbar';

afterEach(cleanup);

describe('Navbar', () => {
  it('renders DAIO branding', () => {
    render(<Navbar />);
    const brands = screen.getAllByText('DAIO');
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the dashboard link', () => {
    render(<Navbar />);
    const links = screen.getAllByText(/Launch App/);
    expect(links[0].closest('a')).toHaveAttribute('href', 'https://app.daio.one');
  });
});
