/**
 * Generates `dist/sitemap.xml` after a production build.
 *
 * School URLs are read from Supabase at build time rather than hardcoded, so
 * publishing a school in the admin panel puts it in the sitemap on the next
 * deploy with no code change. If credentials are absent the script still emits
 * a valid sitemap containing the static routes and exits successfully, so a
 * preview build never fails for want of a database.
 *
 * Only published schools are included — the anon key is used deliberately so
 * that row-level security, not this script, decides what is public.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://mbaround.com').replace(/\/$/, '');
const OUT_DIR = path.resolve(process.cwd(), 'dist');

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
    // A build should not fail because the sitemap could not be enriched.
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

  console.log(
    `[sitemap] Wrote ${urls.length} URLs (${STATIC_ROUTES.length} static, ${schools.length} schools).`,
  );
}

main().catch((err) => {
  console.error('[sitemap] Failed:', err);
  process.exit(1);
});
