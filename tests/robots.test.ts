/**
 * The deployed origin must be stated once and only once.
 *
 * robots.txt used to live in public/ with a hardcoded Sitemap line naming a
 * fixed domain. On any other host - a custom subdomain, a preview deploy, or
 * simply a change of domain - that line sends crawlers to a host that does
 * not serve this site, and the real sitemap is never read. Nothing visibly
 * breaks, which is exactly why it needs a test.
 *
 * The site has now moved domains twice, which is the point: these tests
 * assert that the origin is *derived*, never spelled out, so a third move is
 * one environment variable rather than a hunt through the source.
 *
 * They check the generator's source rather than executing it: running it
 * requires network access to Supabase, and a test that silently depends on a
 * live database is a test that fails for reasons unrelated to the code.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const source = readFileSync(path.join(ROOT, 'scripts', 'generate-sitemap.ts'), 'utf8');

describe('robots.txt is generated, not hardcoded', () => {
  it('is not shipped as a static file that could shadow the generated one', () => {
    // A file in public/ is copied over dist/ by Vite, silently reinstating
    // the hardcoded domain this arrangement exists to avoid.
    expect(existsSync(path.join(ROOT, 'public', 'robots.txt'))).toBe(false);
  });

  it('is written by the sitemap generator', () => {
    expect(source).toMatch(/writeFile\(\s*path\.join\(OUT_DIR, 'robots\.txt'\)/);
  });

  it('builds its Sitemap line from the configured origin', () => {
    // The defect being prevented is a domain baked in at authoring time.
    expect(source).toContain('`Sitemap: ${SITE_URL}/sitemap.xml`');
  });

  it('shares one origin between robots.txt, the sitemap and canonicals', () => {
    // Disagreeing about the canonical host is a self-inflicted
    // duplicate-content problem, and SITE_URL is the single definition.
    expect(source).toMatch(/const SITE_URL = \(process\.env\.VITE_SITE_URL \?\?/);
    // No literal origin may appear anywhere except that one fallback.
    const origins = source.match(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
    const nonSchema = origins.filter((o) => !o.includes('sitemaps.org'));
    expect(nonSchema.length, `expected one fallback origin, found ${nonSchema.join(', ')}`).toBe(1);
  });

  it('keeps the admin CMS out of search results', () => {
    // Authenticated and database-authorised, so this is tidiness rather than
    // security - but losing it would put login pages in the index.
    expect(source).toContain("'Disallow: /admin'");
  });
});

describe('the app agrees with the build on the origin', () => {
  const seo = readFileSync(path.join(ROOT, 'src', 'lib', 'seo.ts'), 'utf8');

  it('prefers the configured origin, then the live one', () => {
    // window.location.origin keeps canonicals correct on preview deploys and
    // custom domains even when VITE_SITE_URL was never set.
    const configured = seo.indexOf('VITE_SITE_URL');
    const live = seo.indexOf('window.location.origin');
    expect(configured).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(configured);
  });

  it('does not disagree with the build about the fallback domain', () => {
    const buildFallback = /VITE_SITE_URL \?\? '([^']+)'/.exec(source)?.[1];
    const appFallback = /return '(https:\/\/[^']+)';/.exec(seo)?.[1];
    expect(buildFallback).toBeDefined();
    expect(appFallback).toBe(buildFallback);
  });

  it('leaves no trace of a previously used domain', () => {
    /*
      Each move leaves the old domain behind in whatever file the search
      missed, and a stale fallback is worse than an obviously wrong one: it
      only surfaces when VITE_SITE_URL is unset, which is precisely the case
      nobody tests before a deploy.

      Checked across the files that can emit a URL. The dist/ directory is
      build output and is excluded - it is regenerated, not edited.
    */
    const RETIRED = ['mbaround.com', 'jindalyash.com'];
    const files = [
      path.join('src', 'lib', 'seo.ts'),
      path.join('scripts', 'generate-sitemap.ts'),
      path.join('scripts', 'data', 'collect-deadlines.ts'),
      path.join('public', 'index.html'),
      'index.html',
    ];

    for (const rel of files) {
      const full = path.join(ROOT, rel);
      if (!existsSync(full)) continue;
      const text = readFileSync(full, 'utf8');
      for (const domain of RETIRED) {
        expect(text, `${rel} still references the retired domain ${domain}`).not.toContain(domain);
      }
    }
  });
});