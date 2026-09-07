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
import { existsSync, readFileSync } from 'node:fs';
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
