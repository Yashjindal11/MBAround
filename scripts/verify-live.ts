import { readFileSync } from 'node:fs';

/**
 * End-to-end check of the public query layer against the real database.
 *
 * Unit tests cannot catch a column renamed in a migration, a broken RLS policy,
 * or a view that silently returns nothing - all of which look like "no data"
 * in the UI and like a passing test suite on CI. This talks to the live
 * project through the anon key, so it fails for exactly the reasons a visitor
 * would see an empty page.
 *
 * Run: npx tsx scripts/verify-live.ts
 */

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const env = loadEnv();
const URL_ = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function get<T>(pathAndQuery: string): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${pathAndQuery}`);
  return (await res.json()) as T;
}

interface SchoolRow {
  slug: string;
  name: string;
  country: string;
  region: string;
  is_published: boolean;
}

async function main() {
  console.log(`Verifying ${URL_}\n`);

  // 1. Published schools are readable by anonymous visitors.
  const schools = await get<SchoolRow[]>(
    'schools?select=slug,name,country,region,is_published&is_published=eq.true',
  );
  check('anon can read published schools', schools.length > 0, `${schools.length} rows`);

  // 2. RLS must not leak unpublished rows into the public read path.
  const anyUnpublished = await get<SchoolRow[]>(
    'schools?select=slug&is_published=eq.false',
  );
  check(
    'unpublished schools are not exposed to anon',
    anyUnpublished.length === 0,
    `${anyUnpublished.length} visible`,
  );

  // 3. Slugs must be unique — the school page is routed by slug, so a
  //    duplicate would make one of the two unreachable.
  const slugs = schools.map((s) => s.slug);
  check('school slugs are unique', new Set(slugs).size === slugs.length);

  // 4. Facets are derived from data, so blank country/region values would
  //    render an empty, unclickable filter chip.
  check(
    'every school has a country and region',
    schools.every((s) => s.country?.trim() && s.region?.trim()),
  );

  // 5. The flattened view the whole product reads from must be queryable.
  //    An empty result is legitimate (no rounds yet); an error is not.
  let viewOk = true;
  try {
    await get<unknown[]>('deadline_rows?select=round_id&limit=1');
  } catch (e) {
    viewOk = false;
    console.error(`    ${(e as Error).message}`);
  }
  check('deadline_rows view is queryable', viewOk);

  // 6. Writes must stay closed to anonymous users.
  const write = await fetch(`${URL_}/rest/v1/schools`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', slug: 'rls-probe', country: 'x', region: 'x', city: 'x' }),
  });
  check('anon cannot insert schools', write.status === 401 || write.status === 403,
    `HTTP ${write.status}`);

  // 7. Suggestions are the one public write, and must stay open or the
  //    correction path is dead.
  const suggest = await fetch(`${URL_}/rest/v1/suggestions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },    body: JSON.stringify({
      issue: 'automated liveness probe — ignore',
      source_url: 'https://example.com',
    }),
  });
  check('anon can submit a suggestion', suggest.status === 201, `HTTP ${suggest.status}`);

  // 8. Submitted suggestions must not be readable back by the public.
  const readBack = await get<unknown[]>('suggestions?select=id');
  check('anon cannot read suggestions back', readBack.length === 0);

  console.log(
    failures === 0
      ? '\nAll live checks passed.'
      : `\n${failures} live check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
