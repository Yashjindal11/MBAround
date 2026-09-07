/**
 * Tests for the assistant's resolver.
 *
 * The parser decides what to look up; this module looks it up. The property
 * worth proving here is that it is a thin pass-through to the site's normal
 * query layer - no second data path, no invented rows, no silent fallback to
 * something plausible when a query returns nothing.
 *
 * The query layer is mocked so these stay fast and offline. What is asserted
 * is the *contract with that layer*: which functions are called and with
 * which filters. A test that hit Supabase would be testing the network.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeadlineRow, School } from '../src/lib/types';

const mocks = vi.hoisted(() => ({
  getDeadlines: vi.fn(),
  getSchools: vi.fn(),
  getFilterFacets: vi.fn(),
}));

vi.mock('../src/lib/queries/public', () => ({
  getDeadlines: mocks.getDeadlines,
  getSchools: mocks.getSchools,
  getFilterFacets: mocks.getFilterFacets,
}));

const {
  ANSWER_LIMIT,
  answerHref,
  loadVocabulary,
  resolveIntent,
} = await import('../src/lib/assistant/resolve');

const SCHOOL: School = {
  id: 's1',
  name: 'Harvard Business School',
  slug: 'harvard-business-school',
  shortName: 'HBS',
  description: null,
  country: 'United States',
  region: 'North America',
  state: 'MA',
  city: 'Boston',
  websiteUrl: null,
  admissionsUrl: null,
  logoUrl: null,
  imageUrl: null,
  isFeatured: false,
  isPublished: true,
  isVerified: false,
  displayOrder: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const SCHOOL_2: School = { ...SCHOOL, id: 's2', name: 'The Wharton School', slug: 'wharton', shortName: 'Wharton' };

const ROW = { roundId: 'r1', schoolId: 's1', deadline: null } as unknown as DeadlineRow;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSchools.mockResolvedValue([SCHOOL, SCHOOL_2]);
  mocks.getDeadlines.mockResolvedValue([ROW]);
  mocks.getFilterFacets.mockResolvedValue({
    countries: ['United States'],
    regions: ['North America'],
    programTypes: ['Full-Time MBA'],
    cycleNames: ['2026-27'],
    roundNames: ['Round 1'],
  });
});

describe('loadVocabulary', () => {
  it('builds the vocabulary from the database, never a hardcoded list', () => {
    // This is what stops the assistant referring to schools we do not hold.
    return loadVocabulary().then((vocab) => {
      expect(mocks.getSchools).toHaveBeenCalled();
      expect(mocks.getFilterFacets).toHaveBeenCalled();
      expect(vocab.schools.map((s) => s.id)).toEqual(['s1', 's2']);
      expect(vocab.regions).toEqual(['North America']);
    });
  });

  it('carries the short name through so acronyms are matchable', async () => {
    const vocab = await loadVocabulary();
    expect(vocab.schools[0].shortName).toBe('HBS');
  });
});

describe('resolveIntent - deadlines', () => {
  it('passes the parsed filters straight to getDeadlines', async () => {
    await resolveIntent({
      kind: 'deadlines',
      filters: { regions: ['North America'], sort: 'nearest' },
      label: '',
    });
    expect(mocks.getDeadlines).toHaveBeenCalledWith(
      expect.objectContaining({ regions: ['North America'], sort: 'nearest' }),
    );
  });

  it('caps the number of rows shown in a chat answer', async () => {
    await resolveIntent({ kind: 'deadlines', filters: {}, label: '' });
    expect(mocks.getDeadlines).toHaveBeenCalledWith(
      expect.objectContaining({ limit: ANSWER_LIMIT }),
    );
  });

  it('returns an empty result rather than inventing rows', async () => {
    // The failure being prevented: substituting something plausible when the
    // database has nothing. An empty answer is a true answer.
    mocks.getDeadlines.mockResolvedValue([]);
    const data = await resolveIntent({ kind: 'deadlines', filters: {}, label: '' });
    expect(data).toEqual({ kind: 'deadlines', rows: [] });
  });

  it('preserves a null deadline instead of substituting a date', async () => {
    const data = await resolveIntent({ kind: 'deadlines', filters: {}, label: '' });
    if (data.kind !== 'deadlines') throw new Error('expected deadlines');
    expect(data.rows[0].deadline).toBeNull();
  });
});

describe('resolveIntent - school detail', () => {
  it('returns the school and its rounds', async () => {
    const data = await resolveIntent({
      kind: 'school-detail',
      schoolId: 's1',
      slug: 'harvard-business-school',
      label: '',
    });
    if (data.kind !== 'school-detail') throw new Error('expected school-detail');
    expect(data.school.id).toBe('s1');
    expect(data.rows).toHaveLength(1);
  });

  it('degrades to unknown when the school vanished mid-session', async () => {
    // Unpublishing a school between vocabulary load and question must not
    // produce a half-rendered card built from a stale name.
    mocks.getSchools.mockResolvedValue([]);
    const data = await resolveIntent({
      kind: 'school-detail',
      schoolId: 's1',
      slug: 'harvard-business-school',
      label: '',
    });
    expect(data.kind).toBe('unknown');
  });
});

describe('resolveIntent - compare', () => {
  it('resolves both schools by slug', async () => {
    const data = await resolveIntent({
      kind: 'compare',
      slugs: ['harvard-business-school', 'wharton'],
      label: '',
    });
    if (data.kind !== 'compare') throw new Error('expected compare');
    expect(data.schools.map((s) => s.slug)).toEqual(['harvard-business-school', 'wharton']);
  });

  it('refuses a comparison when a slug does not resolve', async () => {
    const data = await resolveIntent({
      kind: 'compare',
      slugs: ['harvard-business-school', 'stanford-gsb'],
      label: '',
    });
    expect(data.kind).toBe('unknown');
  });
});

describe('resolveIntent - non-query intents', () => {
  it('does not touch the database for help', async () => {
    const data = await resolveIntent({ kind: 'help', label: '' });
    expect(data).toEqual({ kind: 'help' });
    expect(mocks.getDeadlines).not.toHaveBeenCalled();
    expect(mocks.getSchools).not.toHaveBeenCalled();
  });

  it('passes suggestions through for unknown', async () => {
    const data = await resolveIntent({
      kind: 'unknown',
      label: '',
      suggestions: ['Deadlines in January'],
    });
    if (data.kind !== 'unknown') throw new Error('expected unknown');
    expect(data.suggestions).toEqual(['Deadlines in January']);
  });
});

describe('answerHref', () => {
  it('links a deadline answer to the real deadlines page with its filters', () => {
    // Every conversation must be escapable into a shareable URL; a chat
    // answer that cannot be linked to is a dead end.
    const href = answerHref({
      kind: 'deadlines',
      filters: { regions: ['Europe'] },
      label: '',
    });
    expect(href).toBe('/deadlines?region=Europe');
  });

  it('encodes multi-word filter values', () => {
    const href = answerHref({
      kind: 'deadlines',
      filters: { regions: ['North America'] },
      label: '',
    });
    expect(href).toBe('/deadlines?region=North+America');
  });

  it('links a school answer to that school page', () => {
    expect(
      answerHref({ kind: 'school-detail', schoolId: 's1', slug: 'wharton', label: '' }),
    ).toBe('/schools/wharton');
  });

  it('links a comparison to the compare page', () => {
    expect(answerHref({ kind: 'compare', slugs: ['a', 'b'], label: '' })).toBe(
      '/compare?schools=a,b',
    );
  });

  it('offers no link for help or unknown', () => {
    expect(answerHref({ kind: 'help', label: '' })).toBeNull();
    expect(answerHref({ kind: 'unknown', label: '', suggestions: [] })).toBeNull();
  });
});
