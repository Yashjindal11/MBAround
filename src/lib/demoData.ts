/**
 * Sample rounds for evaluating timeline layouts — NEVER written to the database.
 *
 * ## Why this file exists instead of seed rows
 *
 * `application_rounds` is empty, so the timeline views have nothing to render
 * and their designs cannot be judged. The obvious fix — insert a few sample
 * rounds — is the one thing this project does not do. A row in Supabase is
 * indistinguishable from a real one: it flows into /deadlines, /compare, the
 * school pages and the sitemap, and `db:verify` reports it as healthy. An
 * invented date for a real school is exactly the failure MBAround exists to
 * prevent, and it would be discovered by a user planning around it.
 *
 * So the sample data lives here instead:
 *
 *  - it is never inserted, so it cannot leak into a query, an export or a
 *    crawler;
 *  - the schools are openly fictional ("Northmoor", "Calder") so no reader can
 *    mistake a shape for a claim about a real programme;
 *  - it loads only behind an explicit `?demo=1`, so nobody arrives at it;
 *  - `DEMO_BANNER` is rendered by every page that uses it.
 *
 * The dates are chosen to exercise layout edge cases rather than to look
 * plausible: clustered deadlines, a lone outlier months later, rounds already
 * closed, a round due today, unannounced rounds, unverified rounds, and a
 * school whose rounds are named "Stage" rather than "Round".
 *
 * Deleting this file must never break the app. Nothing outside the timeline
 * pages may import it.
 */
import type { DeadlineRow } from './types';

/** Shown wherever demo rows are rendered. Not optional. */
export const DEMO_BANNER =
  'Sample data for previewing this layout. These schools and dates are fictional and are not stored in the database.';

/** Query flag that turns demo mode on. */
export const DEMO_PARAM = 'demo';

export function isDemoRequested(search: string): boolean {
  return new URLSearchParams(search).get(DEMO_PARAM) === '1';
}

/**
 * Dates are generated relative to a supplied "today" rather than hardcoded, so
 * the fixtures keep exercising past/today/future branches forever instead of
 * silently becoming all-past and making the layouts look broken later.
 */
