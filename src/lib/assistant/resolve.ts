/**
 * Intent -> database rows.
 *
 * The counterpart to `intent.ts`: that module decides *what to look up*, this
 * one looks it up. Both halves deliberately go through the same
 * `src/lib/queries/public.ts` functions the rest of the site uses, so the
 * assistant is physically incapable of showing a school, date or verification
 * badge that a normal page would not show. There is no second data path to
 * keep in sync and no cache that can drift.
 */
import {
  getDeadlines,
  getFilterFacets,
  getSchools,
  type DeadlineFilters,
} from '../queries/public';
import type { DeadlineRow, School } from '../types';
import type { Intent, IntentVocabulary } from './intent';

export type AnswerData =
  | { kind: 'deadlines'; rows: DeadlineRow[] }
  | { kind: 'schools'; schools: School[] }
  | { kind: 'school-detail'; school: School; rows: DeadlineRow[] }
  | { kind: 'compare'; schools: School[]; rows: DeadlineRow[] }
  | { kind: 'help' }
  | { kind: 'unknown'; suggestions: string[] };

/**
 * Builds the assistant's vocabulary from the database.
 *
 * Nothing here is hardcoded: adding a school in a new country makes that
 * country answerable immediately, and removing one makes it unanswerable.
 * That is the property that stops the assistant referring to data we do not
 * have.
 */
export async function loadVocabulary(): Promise<IntentVocabulary> {
  const [schools, facets] = await Promise.all([getSchools(), getFilterFacets()]);
  return {
    schools: schools.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      shortName: s.shortName,
    })),
    countries: facets.countries,
    regions: facets.regions,
    programTypes: facets.programTypes,
    roundNames: facets.roundNames,
  };
}

/** How many rows a single answer will show before pointing at a full page. */
export const ANSWER_LIMIT = 8;

/** Runs the query an intent describes. */
export async function resolveIntent(intent: Intent): Promise<AnswerData> {
  switch (intent.kind) {
    case 'deadlines': {
      const filters: DeadlineFilters = { ...intent.filters, limit: ANSWER_LIMIT };
      return { kind: 'deadlines', rows: await getDeadlines(filters) };
    }

    case 'schools': {
      const schools = await getSchools({ ...intent.filters, limit: ANSWER_LIMIT });
      return { kind: 'schools', schools };
    }

    case 'school-detail': {
      const [schools, rows] = await Promise.all([
        getSchools(),
        getDeadlines({ schoolIds: [intent.schoolId], sort: 'nearest' }),
      ]);
      const school = schools.find((s) => s.id === intent.schoolId);
      // The school was in the vocabulary a moment ago, so its absence means
      // it was unpublished mid-session. Treat that as "no answer" rather than
      // rendering a half-populated card.
      if (!school) return { kind: 'unknown', suggestions: [] };
      return { kind: 'school-detail', school, rows };
    }

    case 'compare': {
      const all = await getSchools();
      const schools = intent.slugs
        .map((slug) => all.find((s) => s.slug === slug))
        .filter((s): s is School => Boolean(s));
      if (schools.length < 2) return { kind: 'unknown', suggestions: [] };
      const rows = await getDeadlines({
        schoolIds: schools.map((s) => s.id),
        sort: 'school',
      });
      return { kind: 'compare', schools, rows };
    }

    case 'help':
      return { kind: 'help' };

    case 'unknown':
      return { kind: 'unknown', suggestions: intent.suggestions };
  }
}

/**
 * The destination for "see all" - always an existing page with the same
 * filters, so a conversation can be handed off to a shareable, linkable URL.
 */
export function answerHref(intent: Intent): string | null {
  switch (intent.kind) {
    case 'deadlines': {
      const params = new URLSearchParams();
      for (const region of intent.filters.regions ?? []) params.append('region', region);
      for (const country of intent.filters.countries ?? []) params.append('country', country);
      for (const type of intent.filters.programTypes ?? []) params.append('type', type);
      for (const round of intent.filters.roundNames ?? []) params.append('round', round);
      const qs = params.toString();
      return qs ? `/deadlines?${qs}` : '/deadlines';
    }
    case 'schools': {
      const params = new URLSearchParams();
      for (const region of intent.filters.regions ?? []) params.append('region', region);
      for (const country of intent.filters.countries ?? []) params.append('country', country);
      const qs = params.toString();
      return qs ? `/schools?${qs}` : '/schools';
    }
    case 'school-detail':
      return `/schools/${intent.slug}`;
    case 'compare':
      return `/compare?schools=${intent.slugs.join(',')}`;
    default:
      return null;
  }
}
