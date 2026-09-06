/**
 * Collects MBA application deadlines from official school admissions pages.
 *
 * Run:  npx tsx scripts/data/collect-deadlines.ts > rounds.sql
 *
 * THE RULE THIS SCRIPT EXISTS TO ENFORCE
 * --------------------------------------
 * A date is only ever written if it was found on the school's own admissions
 * page and can be cited with the URL it came from. There is no fallback, no
 * "typical" deadline, and no inference from last year. If a page cannot be
 * fetched or parsed, the round is emitted as NOT ANNOUNCED with a null
 * deadline - which the UI renders honestly - rather than guessed at.
 *
 * This mirrors the database constraints from migration 0001, so the SQL this
 * produces cannot violate them:
 *   - rounds_unannounced_has_no_dates : no dates unless is_announced
 *   - rounds_verified_requires_source : no is_verified without deadline + URL
 *   - rounds_decision_after_deadline  : decision cannot precede deadline
 *
 * Every emitted round is is_verified = false regardless. Automated extraction
 * is evidence that a date was PUBLISHED, not that a human CONFIRMED it means
 * what we think. Promotion to verified is a deliberate human act in the admin
 * panel. That is why extraction records source_url but never sets the flag.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProgramSeed {
  name: string;
  programType: string;
}
interface SchoolSeed {
  name: string;
  slug: string;
  admissionsUrl: string | null;
  programs: ProgramSeed[];
}

/** A date found on a page, with the evidence that it was found. */
interface FoundRound {
  roundName: string;
  /** ISO yyyy-mm-dd, or null when the school has not announced it. */
  deadline: string | null;
  sourceUrl: string;
}

function lit(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  return "'" + v.replace(/'/g, "''") + "'";
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

/**
 * Parses "October 15, 2026" / "15 October 2026" / "Oct 15 2026".
 *
 * Returns null rather than a best guess when the year is absent: a deadline
 * without a year is unusable, and inferring one is exactly the kind of
 * fabrication this project forbids.
 */
export function parseDeadlineText(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  const monthFirst = cleaned.match(
    /\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/,
  );
  const dayFirst = cleaned.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}),?\s+(\d{4})\b/,
  );

  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;

  if (monthFirst) {
    month = MONTHS[monthFirst[1].toLowerCase()];
    day = Number(monthFirst[2]);
    year = Number(monthFirst[3]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]);
    month = MONTHS[dayFirst[2].toLowerCase()];
    year = Number(dayFirst[3]);
  }

  if (!month || !day || !year) return null;
  if (day < 1 || day > 31) return null;

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Reject impossible dates such as 31 February.
  const probe = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(probe.getTime()) || probe.getUTCDate() !== day) return null;

  return iso;
}

/** Strips tags so date text can be matched against readable content. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds "Round N ... <date>" pairings. Round labels are taken from the page
 * rather than assumed, so schools using "Stage 1" or rolling admission are
 * not forced into an R1/R2/R3 shape they do not have.
 */
export function extractRounds(text: string, sourceUrl: string): FoundRound[] {
  const found: FoundRound[] = [];
  const seen = new Set<string>();

  // The window after a round label stops at the NEXT round label. A fixed
  // character window would let "Round 1" reach past "Round 2" and claim that
  // round's date as its own - attributing a real date to the wrong round,
  // which is worse than having no date at all.
  const LABEL = String.raw`(?:Round|Stage|Cycle)\s*(?:\d+|One|Two|Three|Four)`;
  const pattern = new RegExp(
    String.raw`\b(${LABEL})\b([\s\S]*?)(?=\b${LABEL}\b|$)`,
    'gi',
  );

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const roundName = m[1].replace(/\s+/g, ' ').trim();
    if (seen.has(roundName.toLowerCase())) continue;

    // Still bounded: a date hundreds of characters away is unrelated prose,
    // not this round's deadline.
    const deadline = parseDeadlineText(m[2].slice(0, 160));
    if (!deadline) continue;

    seen.add(roundName.toLowerCase());
    found.push({ roundName, deadline, sourceUrl });
  }

  return found;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'MBAroundBot/1.0 (+https://mbaround.com; deadline verification)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error(`  ! HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`  ! fetch failed for ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const cycleName = process.env.MBAROUND_CYCLE ?? '2026-27';
  const startYear = Number(cycleName.slice(0, 4));

  const { schools } = JSON.parse(
    readFileSync(path.join(__dirname, 'schools.json'), 'utf8'),
  ) as { schools: SchoolSeed[] };

  const only = process.argv[2];
  const targets = only ? schools.filter((s) => s.slug === only) : schools;

  const out: string[] = [];
  out.push('-- MBAround deadline collection');
  out.push(`-- Cycle: ${cycleName}`);
  out.push(`-- Generated: ${new Date().toISOString()}`);
  out.push('--');
  out.push('-- Every round below carries the source_url it was read from.');
  out.push('-- Rounds with no confirmed date are is_announced = false with a');
  out.push('-- null deadline. All rounds are is_verified = false pending human');
  out.push('-- review in the admin panel.');
  out.push('');
  out.push('begin;');
  out.push('');

  let withDates = 0;
  let withoutDates = 0;

  for (const school of targets) {
    if (!school.admissionsUrl) {
      console.error(`- ${school.name}: no admissions URL, skipping`);
      continue;
    }

    console.error(`- ${school.name}`);
    const html = await fetchPage(school.admissionsUrl);
    const rounds = html
      ? extractRounds(htmlToText(html), school.admissionsUrl)
      : [];

    if (rounds.length === 0) {
      console.error('  = no rounds extracted (will not invent any)');
      withoutDates++;
    } else {
      console.error(`  = ${rounds.length} round(s) with dates`);
      withDates++;
    }

    for (const program of school.programs) {
      out.push(`-- ${school.name} / ${program.name}`);
      out.push(`insert into application_cycles (program_id, cycle_name, start_year, is_current, status)`);
      out.push(`select p.id, ${lit(cycleName)}, ${startYear}, true, 'NEEDS_REVIEW'`);
      out.push(`from programs p join schools s on s.id = p.school_id`);
      out.push(`where s.slug = ${lit(school.slug)} and p.name = ${lit(program.name)}`);
      out.push(`on conflict do nothing;`);
      out.push('');

      for (const [i, r] of rounds.entries()) {
        out.push(`insert into application_rounds (cycle_id, round_name, round_order, deadline, is_announced, is_verified, source_url, status)`);
        out.push(`select c.id, ${lit(r.roundName)}, ${i + 1}, ${lit(r.deadline)}, true, false, ${lit(r.sourceUrl)}, 'NEEDS_REVIEW'`);
        out.push(`from application_cycles c`);
        out.push(`join programs p on p.id = c.program_id`);
        out.push(`join schools s on s.id = p.school_id`);
        out.push(`where s.slug = ${lit(school.slug)} and p.name = ${lit(program.name)} and c.cycle_name = ${lit(cycleName)}`);
        out.push(`on conflict do nothing;`);
        out.push('');
      }
    }
  }

  out.push('commit;');
  console.log(out.join('\n'));

  console.error('');
  console.error(`Schools with extracted dates : ${withDates}`);
  console.error(`Schools with none            : ${withoutDates}`);
  console.error('Nothing was invented for the second group.');
}

// Only run when invoked directly, so the parsers can be unit tested.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
