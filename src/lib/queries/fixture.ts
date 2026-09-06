import type {
  ApplicationCycle,
  ApplicationRound,
  Program,
  School,
} from '../types';

/**
 * ---------------------------------------------------------------------------
 * DEVELOPMENT FIXTURE — NOT CANONICAL DATA
 * ---------------------------------------------------------------------------
 * This module exists so the UI can be developed and reviewed before a Supabase
 * project is connected. It is used ONLY when `isSupabaseConfigured` is false.
 *
 * Every deadline below is marked `isVerified: false` / `NEEDS_REVIEW` because
 * it has NOT been confirmed against an official school admissions page. The
 * canonical dataset is produced by `scripts/data/import-top-mba.ts` and lives
 * in Supabase. Nothing here is ever served in production.
 * ---------------------------------------------------------------------------
 */

const ts = '2026-09-06T00:00:00Z';

function school(
  partial: Omit<School, 'createdAt' | 'updatedAt' | 'logoUrl' | 'imageUrl'>,
): School {
  return { ...partial, logoUrl: null, imageUrl: null, createdAt: ts, updatedAt: ts };
}

export const fixtureSchools: School[] = [
  school({
    id: 's-hbs',
    name: 'Harvard Business School',
    slug: 'harvard-business-school',
    shortName: 'HBS',
    description:
      'Harvard Business School educates leaders through the case method, a discussion-based pedagogy used across the two-year residential MBA programme in Boston, Massachusetts.',
    country: 'United States',
    region: 'North America',
    state: 'Massachusetts',
    city: 'Boston',
    websiteUrl: 'https://www.hbs.edu',
    admissionsUrl: 'https://www.hbs.edu/mba/admissions/Pages/default.aspx',
    isFeatured: true,
    isPublished: true,
    isVerified: false,
    displayOrder: 1,
  }),
  school({
    id: 's-wharton',
    name: 'The Wharton School, University of Pennsylvania',
    slug: 'wharton',
    shortName: 'Wharton',
    description:
      'The Wharton School offers a flexible, analytically rigorous MBA with a broad major structure and a large cohort based in Philadelphia.',
    country: 'United States',
    region: 'North America',
    state: 'Pennsylvania',
    city: 'Philadelphia',
    websiteUrl: 'https://www.wharton.upenn.edu',
    admissionsUrl: 'https://mba.wharton.upenn.edu/admissions/',
    isFeatured: true,
    isPublished: true,
    isVerified: false,
    displayOrder: 2,
  }),
  school({
    id: 's-stanford',
    name: 'Stanford Graduate School of Business',
    slug: 'stanford-gsb',
    shortName: 'Stanford GSB',
    description:
      'Stanford GSB runs a small, highly selective two-year MBA in Silicon Valley with a strong entrepreneurial and general-management orientation.',
    country: 'United States',
    region: 'North America',
    state: 'California',
    city: 'Stanford',
    websiteUrl: 'https://www.gsb.stanford.edu',
    admissionsUrl: 'https://www.gsb.stanford.edu/programs/mba/admission',
    isFeatured: true,
    isPublished: true,
    isVerified: false,
    displayOrder: 3,
  }),
  school({
    id: 's-insead',
    name: 'INSEAD',
    slug: 'insead',
    shortName: 'INSEAD',
    description:
      'INSEAD delivers an accelerated one-year MBA across campuses in Fontainebleau, Singapore and Abu Dhabi, with two intakes per year.',
    country: 'France',
    region: 'Europe',
    state: null,
    city: 'Fontainebleau',
    websiteUrl: 'https://www.insead.edu',
    admissionsUrl: 'https://www.insead.edu/master-programmes/mba/admissions',
    isFeatured: true,
    isPublished: true,
    isVerified: false,
    displayOrder: 4,
  }),
  school({
    id: 's-lbs',
    name: 'London Business School',
    slug: 'london-business-school',
    shortName: 'LBS',
    description:
      'London Business School offers an MBA with a flexible 15–21 month duration, situated in central London with a highly international cohort.',
    country: 'United Kingdom',
    region: 'Europe',
    state: null,
    city: 'London',
    websiteUrl: 'https://www.london.edu',
    admissionsUrl: 'https://www.london.edu/masters-degrees/mba',
    isFeatured: true,
    isPublished: true,
    isVerified: false,
    displayOrder: 5,
  }),
  school({
    id: 's-iimb',
    name: 'Indian Institute of Management Bangalore',
    slug: 'iim-bangalore',
    shortName: 'IIM Bangalore',
    description:
      'IIM Bangalore offers a two-year Post Graduate Programme in Management alongside a one-year MBA for experienced professionals.',
    country: 'India',
    region: 'Asia',
    state: 'Karnataka',
    city: 'Bengaluru',
    websiteUrl: 'https://www.iimb.ac.in',
    admissionsUrl: 'https://www.iimb.ac.in/programmes',
    isFeatured: false,
    isPublished: true,
    isVerified: false,
    displayOrder: 6,
  }),
  school({
    id: 's-nus',
    name: 'NUS Business School',
    slug: 'nus-business-school',
    shortName: 'NUS',
    description:
      'NUS Business School runs a 17-month MBA in Singapore with strong Asian market immersion and exchange options.',
    country: 'Singapore',
    region: 'Asia',
    state: null,
    city: 'Singapore',
    websiteUrl: 'https://bschool.nus.edu.sg',
    admissionsUrl: 'https://mba.nus.edu.sg/admissions/',
    isFeatured: false,
    isPublished: true,
    isVerified: false,
    displayOrder: 7,
  }),
  school({
    id: 's-iese',
    name: 'IESE Business School',
    slug: 'iese-business-school',
    shortName: 'IESE',
    description:
      'IESE Business School runs a 15–19 month case-based MBA headquartered in Barcelona with modules in Madrid, New York and São Paulo.',
    country: 'Spain',
    region: 'Europe',
    state: null,
    city: 'Barcelona',
    websiteUrl: 'https://www.iese.edu',
    admissionsUrl: 'https://www.iese.edu/mba/admissions/',
    isFeatured: false,
    isPublished: true,
    isVerified: false,
    displayOrder: 8,
  }),
];

