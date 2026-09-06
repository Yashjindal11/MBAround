/**
 * Reports what is actually in the database, using the anon key so that what it
 * prints is exactly what a visitor can see. If a table is empty here, it is
 * empty for users too - RLS problems and missing data look identical from the
 * outside, which is precisely why this reads through the public role.
 *
 * Run: npx tsx scripts/db-probe.ts
 */
import { readFileSync } from 'node:fs';

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
  console.error('Missing Supabase URL/key in .env');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function count(table: string): Promise<string> {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=*`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) return `HTTP ${res.status}`;
  const range = res.headers.get('content-range') ?? '';
  return range.split('/')[1] ?? '?';
}

const TABLES = [
  'schools',
  'programs',
  'application_cycles',
  'application_rounds',
  'suggestions',
  'deadline_rows',
];

async function main() {
  console.log(`Supabase: ${URL_}\n`);
  for (const t of TABLES) {
    console.log(`  ${t.padEnd(20)} ${await count(t)}`);
  }

  // Any round that is announced must carry a date, and any round carrying a
  // date must cite where it came from. These are the invariants the whole
  // product rests on, so they are checked against live data, not assumed.
  const res = await fetch(
    `${URL_}/rest/v1/application_rounds?select=id,name,deadline,is_announced,is_verified,source_url`,
    { headers },
  );
  if (res.ok) {
    const rounds = (await res.json()) as {
      name: string;
      deadline: string | null;
      is_announced: boolean;
      is_verified: boolean;
      source_url: string | null;
    }[];
    const dated = rounds.filter((r) => r.deadline);
    const announcedNoDate = rounds.filter((r) => r.is_announced && !r.deadline);
    const datedNotAnnounced = rounds.filter((r) => r.deadline && !r.is_announced);
    const verifiedNoSource = rounds.filter(
      (r) => r.is_verified && (!r.source_url || !r.deadline),
    );

    console.log(`\n  rounds with a date      ${dated.length}`);
    console.log(`  announced but undated   ${announcedNoDate.length}  (must be 0)`);
    console.log(`  dated but unannounced   ${datedNotAnnounced.length}  (must be 0)`);
    console.log(`  verified w/o source     ${verifiedNoSource.length}  (must be 0)`);

    const bad =
      announcedNoDate.length + datedNotAnnounced.length + verifiedNoSource.length;
    if (bad > 0) {
      console.error('\nINTEGRITY VIOLATION — data contradicts the honesty rules.');
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
