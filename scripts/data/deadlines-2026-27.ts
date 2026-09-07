/**
 * 2026-27 application rounds, transcribed from a user-supplied compilation.
 *
 * PROVENANCE - read before adding anything here.
 * -----------------------------------------------------------------------
 * These dates were compiled by hand and handed over as a single document.
 * They are NOT machine-read from official pages, so nothing in this file
 * carries a `source_url` and nothing is emitted as `is_verified`. Every row
 * lands as NEEDS_REVIEW for a human to confirm against the school's own
 * admissions page. That is the honest status: "someone typed this in", not
 * "MBAround checked it".
 *
 * Three rules govern what is allowed in this file:
 *
 *  1. A date is copied verbatim or it is not copied at all. Nothing is
 *     inferred from a neighbouring school, a previous cycle, or a pattern.
 *
 *  2. Anything the source marked "(Est)" is EXCLUDED, not imported as an
 *     estimate. An estimated deadline is indistinguishable from a real one
 *     once it is in the database, and someone will plan around it.
 *
 *  3. A vague decision date ("Mid-December 2026", "Rolling", "Ongoing") maps
 *     to `decisionDate: null`. A rounded-off guess is still a guess.
 *
 * Schools absent from `schools.json` are not added here. Inventing a school
 * record to hang a deadline on is how a typo becomes a permanent fake entry.
 */

export interface RoundSeed {
  /** Exactly as the school words it. Never normalised to "Round N". */
  name: string;
  /** ISO date, or null when the source did not state a firm one. */
  deadline: string | null;
  decisionDate: string | null;
  notes?: string;
}

export interface CycleSeed {
  /** Must match a slug in schools.json. */
  schoolSlug: string;
  /** Must match a programme name for that school. */
  programName: string;
  /** Free-text note recorded on every round in this group. */
  intakeNote?: string;
  rounds: RoundSeed[];
}

export const CYCLE_NAME = '2026-27';

/** Recorded on every row so the provenance travels with the data. */
export const SOURCE_NAME = 'User-supplied compilation (2026-27), pending verification';

