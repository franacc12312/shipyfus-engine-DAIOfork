import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api module
const mockPost = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { approveStage, rejectStage } from '../lib/hitl';

// Test the markdown parsing logic (extracted from ResearchBriefViewer)
function parseMarkdownSections(markdown: string): { heading: string; items: string[] }[] {
  const sections: { heading: string; items: string[] }[] = [];
  const lines = markdown.split('\n');
  let current: { heading: string; items: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', ''), items: [] };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        current.items.push(trimmed.slice(2));
      } else if (trimmed.length > 0) {
        current.items.push(trimmed);
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

describe('parseMarkdownSections', () => {
  it('parses a full research brief into sections', () => {
    const markdown = `## Summary
Strong demand for privacy-first dev tools.

## Market Trends
- AI tools growing 40% YoY
- Developer productivity focus increasing

## Pain Points
- Users frustrated with slow load times`;

    const sections = parseMarkdownSections(markdown);

    expect(sections).toHaveLength(3);
    expect(sections[0].heading).toBe('Summary');
    expect(sections[0].items).toEqual(['Strong demand for privacy-first dev tools.']);
    expect(sections[1].heading).toBe('Market Trends');
    expect(sections[1].items).toEqual(['AI tools growing 40% YoY', 'Developer productivity focus increasing']);
    expect(sections[2].heading).toBe('Pain Points');
    expect(sections[2].items).toEqual(['Users frustrated with slow load times']);
  });

  it('returns empty array for empty markdown', () => {
    expect(parseMarkdownSections('')).toEqual([]);
  });

  it('handles markdown with no sections', () => {
    expect(parseMarkdownSections('Just some plain text')).toEqual([]);
  });

  it('handles sections with no bullet items', () => {
    const markdown = `## Summary
This is a paragraph summary with no bullets.`;
    const sections = parseMarkdownSections(markdown);
    expect(sections).toHaveLength(1);
    expect(sections[0].items).toEqual(['This is a paragraph summary with no bullets.']);
  });

  it('skips blank lines between items', () => {
    const markdown = `## Trends
- Trend A

- Trend B`;
    const sections = parseMarkdownSections(markdown);
    expect(sections[0].items).toEqual(['Trend A', 'Trend B']);
  });
});

describe('ResearchBriefViewer HITL actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approve calls POST /runs/:id/stages/research/approve', async () => {
    mockPost.mockResolvedValue({ status: 'approved' });

    await approveStage('run-789', 'research');

    expect(mockPost).toHaveBeenCalledWith('/runs/run-789/stages/research/approve');
  });

  it('retry calls POST /runs/:id/stages/research/reject with retry action', async () => {
    mockPost.mockResolvedValue({ status: 'retrying' });

    await rejectStage('run-789', 'research', 'retry');

    expect(mockPost).toHaveBeenCalledWith('/runs/run-789/stages/research/reject', { action: 'retry' });
  });

  it('cancel calls POST /runs/:id/stages/research/reject with cancel action', async () => {
    mockPost.mockResolvedValue({ status: 'cancelled' });

    await rejectStage('run-789', 'research', 'cancel');

    expect(mockPost).toHaveBeenCalledWith('/runs/run-789/stages/research/reject', { action: 'cancel' });
  });
});
