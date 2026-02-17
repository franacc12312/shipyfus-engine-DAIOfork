import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { injectPostHogSnippet } from '../services/posthog.js';

const TEST_DIR = join(import.meta.dirname, '__posthog_test__');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('injectPostHogSnippet', () => {
  it('injects snippet before </head> in index.html', () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<html><head><title>Test</title></head><body></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(true);
    expect(result.filesModified).toEqual(['index.html']);

    const content = readFileSync(join(TEST_DIR, 'index.html'), 'utf-8');
    expect(content).toContain('posthog.init(');
    expect(content).toContain('phc_test123');
    expect(content).toContain('</head>');
  });

  it('injects snippet before </body> if no </head>', () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<html><body><p>Hello</p></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(true);

    const content = readFileSync(join(TEST_DIR, 'index.html'), 'utf-8');
    expect(content).toContain('posthog.init(');
  });

  it('uses custom host when provided', () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<html><head></head><body></body></html>');

    injectPostHogSnippet(TEST_DIR, 'phc_test123', 'https://eu.i.posthog.com');

    const content = readFileSync(join(TEST_DIR, 'index.html'), 'utf-8');
    expect(content).toContain('https://eu.i.posthog.com');
  });

  it('returns error when no API key provided', () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<html><head></head><body></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, '');
    expect(result.injected).toBe(false);
    expect(result.error).toContain('No PostHog API key');
  });

  it('returns error when no HTML files found', () => {
    // Empty directory, no index.html
    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(false);
    expect(result.error).toContain('No index.html found');
  });

  it('finds index.html in dist subdirectory', () => {
    mkdirSync(join(TEST_DIR, 'dist'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'dist', 'index.html'), '<html><head></head><body></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(true);
    expect(result.filesModified).toContain('dist/index.html');
  });

  it('finds index.html in build subdirectory', () => {
    mkdirSync(join(TEST_DIR, 'build'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'build', 'index.html'), '<html><head></head><body></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(true);
    expect(result.filesModified).toContain('build/index.html');
  });

  it('skips files that already have PostHog', () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<html><head><script>posthog.init("existing")</script></head><body></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(false);
    // No files modified because it was already injected
    expect(result.filesModified).toEqual([]);
  });

  it('handles multiple HTML files', () => {
    mkdirSync(join(TEST_DIR, 'dist'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'index.html'), '<html><head></head><body></body></html>');
    writeFileSync(join(TEST_DIR, 'dist', 'index.html'), '<html><head></head><body></body></html>');

    const result = injectPostHogSnippet(TEST_DIR, 'phc_test123');
    expect(result.injected).toBe(true);
    expect(result.filesModified.length).toBe(2);
  });
});