function iso(now: Date, offsetDays: number): string {
  const d = new Date(now.getTime() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

interface DemoRoundSpec {
  name: string;
  order: number;
  /** Days from today. `null` models a round the school has not announced. */
  offset: number | null;
  decisionOffset?: number | null;
  isVerified?: boolean;
  notes?: string | null;
}

interface DemoProgramSpec {
  school: string;
  short: string;
  slug: string;
  country: string;
  region: string;
  city: string;
  program: string;
  programType: string;
  cycle: string;
  rounds: DemoRoundSpec[];
}

/**
 * Deliberately varied: differing round counts, differing round vocabulary and
 * one programme with a rolling single deadline. A layout that only works for a
 * tidy three-round grid will visibly fail here, which is the point.
 */
const SPECS: DemoProgramSpec[] = [
  {
    school: 'Northmoor Business School',
    short: 'Northmoor',
    slug: 'demo-northmoor',
    country: 'United States',
    region: 'North America',
    city: 'Ann Harbor',
    program: 'Full-Time MBA',
    programType: 'Full-Time MBA',
    cycle: '2026-2027',
    rounds: [
      { name: 'Round 1', order: 1, offset: -34, decisionOffset: -4, isVerified: true },
      { name: 'Round 2', order: 2, offset: 0, decisionOffset: 47, isVerified: true },
      { name: 'Round 3', order: 3, offset: 96, decisionOffset: 145, isVerified: true },
    ],
  },
  {
    school: 'Calder Graduate School of Management',
    short: 'Calder',
    slug: 'demo-calder',
    country: 'United States',
    region: 'North America',
    city: 'Fairhaven',
    program: 'Full-Time MBA',
    programType: 'Full-Time MBA',
    cycle: '2026-2027',
    rounds: [      { name: 'Round 1', order: 1, offset: -29, decisionOffset: 2, isVerified: true },
      { name: 'Round 2', order: 2, offset: 6, decisionOffset: 55, isVerified: true },
      // Exactly the same day as Northmoor Round 3: the collision v3 warns
      // about, and the one a proportional axis renders as a single blob.
      { name: 'Round 3', order: 3, offset: 96, decisionOffset: null, isVerified: false },
      { name: 'Round 4', order: 4, offset: null, isVerified: false },
    ],
  },
  {
    school: 'Ashgrove School of Business',
    short: 'Ashgrove',
    slug: 'demo-ashgrove',
    country: 'United Kingdom',
    region: 'Europe',
    city: 'Wexbridge',
    program: 'MBA',
    programType: 'Full-Time MBA',
    cycle: '2026-2027',
    // Five stages, not rounds: proves nothing assumes R1/R2/R3.
    rounds: [
      { name: 'Stage 1', order: 1, offset: -61, decisionOffset: -20, isVerified: true },
      { name: 'Stage 2', order: 2, offset: -12, decisionOffset: 30, isVerified: true },      { name: 'Stage 3', order: 3, offset: 21, decisionOffset: 70, isVerified: true },
      // One day after the Northmoor/Calder pile-up: a near-miss, which the
      // track view renders as effectively the same instant.
      { name: 'Stage 4', order: 4, offset: 97, decisionOffset: 121, isVerified: false },
      { name: 'Stage 5', order: 5, offset: 133, decisionOffset: null, isVerified: false },
    ],
  },
  {
    school: 'Lakemere Institute of Management',
    short: 'Lakemere',
    slug: 'demo-lakemere',
    country: 'India',
    region: 'Asia',
    city: 'Rampur',
    program: 'PGP in Management',
    programType: 'Full-Time MBA',
    cycle: '2026-2027',
    // A single common-application deadline, months from the cluster: the
    // outlier that stretches any proportional scale.
    rounds: [
      {
        name: 'Common Application',
        order: 1,
        offset: 218,
        decisionOffset: 268,
        isVerified: true,
        notes: 'Single application window; shortlisting follows the national entrance test.',
      },
    ],
  },
  {
    school: 'Verity European Business School',
    short: 'Verity',
    slug: 'demo-verity',
    country: 'France',
    region: 'Europe',
    city: 'Saint-Aubin',
    program: 'Global Executive MBA',
    programType: 'Executive MBA',
    cycle: '2026-2027',
    rounds: [
      { name: 'Early Decision', order: 1, offset: -7, decisionOffset: 24, isVerified: true },
      { name: 'Regular Decision', order: 2, offset: 41, decisionOffset: 88, isVerified: true },
      // Entirely unannounced programme tail.
      { name: 'Late Round', order: 3, offset: null, isVerified: false },
    ],
  },
];

/**
 * Builds the flattened rows the timeline pages consume.
 *
 * `now` is injectable so tests are deterministic and do not drift.
 */
export function demoDeadlineRows(now: Date = new Date()): DeadlineRow[] {
  const rows: DeadlineRow[] = [];

  SPECS.forEach((spec, sIdx) => {
    const schoolId = `demo-school-${sIdx}`;
    const programId = `demo-program-${sIdx}`;
    const cycleId = `demo-cycle-${sIdx}`;

    spec.rounds.forEach((round, rIdx) => {
      const announced = round.offset !== null;
      rows.push({
        roundId: `demo-round-${sIdx}-${rIdx}`,
        roundName: round.name,
        roundOrder: round.order,
        deadline: announced ? iso(now, round.offset as number) : null,
        decisionDate:
          round.decisionOffset === null || round.decisionOffset === undefined
            ? null
            : iso(now, round.decisionOffset),
        isAnnounced: announced,
        // An unannounced round is never verified: there is nothing to verify.
        isVerified: announced ? (round.isVerified ?? false) : false,
        sourceUrl: announced ? 'https://example.invalid/demo-admissions' : null,
        sourceName: announced ? 'Sample source (not real)' : null,
        lastVerified: announced ? iso(now, -3) : null,
        notes: round.notes ?? null,
        cycleId,
        cycleName: spec.cycle,
        programId,
        programName: spec.program,
        programType: spec.programType,
        schoolId,
        schoolName: spec.school,
        schoolSlug: spec.slug,
        country: spec.country,
        region: spec.region,
        city: spec.city,
      });
    });
  });

  return rows;
}

/** The schools implied by the demo rows, for the scoping rail. */
export function demoSchools(now: Date = new Date()) {
  const stamp = new Date(now.getTime()).toISOString();
  return SPECS.map((spec, i) => ({
    id: `demo-school-${i}`,
    name: spec.school,
    slug: spec.slug,
    shortName: spec.short,
    description: null,
    country: spec.country,
    region: spec.region,
    state: null,
    city: spec.city,
    websiteUrl: null,
    admissionsUrl: null,
    logoUrl: null,
    imageUrl: null,
    isFeatured: false,
    isPublished: true,
    isVerified: false,
    displayOrder: i,
    createdAt: stamp,
    updatedAt: stamp,
  }));
}
