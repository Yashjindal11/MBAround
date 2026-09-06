import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { getDeadlines, getSchools } from '../lib/queries/public';
import { DEMO_BANNER, demoDeadlineRows, demoSchools, isDemoRequested } from '../lib/demoData';
import type { DeadlineRow, School } from '../lib/types';

/**
 * Loads the rows every timeline layout needs, from Supabase or — behind an
 * explicit `?demo=1` — from in-memory fixtures.
 *
 * Shared so the three layouts differ only in presentation. If each page fetched
 * its own way they would drift, and a layout could end up flattering itself
 * with data the others do not get.
 *
 * Demo mode exists because `application_rounds` is empty: a layout cannot be
 * judged against nothing. It never writes to the database, and the fixtures are
 * openly fictional. See `src/lib/demoData.ts`.
 */
export interface TimelineData {
  schools: School[];
  rows: DeadlineRow[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
  /** True when fixtures are being shown. Pages MUST render the banner. */
  isDemo: boolean;
  demoNotice: string;
}

export function useTimelineData(): TimelineData {
  const { search } = useLocation();
  const demo = isDemoRequested(search);

  const {
    data: schools,
    loading: schoolsLoading,
    error: schoolsError,
    reload,
  } = useAsync(() => getSchools(), []);
  const {
    data: rows,
    loading: rowsLoading,
    error: rowsError,
  } = useAsync(() => getDeadlines({ includePast: true }), []);

  // Fixtures are built once per mount, not per render: they are derived from
  // `new Date()`, so rebuilding them on every render would make dates jitter.
  const fixtures = useMemo(
    () => (demo ? { schools: demoSchools(), rows: demoDeadlineRows() } : null),
    [demo],
  );

  if (fixtures) {
    return {
      schools: fixtures.schools,
      rows: fixtures.rows,
      loading: false,
      error: null,
      reload: () => {},
      isDemo: true,
      demoNotice: DEMO_BANNER,
    };
  }

  return {
    schools: schools ?? [],
    rows: rows ?? [],
    loading: schoolsLoading || rowsLoading,
    error: schoolsError ?? rowsError,
    reload,
    isDemo: false,
    demoNotice: DEMO_BANNER,
  };
}
