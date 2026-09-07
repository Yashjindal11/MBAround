/**
 * Question -> typed query intent.
 *
 * This is the whole safety argument for the assistant, so it is worth stating
 * plainly: THIS MODULE GENERATES NO FACTS. It converts a sentence into a
 * filter object. Every number, date and school name the user eventually sees
 * is read from Supabase by `src/lib/queries/public.ts` and rendered by the
 * same components the rest of the site uses.
 *
 * Why not an LLM here? A language model asked "when is Wharton R2?" will
 * answer with a fluent, specific, plausible date whether or not one has been
 * announced. MBAround's entire premise is that a date on the screen is a date
 * a school actually published; 121 of our rounds are currently unverified and
 * one has no date at all. A generative answer path would invent exactly the
 * kind of confident falsehood this product exists to prevent - and, being
 * conversational, would be trusted more than a page would be.
 *
 * An LLM could later replace *this file only* - emitting a validated Intent
 * that is checked against real facets before it runs. The answer path stays
 * database-only either way.
 *
 * Unrecognised input yields `kind: 'unknown'`. Saying "I don't know" is a
 * feature: the alternative is guessing at what someone meant and showing them
 * confident, wrong results.
 */
import type { DeadlineFilters, SchoolFilters } from '../queries/public';

/** Facets read from the database, used to resolve names without hardcoding. */
export interface IntentVocabulary {
  schools: { id: string; name: string; slug: string; shortName: string | null }[];
  countries: string[];
  regions: string[];
  programTypes: string[];
  roundNames: string[];
}

export type Intent =
  | { kind: 'deadlines'; filters: DeadlineFilters; label: string }
  | { kind: 'schools'; filters: SchoolFilters; label: string }
  | { kind: 'school-detail'; schoolId: string; slug: string; label: string }
  | { kind: 'compare'; slugs: string[]; label: string }
  | { kind: 'help'; label: string }
  | { kind: 'unknown'; label: string; suggestions: string[] };

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Strips punctuation and collapses whitespace, preserving word boundaries. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds schools mentioned by name, short name or slug.
 *
 * Matching is word-boundary aware rather than a bare `includes`: "IE" would
 * otherwise match inside "Berkeley" and silently return the wrong school,
 * which is the kind of error nobody reports because the answer still looks
 * like an answer.
 *
 * Longer names are tested first so "London Business School" is not consumed
 * by a hypothetical "London".
 */
