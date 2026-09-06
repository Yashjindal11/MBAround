import { describe, expect, it } from 'vitest';
import { clampDescription, formatTitle } from '../src/lib/seo';
import {
  breadcrumbSchema,
  faqSchema,
  itemListSchema,
  schoolSchema,
} from '../src/lib/structuredData';
import type { DeadlineRow, School } from '../src/lib/types';

const school: School = {
  id: 's1',
  name: 'INSEAD',
  slug: 'insead',
  shortName: 'INSEAD',
  description: 'The business school for the world.',
  country: 'France',
  region: 'Europe',
  state: null,
  city: 'Fontainebleau',
  websiteUrl: 'https://www.insead.edu',
  admissionsUrl: 'https://www.insead.edu/mba',
  logoUrl: null,
  imageUrl: null,
  isFeatured: false,
  isPublished: true,
  isVerified: false,
  displayOrder: 0,
} as School;

const row = (p: Partial<DeadlineRow>): DeadlineRow =>
  ({
    roundId: 'r1',
    roundName: 'Round 1',
    roundOrder: 1,
    deadline: null,
    decisionDate: null,
    isAnnounced: false,
    isVerified: false,
    sourceUrl: null,
    sourceName: null,
    lastVerified: null,
    notes: null,
    cycleId: 'c1',
    cycleName: '2026-27',
    programId: 'p1',
    programName: 'MBA',
    programType: 'One-year MBA',
    schoolId: 's1',
    schoolName: 'INSEAD',
    schoolSlug: 'insead',
    country: 'France',
    region: 'Europe',
    city: 'Fontainebleau',
    ...p,
  }) as DeadlineRow;

describe('formatTitle', () => {
  it('appends the site name when there is room', () => {
    expect(formatTitle('MBA Deadlines')).toBe('MBA Deadlines | MBAround');
  });

  it('drops the suffix rather than truncating the page’s own words', () => {
    const long = 'A Very Long Page Title That Already Fills The Entire Search Result';
    const out = formatTitle(long);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.startsWith('A Very Long Page Title')).toBe(true);
  });
});

describe('clampDescription', () => {
  it('leaves short descriptions untouched', () => {
    expect(clampDescription('Short and useful.')).toBe('Short and useful.');
  });

  it('collapses whitespace so markup indentation does not leak into snippets', () => {
    expect(clampDescription('a\n   b\t c')).toBe('a b c');
  });

  it('cuts on a word boundary and marks the elision', () => {
    const out = clampDescription('word '.repeat(60), 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/wo…$/);
  });
});

describe('schoolSchema', () => {
  it('omits fields the record does not have rather than emitting empty values', () => {
    const bare = { ...school, description: null, websiteUrl: null } as School;
    const out = schoolSchema(bare) as Record<string, unknown>;
    expect(out).not.toHaveProperty('description');
    expect(out).not.toHaveProperty('sameAs');
    expect(out.name).toBe('INSEAD');
  });

  it('never emits an offer for an unannounced round', () => {
    const out = schoolSchema(school, [
      row({ isAnnounced: false, deadline: null }),
    ]) as Record<string, unknown>;    // This is the core honesty guarantee: a null deadline must not become a
    // structured-data claim that a date exists.
    expect(out).not.toHaveProperty('offers');
  });

  it('never emits an offer for an announced round with no date', () => {
    const out = schoolSchema(school, [
      row({ isAnnounced: true, deadline: null }),
    ]) as Record<string, unknown>;
    expect(out).not.toHaveProperty('offers');
  });

  it('emits offers only for announced, dated rounds', () => {
    const out = schoolSchema(school, [
      row({ roundId: 'a', isAnnounced: true, deadline: '2026-09-17' }),
      row({ roundId: 'b', isAnnounced: false, deadline: null }),
    ]) as Record<string, unknown>;
    const offers = out.offers as { applicationDeadline: string }[];
    expect(offers).toHaveLength(1);
    expect(offers[0].applicationDeadline).toBe('2026-09-17');
  });

  it('builds an address from the parts that exist', () => {
    const out = schoolSchema(school) as Record<string, unknown>;
    const addr = out.address as Record<string, string>;
    expect(addr.addressLocality).toBe('Fontainebleau');
    expect(addr.addressCountry).toBe('France');
    expect(addr).not.toHaveProperty('addressRegion');
  });
});

describe('breadcrumbSchema', () => {
  it('numbers positions from 1 and resolves absolute URLs', () => {
    const out = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Schools', path: '/schools' },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(out.itemListElement[0].position).toBe(1);
    expect(out.itemListElement[1].position).toBe(2);
    expect(out.itemListElement[1].item).toMatch(/^https?:\/\/.+\/schools$/);
  });
});

describe('itemListSchema', () => {
  it('reports a count that matches the items emitted', () => {
    const items = [
      { name: 'A', path: '/schools/a' },
      { name: 'B', path: '/schools/b' },
    ];
    const out = itemListSchema(items, 'Schools') as {
      numberOfItems: number;
      itemListElement: unknown[];
    };
    expect(out.numberOfItems).toBe(2);
    expect(out.itemListElement).toHaveLength(2);
  });
});

describe('faqSchema', () => {
  it('wraps each answer in the shape Google expects', () => {
    const out = faqSchema([{ question: 'Q?', answer: 'A.' }]) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(out.mainEntity[0].name).toBe('Q?');
    expect(out.mainEntity[0].acceptedAnswer.text).toBe('A.');
  });
});
