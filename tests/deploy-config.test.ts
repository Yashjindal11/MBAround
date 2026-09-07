/**
 * Guards the Cloudflare deploy configuration.
 *
 * This project began life on Cloudflare Pages and now deploys as a Worker
 * with static assets. Two Pages-era files survived that move:
 *
 *   public/_redirects     `/*  /index.html  200`
 *   public/_routes.json   which paths invoke a Pages Function
 *
 * Under Pages both were harmless. Under the Worker assets runtime the first
 * one is fatal, because `not_found_handling = "single-page-application"` in
 * wrangler.toml already performs the SPA fallback natively, and the explicit
 * rule rewrites every path to /index.html - which itself matches `/*`:
 *
 *   Invalid _redirects configuration:
 *   Line 1: Infinite loop detected in this rule.
 *
 * The deploy failed without anyone editing the file, which is the worst kind
 * of failure to debug. These tests pin the resolution so a well-meaning
 * "the SPA fallback is missing, let me add _redirects" cannot reintroduce it.
 *
 * They mirror the public/robots.txt guard in robots.test.ts, which caught a
 * real regression the first time it ran.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const wrangler = readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');

describe('Cloudflare Pages-era files stay deleted', () => {
  it('has no public/_redirects', () => {
    // Reintroducing this breaks the deploy outright, not at runtime.
    expect(existsSync(path.join(ROOT, 'public', '_redirects'))).toBe(false);
  });

  it('has no public/_routes.json', () => {
    // A Pages Functions manifest with no Functions to route to.
    expect(existsSync(path.join(ROOT, 'public', '_routes.json'))).toBe(false);
  });

  it('explains in wrangler.toml why neither may return', () => {
    // Deleting the files without recording the reason invites their return.
    expect(wrangler).toContain('Do NOT add public/_redirects or public/_routes.json');
    expect(wrangler).toContain('Infinite loop detected');
  });
});

describe('SPA deep links still resolve', () => {
  it('declares the native single-page-application fallback', () => {
    // This is what replaced _redirects; without it a hard refresh of
    // /schools/harvard-business-school is a 404, and so is every crawl of it.
    expect(wrangler).toMatch(/^not_found_handling = "single-page-application"$/m);
  });

  it('serves the Vite build output as assets', () => {
    expect(wrangler).toMatch(/^\[assets\]$/m);
    expect(wrangler).toMatch(/^directory = "\.\/dist"$/m);
  });
});

describe('_headers is retained', () => {
  const headersPath = path.join(ROOT, 'public', '_headers');

  it('still exists', () => {
    // Unlike _redirects and _routes.json, _headers is supported by the
    // Worker assets runtime and carries the site's security headers.
    expect(existsSync(headersPath)).toBe(true);
  });
  it('keeps the admin surface out of caches and out of search results', () => {
    const headers = readFileSync(headersPath, 'utf8');
    expect(headers).toMatch(/Cache-Control:\s*no-store/i);
    expect(headers).toMatch(/X-Robots-Tag:\s*noindex/i);
  });
});

describe('the runbook quotes a real test-file count', () => {
  /**
   * Both docs had drifted - HANDOFF.md said 10 files, OPERATIONS.md said 13,
   * while the suite had grown to 16. A pre-deploy checklist that understates
   * the expected count is worse than no checklist: a reader who runs the
   * suite, sees more tests than documented and assumes the docs are merely
   * stale will make the same assumption on the day a test file fails to load
   * and the count drops.
   *
   * Only the file count is asserted. The number of individual tests changes
   * with almost every commit, so pinning it would fail constantly and be
   * trained away; the file count changes rarely and deliberately.
   */
  const actual = readdirSync(path.join(ROOT, 'tests')).filter((f) =>
    f.endsWith('.test.ts'),
  ).length;

  it.each([
    ['docs/OPERATIONS.md', /(\d+) tests across (\d+) files/],
    ['docs/HANDOFF.md', /(\d+) test files, (\d+) tests passing/],
  ])('%s agrees with the tests/ directory', (doc, pattern) => {
    const text = readFileSync(path.join(ROOT, doc), 'utf8');
    const match = text.match(pattern);
    expect(match, `${doc} no longer states a test count`).not.toBeNull();

    // The two docs word it in opposite orders, so pick the capture that is
    // the file count rather than assuming a position.
    const [, first, second] = match!;
    const claimed = doc.includes('HANDOFF') ? Number(first) : Number(second);
    expect(claimed).toBe(actual);
  });
});
