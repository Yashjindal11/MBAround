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
  /**
   * The programme's own admissions page. Required whenever a school lists more
   * than one programme: Kellogg's and Cornell's one-year and two-year MBAs run
   * on different calendars, and reading both from the school-level URL gave
   * them identical deadlines.
   */
  admissionsUrl?: string | null;
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
  /**
   * Position derived from the round's own number, not from where it happened
   * to appear in the HTML. Wharton listed Round 3 before Round 1, and ordering
   * by document position rendered Round 3 first.
   */
  order: number;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

/** The label keywords this parser recognises, in their canonical casing. */
const LABEL_WORDS = ['Round', 'Stage', 'Cycle'] as const;

/**
 * Canonicalises the casing of a round label without rewriting its meaning.
 *
 * Pages shout "ROUND 1" or whisper "round 1"; both are the same round, and
 * leaving them distinct produced duplicate rows under the
 * (application_cycle_id, name) unique key's notion of difference. Only the
 * recognised keyword and word-numbers are touched - "Stage 1" stays a stage
 * and is never renamed to "Round 1", because a school that runs stages does
 * not run rounds.
 */
export function normaliseRoundName(label: string): string {
  let out = label.replace(/\s+/g, ' ').trim();
  for (const word of LABEL_WORDS) {
    out = out.replace(new RegExp(`^${word}\\b`, 'i'), word);
  }
  return out.replace(
    /\b(one|two|three|four|five)\b/i,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
}

/** Pulls the ordinal out of "Round 2" / "Stage Three". */
export function roundNumber(label: string): number | null {
  const digits = label.match(/(\d+)/);
  if (digits) return Number(digits[1]);
  const word = label.toLowerCase().match(/\b(one|two|three|four|five)\b/);
  return word ? WORD_NUMBERS[word[1]] : null;
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
 *
 * Returns [] rather than a partial set when a numbered sequence has a gap.
 * A missing round is worse than no data: the page renders as complete, and an
 * applicant planning around the earliest deadline never learns it existed.
 *
 * `cycleStartYear` is the plausibility window. Admissions sites routinely
 * leave last cycle's table live below this year's copy, and a stale deadline
 * that has already passed is indistinguishable from a current one once it is
 * in the database.
 */
export function extractRounds(
  text: string,
  sourceUrl: string,
  cycleStartYear?: number,
): FoundRound[] {
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
    const roundName = normaliseRoundName(m[1]);
    const key = roundName.toLowerCase();
    if (seen.has(key)) continue;

    // Still bounded: a date hundreds of characters away is unrelated prose,
    // not this round's deadline.
    const deadline = parseDeadlineText(m[2].slice(0, 160));
    if (!deadline) continue;

    // A 2026-27 cycle's deadlines fall in 2026 or 2027. Anything else is last
    // year's table left live on the page, or a date belonging to some other
    // part of the site.
    if (cycleStartYear !== undefined) {
      const year = Number(deadline.slice(0, 4));
      if (year !== cycleStartYear && year !== cycleStartYear + 1) {
        console.error(
          `  ! ${roundName}: ${deadline} outside cycle ${cycleStartYear}-${cycleStartYear + 1} — discarding all`,
        );
        return [];
      }
    }

    const n = roundNumber(roundName);
    if (n === null) continue;

    seen.add(key);
    found.push({ roundName, deadline, sourceUrl, order: n });
  }

  if (found.length === 0) return [];

  found.sort((a, b) => a.order - b.order);

  // A numbered sequence must start at 1 and have no holes. Anything else means
  // the page had rounds this parser could not see (Kellogg produced rounds 2
  // and 3 with no Round 1), and a partial set must not be importable.
  const numbers = found.map((r) => r.order);
  const complete =
    numbers[0] === 1 && numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
  if (!complete) {
    console.error(
      `  ! incomplete round sequence [${numbers.join(', ')}] — discarding all`,
    );
    return [];
  }

  return found;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'MBAroundBot/1.0 (+https://gobizschool.com; deadline verification)',
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

  /** Fetch-and-parse memoised per URL, so shared URLs cost one request. */
  const cache = new Map<string, FoundRound[]>();
  async function roundsFor(url: string): Promise<FoundRound[]> {
    const hit = cache.get(url);
    if (hit) return hit;
    const html = await fetchPage(url);
    const rounds = html ? extractRounds(htmlToText(html), url, startYear) : [];
    cache.set(url, rounds);
    return rounds;
  }

  for (const school of targets) {
    console.error(`- ${school.name}`);

    for (const program of school.programs) {
      // A school-level URL may only speak for a school with one programme.
      // Where a school runs several, each needs its own page or it gets none:
      // copying one page's dates across programmes fabricated deadlines for
      // every programme but the one the page described.
      const url =
        program.admissionsUrl ??
        (school.programs.length === 1 ? school.admissionsUrl : null);

      if (!url) {
        console.error(
          `  = ${program.name}: no programme-specific admissions URL, skipping`,
        );
        withoutDates++;
        continue;
      }

      const rounds = await roundsFor(url);
      if (rounds.length === 0) {
        console.error(`  = ${program.name}: no rounds extracted (will not invent any)`);
        withoutDates++;
      } else {
        console.error(`  = ${program.name}: ${rounds.length} round(s) with dates`);
        withDates++;
      }

      out.push(`-- ${school.name} / ${program.name}`);
      // end_year is NOT NULL with no default, and 'CURRENT' is a cycle_status
      // value — an earlier version omitted the former and passed 'NEEDS_REVIEW'
      // (a record_status), so every generated statement would have aborted.
      out.push(
        `insert into application_cycles (program_id, cycle_name, start_year, end_year, is_current, status)`,
      );
      out.push(
        `select p.id, ${lit(cycleName)}, ${startYear}, ${startYear + 1}, true, 'CURRENT'`,
      );
      out.push(`from programs p join schools s on s.id = p.school_id`);
      out.push(`where s.slug = ${lit(school.slug)} and p.name = ${lit(program.name)}`);
      // The real conflict target: re-running must update, not silently skip.
      out.push(`on conflict (program_id, cycle_name) do nothing;`);
      out.push('');

      for (const r of rounds) {
        // Column names must match migration 0001 exactly: the table uses
        // application_cycle_id / name / display_order, and has no status
        // column. An earlier version invented cycle_id / round_name /
        // round_order and would have failed on every insert.
        out.push(
          `insert into application_rounds (application_cycle_id, name, display_order, deadline, is_announced, is_verified, source_url)`,
        );
        out.push(
          // display_order comes from the round's own number, never from array
          // position: Wharton lists Round 3 first, and positional ordering
          // rendered it first in the UI too.
          `select c.id, ${lit(r.roundName)}, ${r.order}, ${lit(r.deadline)}, true, false, ${lit(r.sourceUrl)}`,
        );
        out.push(`from application_cycles c`);
        out.push(`join programs p on p.id = c.program_id`);
        out.push(`join schools s on s.id = p.school_id`);
        out.push(`where s.slug = ${lit(school.slug)} and p.name = ${lit(program.name)} and c.cycle_name = ${lit(cycleName)}`);
        out.push(`on conflict (application_cycle_id, name) do nothing;`);
        out.push('');
      }
    }
  }

  out.push('commit;');
  console.log(out.join('\n'));

  console.error('');
  console.error(`Programmes with extracted dates : ${withDates}`);
  console.error(`Programmes with none            : ${withoutDates}`);
  console.error('Nothing was invented for the second group.');
}

// Only run when invoked directly, so the parsers can be unit tested.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
