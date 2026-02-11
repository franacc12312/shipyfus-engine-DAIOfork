import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Pipeline from '../components/Pipeline';

afterEach(cleanup);

describe('Pipeline', () => {
  it('renders all 5 stage names', () => {
    render(<Pipeline />);
    for (const name of ['Ideation', 'Planning', 'Development', 'Deployment', 'Distribution']) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders stage descriptions', () => {
    render(<Pipeline />);
    expect(screen.getAllByText(/generates a product concept/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/structured, phased build plan/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ralph-loop pattern/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the pipeline section heading', () => {
    render(<Pipeline />);
    expect(screen.getAllByText('The Pipeline').length).toBeGreaterThanOrEqual(1);
  });
});