export function matchSchools(
  query: string,
  vocab: IntentVocabulary,
): IntentVocabulary['schools'] {
  const haystack = ` ${normalise(query)} `;
  const candidates = vocab.schools
    .flatMap((s) =>
      [s.name, s.shortName, s.slug.replace(/-/g, ' ')]
        .filter((n): n is string => Boolean(n))
        .map((n) => ({ school: s, needle: normalise(n) })),
    )
    .filter((c) => c.needle.length >= 2)
    .sort((a, b) => b.needle.length - a.needle.length);
  const found = new Map<string, IntentVocabulary['schools'][number]>();
  let remaining = haystack;
  for (const { school, needle } of candidates) {
    if (found.has(school.id)) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, 'u');
    if (pattern.test(remaining)) {
      found.set(school.id, school);
      // Consume the match so an overlapping shorter name cannot also fire.
      remaining = remaining.replace(pattern, ' ');
    }
  }

  // Fall back to distinctive single words for the shorthand people actually
  // type: "berkeley" for "Berkeley Haas School of Business", "kellogg",
  // "tuck". Only runs on text left over after full names matched, so it
  // cannot double-count a school already found.
  if (remaining.trim()) {
    for (const [token, school] of distinctiveTokens(vocab)) {
      if (found.has(school.id)) continue;
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(token)}(?![\\p{L}\\p{N}])`, 'u');
      if (pattern.test(remaining)) {
        found.set(school.id, school);
        remaining = remaining.replace(pattern, ' ');
      }
    }
  }

  return [...found.values()];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Words that appear in so many school names that they identify nobody.
 *
 * Without this list, "business school" matches thirty schools at once and the
 * assistant answers a question the user did not ask. These are exactly the
 * tokens a human would ignore when hearing a name.
 */
const GENERIC_NAME_WORDS = new Set([
  'the', 'of', 'at', 'and', 'for', 'in',
  'school', 'schools', 'business', 'university', 'college', 'institute',
  'management', 'graduate', 'studies', 'administration', 'sciences', 'science',
  'faculty', 'centre', 'center', 'international', 'global', 'executive',
]);

/**
 * Tokens that identify exactly one school.
 *
 * Real names are longer than what people type: the database holds "Berkeley
 * Haas School of Business", but users type "berkeley". Matching only on the
 * full name, short name or slug misses that entirely - a false negative,
 * which is invisible because the assistant simply answers something broader.
 *
 * Building the index from the live vocabulary means a token is only usable
 * while it stays unambiguous. If a second Berkeley school were added,
 * "berkeley" would stop resolving on its own rather than silently picking
 * whichever row sorted first.
 */
function distinctiveTokens(
  vocab: IntentVocabulary,
): Map<string, IntentVocabulary['schools'][number]> {
  const owners = new Map<string, Set<string>>();
  const byId = new Map<string, IntentVocabulary['schools'][number]>();

  for (const school of vocab.schools) {
    byId.set(school.id, school);
    const words = new Set(
      [school.name, school.shortName, school.slug.replace(/-/g, ' ')]
        .filter((n): n is string => Boolean(n))
        .flatMap((n) => normalise(n).split(' ')),
    );
    for (const word of words) {
      if (word.length < 3 || GENERIC_NAME_WORDS.has(word)) continue;
      if (!owners.has(word)) owners.set(word, new Set());
      owners.get(word)!.add(school.id);
    }
  }
  const index = new Map<string, IntentVocabulary['schools'][number]>();

  // A place name is never a school shorthand, even when it is unique to one
  // school's name. "Schools in Europe" must not resolve to CEIBS just because
  // "China Europe International Business School" is the only row containing
  // the word - the user is plainly asking about a region. Geography always
  // wins over a substring coincidence.
  const places = new Set(
    [...vocab.regions, ...vocab.countries].flatMap((p) => normalise(p).split(' ')),
  );

  for (const [word, ids] of owners) {
    if (places.has(word)) continue;
    if (ids.size === 1) {
      const school = byId.get([...ids][0]);
      if (school) index.set(word, school);
    }
  }
  return index;
}

/**
 * Joins label fragments into a readable phrase.
 *
 * Fragments already carrying their own preposition ("in January") must not be
 * given a second one, or the label reads "Deadlines for in January" - which
 * looks like a string-concatenation bug to a user, and is one.
 */
function deadlineLabel(parts: string[]): string {
  if (!parts.length) return 'Upcoming deadlines';
  const [first, ...rest] = parts;
  const head = first.startsWith('in ') ? `Deadlines ${first}` : `Deadlines for ${first}`;
  return [head, ...rest].join(' ');
}

/**
 * Sorts matched schools into the order the user wrote them.
 *
 * Matching deliberately tries longest names first, so match order is not
 * reading order. Only labels and comparison columns depend on this, but
 * reversing what someone just typed makes the assistant look like it
 * misheard.
 */
function orderByAppearance(
  schools: IntentVocabulary['schools'],
  normalisedText: string,
): IntentVocabulary['schools'] {
  const positionOf = (school: IntentVocabulary['schools'][number]): number => {
    const names = [school.name, school.shortName, school.slug.replace(/-/g, ' ')]
      .filter((n): n is string => Boolean(n))
      .map(normalise);
    const positions = names
      .map((n) => normalisedText.indexOf(n))
      .filter((i) => i >= 0);
    return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
  };
  return [...schools].sort((a, b) => positionOf(a) - positionOf(b));
}

/** Matches a vocabulary term (country, region, programme type) in the query. */
function matchTerms(query: string, terms: string[]): string[] {
  const haystack = ` ${normalise(query)} `;
  return terms.filter((term) => {
    const needle = normalise(term);
    if (!needle) return false;
    return new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`,
      'u',
    ).test(haystack);
  });
}

/**
 * Resolves a month name to a date range in the current application cycle.
 *
 * `now` is injected so tests are deterministic and so the range follows the
 * academic year: asking in September about "January" means the January that
 * is coming, not the one that has passed.
 */