function program(
  id: string,
  schoolId: string,
  name: string,
  slug: string,
  durationMonths: number | null,
  displayOrder = 1,
  programType = 'Full-time MBA',
): Program {
  return {
    id,
    schoolId,
    name,
    slug,
    programType,
    description: null,
    durationMonths,
    isPublished: true,
    isVerified: false,
    displayOrder,
    createdAt: ts,
    updatedAt: ts,
  };
}

export const fixturePrograms: Program[] = [
  program('p-hbs-mba', 's-hbs', 'MBA', 'mba', 24),
  program('p-wharton-mba', 's-wharton', 'MBA', 'mba', 20),
  program('p-stanford-mba', 's-stanford', 'MBA', 'mba', 24),
  program('p-insead-mba', 's-insead', 'MBA', 'mba', 10),
  program('p-lbs-mba', 's-lbs', 'MBA', 'mba', 15),
  program('p-iimb-pgp', 's-iimb', 'Post Graduate Programme in Management', 'pgp', 24),
  program('p-iimb-epgp', 's-iimb', 'EPGP (One-Year MBA)', 'epgp', 12, 2, 'One-year MBA'),
  program('p-nus-mba', 's-nus', 'MBA', 'mba', 17),
  program('p-iese-mba', 's-iese', 'MBA', 'mba', 19),
];

function cycle(id: string, programId: string): ApplicationCycle {
  return {
    id,
    programId,
    cycleName: '2026–27',
    startYear: 2026,
    endYear: 2027,
    status: 'CURRENT',
    isCurrent: true,
    createdAt: ts,
    updatedAt: ts,
  };
}

export const fixtureCycles: ApplicationCycle[] = fixturePrograms.map((p) =>
  cycle(`c-${p.id}`, p.id),
);

interface RoundSeed {
  cycleId: string;
  name: string;
  deadline: string | null;
  decisionDate: string | null;
  order: number;
  announced?: boolean;
  notes?: string;
}

/**
 * Placeholder round structures used only to exercise the UI. Deliberately
 * varied (2, 3 and 4 round structures, plus rolling and unannounced rounds) so
 * that no view assumes a fixed "Round 1 → 2 → 3" shape.
 */
