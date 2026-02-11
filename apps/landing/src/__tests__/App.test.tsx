import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('contains the DAIO heading', () => {
    render(<App />);
    const headings = screen.getAllByText(/DAIO/);
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