export function monthRange(
  month: string,
  now: Date = new Date(),
): { from: string; to: string } | null {
  const index = MONTHS.indexOf(month.toLowerCase());
  if (index < 0) return null;

  const currentMonth = now.getUTCMonth();
  const year = index >= currentMonth ? now.getUTCFullYear() : now.getUTCFullYear() + 1;

  const from = new Date(Date.UTC(year, index, 1));
  const to = new Date(Date.UTC(year, index + 1, 0));
  return { from: iso(from), to: iso(to) };
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DEADLINE_WORDS = /\b(deadline|deadlines|due|closes|closing|when|date|dates|round|rounds|apply|application)\b/;
const SCHOOL_LIST_WORDS = /\b(school|schools|programme|programmes|program|programs|mba|list|show|find|which)\b/;
const COMPARE_WORDS = /\b(compare|versus|vs|against|difference)\b/;
const HELP_WORDS = /^(help|what can you do|how does this work|hi|hello|hey)\b/;

/**
 * Parses free text into an intent.
 *
 * Order matters: an explicit comparison beats a school lookup, and a school
 * lookup beats a generic list, because the more specific reading is almost
 * always what was meant.
 */
export function parseIntent(
  raw: string,
  vocab: IntentVocabulary,
  now: Date = new Date(),
): Intent {
  const text = normalise(raw);

  if (!text) {
    return {
      kind: 'unknown',
      label: 'Ask about deadlines, schools or rounds.',
      suggestions: defaultSuggestions(vocab),
    };
  }

  if (HELP_WORDS.test(text)) {
    return { kind: 'help', label: 'What I can look up' };
  }

  const schools = matchSchools(raw, vocab);
  const regions = matchTerms(raw, vocab.regions);
  const countries = matchTerms(raw, vocab.countries);
  const programTypes = matchTerms(raw, vocab.programTypes);
  const roundNames = matchTerms(raw, vocab.roundNames);
  const month = MONTHS.find((m) =>
    new RegExp(`(?<![\\p{L}])${m}(?![\\p{L}])`, 'u').test(text),
  );
  // "HBS vs Wharton" - only a comparison when two schools are actually named.
  if (COMPARE_WORDS.test(text) && schools.length >= 2) {
    // Ordered as written, not as matched: matchSchools tries longer names
    // first, which would otherwise render "compare HBS vs INSEAD" as
    // "Comparing INSEAD and Harvard Business School".
    const ordered = orderByAppearance(schools, text);
    return {
      kind: 'compare',
      slugs: ordered.map((s) => s.slug),
      label: `Comparing ${ordered.map((s) => s.name).join(' and ')}`,
    };
  }

  const wantsDeadlines = DEADLINE_WORDS.test(text) || Boolean(month) || roundNames.length > 0;

  if (wantsDeadlines) {
    const filters: DeadlineFilters = { sort: 'nearest' };
    const parts: string[] = [];

    if (schools.length) {
      filters.schoolIds = schools.map((s) => s.id);
      parts.push(schools.map((s) => s.name).join(', '));
    }
    if (regions.length) {
      filters.regions = regions;
      parts.push(`in ${regions.join(', ')}`);
    }
    if (countries.length) {
      filters.countries = countries;
      parts.push(`in ${countries.join(', ')}`);
    }
    if (programTypes.length) {
      filters.programTypes = programTypes;
      parts.push(programTypes.join(', '));
    }
    if (roundNames.length) {
      filters.roundNames = roundNames;
      parts.push(roundNames.join(', '));
    }
    if (month) {
      const range = monthRange(month, now);
      if (range) {
        filters.from = range.from;
        filters.to = range.to;
        parts.push(`in ${month[0].toUpperCase()}${month.slice(1)}`);
      }
    }

    // "past", "closed" and "last year" are the only ways to see expired rounds;
    // the default hides them because a closed deadline is not actionable.
    if (/\b(past|closed|expired|previous|last year)\b/.test(text)) {
      filters.includePast = true;
    }    return {
      kind: 'deadlines',
      filters,
      label: deadlineLabel(parts),
    };
  }
  // A single named school with no list-style wording - show that school.
  if (schools.length === 1) {
    return {
      kind: 'school-detail',
      schoolId: schools[0].id,
      slug: schools[0].slug,
      label: schools[0].name,
    };
  }

  if (regions.length || countries.length || programTypes.length || SCHOOL_LIST_WORDS.test(text)) {
    const filters: SchoolFilters = {};
    const parts: string[] = [];
    if (regions.length) {
      filters.regions = regions;
      parts.push(regions.join(', '));
    }
    if (countries.length) {
      filters.countries = countries;
      parts.push(countries.join(', '));
    }
    if (programTypes.length) {
      filters.programTypes = programTypes;
      parts.push(programTypes.join(', '));
    }
    return {
      kind: 'schools',
      filters,
      label: parts.length ? `Schools in ${parts.join(', ')}` : 'All schools',
    };
  }

  return {
    kind: 'unknown',
    label: `I could not turn "${raw.trim()}" into a search.`,
    suggestions: defaultSuggestions(vocab),
  };
}

/**
 * Example questions built from real vocabulary, so every suggestion offered
 * is one that will actually return rows.
 */
export function defaultSuggestions(vocab: IntentVocabulary): string[] {
  const out: string[] = ['Deadlines in January'];
  if (vocab.schools[0]) out.push(`${vocab.schools[0].name} deadlines`);
  if (vocab.regions[0]) out.push(`Schools in ${vocab.regions[0]}`);
  if (vocab.schools.length >= 2) {
    out.push(`Compare ${vocab.schools[0].name} vs ${vocab.schools[1].name}`);
  }
  return out;
}