export const CYCLES: CycleSeed[] = [
  {
    schoolSlug: 'harvard-business-school',
    programName: 'MBA',
    intakeNote: 'Class of 2029, matriculating fall 2027. Deadlines 12:00 PM ET.',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-09', decisionDate: '2026-12-10' },
      { name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-25' },
    ],
  },
  {
    schoolSlug: 'wharton',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-08', decisionDate: '2026-12-17' },
      { name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-31' },
      { name: 'Round 3', deadline: '2027-03-31', decisionDate: '2027-05-11' },
      {
        name: 'Deferred Admissions Round',
        deadline: '2027-04-21',
        decisionDate: '2027-07-01',
      },
    ],
  },
  {
    schoolSlug: 'columbia-business-school',
    programName: 'MBA',
    intakeNote: 'Decisions released on a rolling basis; no fixed decision date.',
    rounds: [
      { name: 'Round 1', deadline: '2026-06-17', decisionDate: null },
      { name: 'Round 2', deadline: '2026-08-13', decisionDate: null },
      { name: 'Round 2 Extended', deadline: '2026-09-01', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'yale-som',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-15', decisionDate: '2026-12-03' },
      { name: 'Round 2', deadline: '2027-01-06', decisionDate: '2027-03-18' },
      { name: 'Round 3', deadline: '2027-04-07', decisionDate: '2027-05-13' },
    ],
  },
  {
    schoolSlug: 'tuck',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-24', decisionDate: '2026-12-10' },
      { name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-18' },
      { name: 'Round 3', deadline: '2027-03-24', decisionDate: '2027-04-29' },
    ],
  },
  {
    schoolSlug: 'cornell-johnson',
    programName: 'Two-Year MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-17', decisionDate: '2026-12-09' },
      {
        name: 'Consortium early application',
        deadline: '2026-10-15',
        decisionDate: '2026-12-09',
      },
      {
        name: 'Consortium traditional application',
        deadline: '2027-01-05',
        decisionDate: '2027-03-26',
      },
      { name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-26' },
      { name: 'Round 3', deadline: '2027-04-06', decisionDate: '2027-05-21' },
    ],
  },
  {
    schoolSlug: 'london-business-school',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-03', decisionDate: '2026-11-26' },
      { name: 'Round 2', deadline: '2027-01-06', decisionDate: '2027-04-01' },
      { name: 'Round 3', deadline: '2027-03-22', decisionDate: '2027-06-03' },
    ],
  },
  {
    schoolSlug: 'insead',
    programName: 'MBA',
    intakeNote: 'August 2027 intake.',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-15', decisionDate: '2026-11-20' },
      { name: 'Round 2', deadline: '2026-11-03', decisionDate: '2027-01-22' },
      { name: 'Round 3', deadline: '2027-01-19', decisionDate: '2027-03-19' },
      { name: 'Round 4', deadline: '2027-03-09', decisionDate: '2027-05-07' },
    ],
  },
  {
    schoolSlug: 'hec-paris',
    programName: 'MBA',
    /*
      HEC runs rolling deadlines rather than named rounds. Numbering them
      "Round 1..10" would invent a structure the school does not use, so each
      row is named by its own date - which is how HEC's own table reads.
    */
    intakeNote: 'September 2027 intake. HEC uses dated deadlines, not named rounds.',
    rounds: [
      { name: 'Deadline 16 August 2026', deadline: '2026-08-16', decisionDate: '2026-09-18' },
      { name: 'Deadline 20 September 2026', deadline: '2026-09-20', decisionDate: '2026-10-23' },
      { name: 'Deadline 18 October 2026', deadline: '2026-10-18', decisionDate: '2026-11-20' },
      { name: 'Deadline 15 November 2026', deadline: '2026-11-15', decisionDate: '2026-12-18' },
      { name: 'Deadline 11 January 2027', deadline: '2027-01-11', decisionDate: '2027-02-19' },
      { name: 'Deadline 15 February 2027', deadline: '2027-02-15', decisionDate: '2027-03-19' },
      { name: 'Deadline 15 March 2027', deadline: '2027-03-15', decisionDate: '2027-04-16' },
      { name: 'Deadline 12 April 2027', deadline: '2027-04-12', decisionDate: '2027-05-21' },
      { name: 'Deadline 17 May 2027', deadline: '2027-05-17', decisionDate: '2027-06-18' },
      { name: 'Deadline 14 June 2027', deadline: '2027-06-14', decisionDate: '2027-07-16' },
    ],
  },
  {
    schoolSlug: 'stanford-gsb',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-09', decisionDate: '2026-12-09' },
      { name: 'Round 2', deadline: '2027-01-06', decisionDate: '2027-04-01' },
      { name: 'Round 3', deadline: '2027-04-07', decisionDate: '2027-05-27' },
    ],
  },
  {
    schoolSlug: 'michigan-ross',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-08', decisionDate: '2026-12-11' },
      { name: 'Round 2', deadline: '2027-01-04', decisionDate: '2027-03-19' },
      { name: 'Round 3', deadline: '2027-03-29', decisionDate: '2027-05-14' },
    ],
  },
  {
    schoolSlug: 'duke-fuqua',
    programName: 'Daytime MBA',
    rounds: [
      { name: 'Early Action', deadline: '2026-09-02', decisionDate: '2026-10-15' },
      { name: 'Round 1', deadline: '2026-09-30', decisionDate: '2026-12-10' },
      { name: 'Round 2', deadline: '2027-01-05', decisionDate: '2027-03-11' },
      { name: 'Round 3', deadline: '2027-03-25', decisionDate: '2027-05-06' },
    ],
  },
  {
    schoolSlug: 'darden',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Early Action', deadline: '2026-09-09', decisionDate: '2026-10-28' },
      { name: 'Round 1', deadline: '2026-10-07', decisionDate: '2026-12-09' },
      { name: 'Round 2', deadline: '2027-01-07', decisionDate: '2027-03-17' },
      { name: 'Round 3 - March', deadline: '2027-03-01', decisionDate: '2027-04-02' },
      { name: 'Round 3 - April', deadline: '2027-04-01', decisionDate: '2027-05-05' },
      { name: 'Round 3 - May', deadline: '2027-05-01', decisionDate: '2027-05-28' },
    ],
  },
  {
    schoolSlug: 'cmu-tepper',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-30', decisionDate: '2026-12-09' },
      { name: 'Round 2', deadline: '2027-01-08', decisionDate: '2027-03-10' },
      { name: 'Round 3', deadline: '2027-03-03', decisionDate: '2027-04-22' },
      {
        name: 'Round 4',
        deadline: '2027-05-05',
        decisionDate: null,
        notes: 'Decisions released on a rolling basis.',
      },
      {
        name: 'Round 4 Final',
        deadline: '2027-06-15',
        decisionDate: null,
        notes: 'Decisions released on a rolling basis.',
      },
    ],
  },
  {
    schoolSlug: 'chicago-booth',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-15', decisionDate: '2026-12-03' },
      { name: 'Round 2', deadline: '2027-01-07', decisionDate: '2027-03-25' },
      { name: 'Round 3', deadline: '2027-04-01', decisionDate: '2027-05-20' },
    ],
  },
  {
    schoolSlug: 'kellogg',
    programName: 'Two-Year MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-09', decisionDate: '2026-12-09' },
      { name: 'Round 2', deadline: '2027-01-06', decisionDate: '2027-03-24' },
      { name: 'Round 3', deadline: '2027-03-31', decisionDate: '2027-05-12' },
    ],
  },
  {
    schoolSlug: 'mit-sloan',
    programName: 'MBA',
    rounds: [
      {
        name: 'Round 1',
        deadline: '2026-09-29',
        decisionDate: null,
        notes: 'Source states "Mid-December 2026" - no firm decision date.',
      },
      {
        name: 'Round 2',
        deadline: '2027-01-12',
        decisionDate: null,
        notes: 'Source states "Early April 2027" - no firm decision date.',
      },
    ],
  },
  {
    schoolSlug: 'nyu-stern',
    programName: 'Full-time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-15', decisionDate: '2026-12-01' },
      { name: 'Round 2', deadline: '2026-10-15', decisionDate: '2027-01-01' },
      { name: 'Round 3', deadline: '2027-01-15', decisionDate: '2027-04-01' },
      {
        name: 'Round 4',
        deadline: '2027-04-15',
        decisionDate: null,
        notes: 'Decisions released on an ongoing basis.',
      },
    ],
  },
  {
    schoolSlug: 'berkeley-haas',
    programName: 'Full-time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-10', decisionDate: '2026-12-12' },
      { name: 'Round 2', deadline: '2027-01-07', decisionDate: '2027-03-20' },
      { name: 'Round 3', deadline: '2027-04-01', decisionDate: '2027-05-15' },
    ],
  },
  {
    schoolSlug: 'ucla-anderson',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-10-01', decisionDate: '2026-12-15' },
      { name: 'Round 2', deadline: '2027-01-06', decisionDate: '2027-03-22' },
      { name: 'Round 3', deadline: '2027-04-07', decisionDate: '2027-05-18' },
    ],
  },
  {
    schoolSlug: 'ut-mccombs',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-10-15', decisionDate: '2026-12-15' },
      { name: 'Round 2', deadline: '2027-01-15', decisionDate: '2027-03-25' },
      { name: 'Round 3', deadline: '2027-04-01', decisionDate: '2027-05-05' },
    ],
  },
  {
    schoolSlug: 'iese',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-23', decisionDate: null },
      { name: 'Round 2', deadline: '2027-01-07', decisionDate: null },
      { name: 'Round 3', deadline: '2027-03-09', decisionDate: null },
      { name: 'Round 4', deadline: '2027-05-06', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'cambridge-judge',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-08-24', decisionDate: null },
      { name: 'Round 2', deadline: '2026-10-05', decisionDate: null },
      { name: 'Round 3', deadline: '2027-01-04', decisionDate: null },
      { name: 'Round 4', deadline: '2027-03-22', decisionDate: null },
      { name: 'Round 5', deadline: '2027-05-04', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'oxford-said',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-02', decisionDate: null },
      { name: 'Round 2', deadline: '2026-10-05', decisionDate: null },
      { name: 'Round 3', deadline: '2026-11-04', decisionDate: null },
      { name: 'Round 4', deadline: '2027-01-06', decisionDate: null },
      { name: 'Round 5', deadline: '2027-03-15', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'imd',
    programName: 'MBA',
    intakeNote: 'January 2027 intake.',
    rounds: [
      { name: 'Round 1', deadline: '2026-07-14', decisionDate: null },
      { name: 'Round 2', deadline: '2026-09-15', decisionDate: null },
      { name: 'Round 3', deadline: '2026-10-13', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'sda-bocconi',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-15', decisionDate: null },
      { name: 'Round 2', deadline: '2026-11-15', decisionDate: null },
      { name: 'Round 3', deadline: '2027-01-15', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'ie-business-school',
    programName: 'International MBA',
    /*
      A real, useful fact with no date attached: IE admits on a rolling
      basis. Emitted with deadline NULL and is_announced false, which is
      exactly what the schema's "unannounced has no dates" rule describes.
    */
    rounds: [
      {
        name: 'Rolling Admissions',
        deadline: null,
        decisionDate: null,
        notes: 'IE admits on a rolling basis; no fixed round deadlines published.',
      },
    ],
  },
  {
    schoolSlug: 'isb',
    programName: 'Post Graduate Programme in Management',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-20', decisionDate: null },
      { name: 'Round 2', deadline: '2026-12-06', decisionDate: null },
      { name: 'Round 3', deadline: '2027-01-17', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'nanyang-business-school',
    programName: 'Nanyang MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-11-01', decisionDate: null },
      { name: 'Round 2', deadline: '2027-01-31', decisionDate: null },
      { name: 'Round 3', deadline: '2027-03-31', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'hkust',
    programName: 'Full-time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-10-15', decisionDate: null },
      { name: 'Round 2', deadline: '2026-12-15', decisionDate: null },
      { name: 'Round 3', deadline: '2027-03-01', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'rotman',
    programName: 'Full-Time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-02', decisionDate: null },
      { name: 'Round 2', deadline: '2027-01-12', decisionDate: null },
      { name: 'Round 3', deadline: '2027-03-03', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'ivey',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-09-22', decisionDate: null },
      { name: 'Round 2', deadline: '2027-01-10', decisionDate: null },
      { name: 'Round 3', deadline: '2027-04-05', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'mcgill-desautels',
    programName: 'MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-11-01', decisionDate: null },
      { name: 'Round 2', deadline: '2027-01-15', decisionDate: null },
      { name: 'Round 3', deadline: '2027-03-15', decisionDate: null },
    ],
  },
  {
    schoolSlug: 'agsm-unsw',
    programName: 'Full-time MBA',
    rounds: [
      { name: 'Round 1', deadline: '2026-06-01', decisionDate: null },
      { name: 'Round 2', deadline: '2026-07-01', decisionDate: null },
      { name: 'Round 3', deadline: '2026-08-01', decisionDate: null },
    ],
  },
];

/**
 * Schools present in the source document but deliberately NOT imported, with
 * the reason. Kept in code rather than a comment so the emitter can print it:
 * a silent skip looks identical to a bug.
 */
export const EXCLUDED: { label: string; reason: string }[] = [
  // Not in schools.json - importing them would mean inventing school records.
  ...[
    'USC Marshall',
    'Emory Goizueta',
    'UNC Kenan-Flagler',
    'Indiana Kelley',
    'Vanderbilt Owen',
    'WashU Olin',
    'Rice Jones',
    'Georgia Tech Scheller',
    'UW Foster',
    'Georgetown McDonough',
    'Notre Dame Mendoza',
    'Arizona State (W.P. Carey)',
    'UGA Terry',
    'Rochester Simon',
    'Penn State Smeal',
    'Boston College Carroll',
    'Maryland Smith',
    'SMU Cox',
    'Michigan State Broad',
    'UC Irvine Merage',
    'ESMT Berlin',
    'Imperial College',
    'Warwick (WBS)',
    'Alliance Manchester',
    "City St George's (Bayes)",
    'EDHEC',
    'EMlyon',
    'ESCP Europe',
    'Copenhagen (CBS)',
    'St. Gallen',
    'UBC Sauder',
    'York Schulich',
    "Queen's Smith",
    'SMU (Singapore)',
    'HKU (Hong Kong)',
    'EGADE (Mexico)',
  ].map((label) => ({ label, reason: 'Not in schools.json - no school record to attach to' })),

  // In schools.json, but every date the source gave was an estimate.
  ...['ESADE', 'RSM (Rotterdam)', 'NUS', 'CEIBS', 'IIM Ahmedabad', 'IIM Bangalore', 'Melbourne'].map(
    (label) => ({
      label,
      reason: 'Source marked every date "(Est)" - estimates are not imported',
    }),
  ),

  // In schools.json, but the source had no rows for them at all.
  ...['INSEAD Singapore', 'IIM Calcutta', 'IPADE', 'FGV-EAESP', 'UCT GSB'].map((label) => ({
    label,
    reason: 'No deadlines in the source document',
  })),

  {
    label: 'INSEAD - January 2027 intake',
    reason: 'Second intake for a school with one 2026-27 cycle; August 2027 intake imported',
  },
  {
    label: 'HEC Paris - September 2026 and January 2027 intakes',
    reason: 'Earlier intakes of the same cycle record; September 2027 intake imported',
  },
];
