import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Footer from '../components/Footer';

afterEach(cleanup);

describe('Footer', () => {
  it('renders the copyright year', () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getAllByText(new RegExp(year)).length).toBeGreaterThanOrEqual(1);
  });

  it('renders navigation links', () => {
    render(<Footer />);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('GitHub').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Twitter / X').length).toBeGreaterThanOrEqual(1);
  });
});
