/**
 * Generates `dist/sitemap.xml` after a production build.
 *
 * School URLs are read from Supabase at build time rather than hardcoded, so
 * publishing a school in the admin panel puts it in the sitemap on the next
 * deploy with no code change.
 *
 * Only published schools are included — the anon key is used deliberately so
 * that row-level security, not this script, decides what is public.
 *
 * Missing credentials are tolerated in a local or preview build and are a hard
 * failure in a production one. Without Supabase the site renders no schools,
 * no deadlines and no filters at all: shipping that to a live domain is worse
 * than shipping nothing, because it looks like a working site that simply has
 * no data. See `assertProductionCredentials`.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://mbaround.jindalyash.com').replace(
  /\/$/,
  '',
);
const OUT_DIR = path.resolve(process.cwd(), 'dist');

/**
 * True when this build's output is destined for a real domain.
 *
 * Cloudflare sets CF_PAGES_BRANCH / WORKERS_CI_BRANCH on its build machines;
 * CI is set by nearly every provider. A developer running `npm run build`
 * locally matches none of these and keeps the lenient behaviour.
 */
function isProductionBuild(): boolean {
  if (process.env.MBAROUND_ALLOW_UNCONFIGURED_BUILD === 'true') return false;
  const branch = process.env.CF_PAGES_BRANCH ?? process.env.WORKERS_CI_BRANCH;
  if (branch) return branch === 'main' || branch === 'master';
  return process.env.CI === 'true' || process.env.NODE_ENV === 'production';
}

/**
 * Refuses to produce a production build that cannot reach the database.
 *
 * This exists because a deploy did exactly that and reported success: the
 * bundle built, the sitemap emitted 10 static URLs, and the result would have
 * been a live site whose every data-bearing page was empty. A build that
 * cannot fail for this reason cannot warn about it either — the only log line
 * was one `console.warn` amid normal output.
 */
function assertProductionCredentials(configured: boolean): void {
  if (configured || !isProductionBuild()) return;
  console.error(
    '\n[sitemap] REFUSING TO BUILD: Supabase credentials are missing.\n' +
      '\n' +
      '  This looks like a production build, and without VITE_SUPABASE_URL and\n' +
      '  VITE_SUPABASE_ANON_KEY the deployed site shows no schools, no deadlines\n' +
      '  and no filters — every page renders its empty state.\n' +
      '\n' +
      '  Set both variables in the Cloudflare dashboard under\n' +
      '  Settings -> Variables and Secrets, then redeploy.\n' +
      '\n' +
      '  To build without a database on purpose, set\n' +
      '  MBAROUND_ALLOW_UNCONFIGURED_BUILD=true.\n',
  );
  process.exit(1);
}

/** Routes that always exist, with relative priorities for crawl budgeting. */
const STATIC_ROUTES: ReadonlyArray<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/deadlines', priority: '0.9', changefreq: 'daily' },
  { path: '/schools', priority: '0.9', changefreq: 'weekly' },
  { path: '/compare', priority: '0.7', changefreq: 'weekly' },
  { path: '/timeline', priority: '0.7', changefreq: 'weekly' },
  { path: '/suggest', priority: '0.5', changefreq: 'monthly' },
  { path: '/about', priority: '0.4', changefreq: 'monthly' },
  { path: '/data-sources', priority: '0.4', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.2', changefreq: 'yearly' },
  { path: '/terms', priority: '0.2', changefreq: 'yearly' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type SchoolEntry = { slug: string; updatedAt: string | null };

async function fetchPublishedSchools(): Promise<SchoolEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes('your-project-ref')) {
    assertProductionCredentials(false);
    console.warn(
      '[sitemap] Supabase not configured — emitting static routes only.',
    );
    return [];
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('schools')
    .select('slug, updated_at')
    .eq('is_published', true)
    .order('slug');
  if (error) {
    // Credentials present but the database is unreachable or RLS refused the
    // read. The deployed site would be just as empty as with no credentials at
    // all, so production is held to the same standard.
    if (isProductionBuild()) {
      console.error(
        `\n[sitemap] REFUSING TO BUILD: could not read schools — ${error.message}\n` +
          '\n  Credentials are set but the query failed. Check the project is\n' +
          '  running and that the anon key is current.\n',
      );
      process.exit(1);
    }
    console.warn(`[sitemap] Could not read schools: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    updatedAt: (row.updated_at as string | null) ?? null,
  }));
}

function renderUrl(loc: string, lastmod: string | null, changefreq: string, priority: string) {
  const parts = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ];
  return parts.filter(Boolean).join('\n');
}

/**
 * Rewrites `robots.txt` with the origin this build is actually deployed to.
 *
 * The copy in `public/` is static and therefore cannot know the domain. A
 * hardcoded `Sitemap:` line pointing at the wrong host is worse than having
 * no line at all: crawlers follow it to a domain that either does not serve
 * this site or serves a different one, and the real sitemap is never read.
 * That failure is silent - the site looks fine to a human.
 *
 * Generating it here means the origin is stated once, in VITE_SITE_URL, and
 * canonicals, the sitemap and robots.txt cannot disagree.
 */
async function writeRobots(): Promise<void> {
  const body = [
    `# MBAround — ${SITE_URL}`,
    '#',
    '# Generated by scripts/generate-sitemap.ts from VITE_SITE_URL.',
    '# Edit that variable, not this file.',
    '#',
    '# The admin CMS is authenticated and database-authorised; it holds nothing',
    '# of value to crawlers and is excluded to keep it out of search results.',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');

  await writeFile(path.join(OUT_DIR, 'robots.txt'), body, 'utf8');
  console.log(`[sitemap] Wrote robots.txt for ${SITE_URL}.`);
}

async function main(): Promise<void> {
  const schools = await fetchPublishedSchools();

  const urls = [
    ...STATIC_ROUTES.map((r) =>
      renderUrl(`${SITE_URL}${r.path}`, null, r.changefreq, r.priority),
    ),
    ...schools.map((s) =>
      renderUrl(`${SITE_URL}/schools/${s.slug}`, s.updatedAt, 'weekly', '0.8'),
    ),
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'sitemap.xml'), xml, 'utf8');
  await writeRobots();

  console.log(
    `[sitemap] Wrote ${urls.length} URLs (${STATIC_ROUTES.length} static, ${schools.length} schools).`,
  );
}

main().catch((err) => {
  console.error('[sitemap] Failed:', err);
  process.exit(1);
});