const roundSeeds: RoundSeed[] = [
  { cycleId: 'c-p-hbs-mba', name: 'Round 1', deadline: '2026-09-17', decisionDate: '2026-12-10', order: 1 },
  { cycleId: 'c-p-hbs-mba', name: 'Round 2', deadline: '2027-01-06', decisionDate: '2027-03-25', order: 2 },
  { cycleId: 'c-p-hbs-mba', name: 'Round 3', deadline: null, decisionDate: null, order: 3, announced: false },

  { cycleId: 'c-p-wharton-mba', name: 'Round 1', deadline: '2026-09-10', decisionDate: '2026-12-10', order: 1 },
  { cycleId: 'c-p-wharton-mba', name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-19', order: 2 },
  { cycleId: 'c-p-wharton-mba', name: 'Round 3', deadline: '2027-04-01', decisionDate: '2027-05-13', order: 3 },

  { cycleId: 'c-p-stanford-mba', name: 'Round 1', deadline: '2026-09-15', decisionDate: '2026-12-09', order: 1 },
  { cycleId: 'c-p-stanford-mba', name: 'Round 2', deadline: '2027-01-07', decisionDate: '2027-03-26', order: 2 },
  { cycleId: 'c-p-stanford-mba', name: 'Round 3', deadline: '2027-04-08', decisionDate: '2027-05-20', order: 3 },

  { cycleId: 'c-p-insead-mba', name: 'Round 1', deadline: '2026-09-22', decisionDate: '2026-11-20', order: 1, notes: 'September 2027 intake.' },
  { cycleId: 'c-p-insead-mba', name: 'Round 2', deadline: '2026-11-10', decisionDate: '2027-01-22', order: 2 },
  { cycleId: 'c-p-insead-mba', name: 'Round 3', deadline: '2027-01-19', decisionDate: '2027-03-26', order: 3 },
  { cycleId: 'c-p-insead-mba', name: 'Round 4', deadline: '2027-03-16', decisionDate: '2027-05-21', order: 4 },

  { cycleId: 'c-p-lbs-mba', name: 'Round 1', deadline: '2026-09-11', decisionDate: '2026-11-06', order: 1 },
  { cycleId: 'c-p-lbs-mba', name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-12', order: 2 },
  { cycleId: 'c-p-lbs-mba', name: 'Round 3', deadline: '2027-03-23', decisionDate: '2027-05-14', order: 3 },

  { cycleId: 'c-p-iimb-pgp', name: 'CAT-based application', deadline: null, decisionDate: null, order: 1, announced: false, notes: 'Admission is driven by the national CAT examination timetable.' },
  { cycleId: 'c-p-iimb-epgp', name: 'Round 1', deadline: '2026-10-15', decisionDate: null, order: 1 },
  { cycleId: 'c-p-iimb-epgp', name: 'Round 2', deadline: '2026-12-15', decisionDate: null, order: 2 },

  { cycleId: 'c-p-nus-mba', name: 'Round 1', deadline: '2026-10-31', decisionDate: '2027-01-15', order: 1 },
  { cycleId: 'c-p-nus-mba', name: 'Round 2', deadline: '2027-01-31', decisionDate: '2027-03-31', order: 2 },

  { cycleId: 'c-p-iese-mba', name: 'Round 1', deadline: '2026-09-08', decisionDate: '2026-11-13', order: 1 },
  { cycleId: 'c-p-iese-mba', name: 'Round 2', deadline: '2026-11-24', decisionDate: '2027-02-05', order: 2 },
  { cycleId: 'c-p-iese-mba', name: 'Rolling', deadline: null, decisionDate: null, order: 3, announced: false, notes: 'Later applications considered on a rolling basis.' },
];

export const fixtureRounds: ApplicationRound[] = roundSeeds.map((r, i) => {
  const announced = r.announced !== false;
  return {
    id: `r-${i}`,
    applicationCycleId: r.cycleId,
    name: r.name,
    deadline: announced ? r.deadline : null,
    decisionDate: announced ? r.decisionDate : null,
    notes: r.notes ?? null,
    isAnnounced: announced,
    // Nothing in the fixture has been checked against an official source.
    isVerified: false,
    sourceUrl: null,
    sourceName: null,
    lastVerified: null,
    displayOrder: r.order,
    createdAt: ts,
    updatedAt: ts,
  };
});
