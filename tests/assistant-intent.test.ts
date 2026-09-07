/**
 * Tests for the assistant's intent parser.
 *
 * The parser is the assistant's entire safety boundary, so these tests are
 * less about convenience features and more about two properties:
 *
 *   1. It never invents a school, date or filter value. Everything it emits
 *      is drawn from the vocabulary handed to it, which comes from the
 *      database.
 *   2. It says "unknown" rather than guessing. A wrong-but-confident answer
 *      is the failure mode this product exists to prevent, and a chat UI is
 *      trusted more than a page, not less.
 *
 * Dates are injected everywhere. A test that depends on the real clock passes
 * until January and then fails for reasons unrelated to the code.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultSuggestions,
  matchSchools,
  monthRange,
  normalise,
  parseIntent,
  type IntentVocabulary,
} from '../src/lib/assistant/intent';

/** A deliberately awkward vocabulary: overlapping names, an acronym, accents. */
const VOCAB: IntentVocabulary = {
  schools: [
    { id: 's1', name: 'Harvard Business School', slug: 'harvard-business-school', shortName: 'HBS' },
    { id: 's2', name: 'The Wharton School', slug: 'wharton', shortName: 'Wharton' },
    { id: 's3', name: 'London Business School', slug: 'london-business-school', shortName: 'LBS' },
    { id: 's4', name: 'IE Business School', slug: 'ie-business-school', shortName: 'IE' },
    { id: 's5', name: 'INSEAD', slug: 'insead', shortName: null },
  ],
  countries: ['United States', 'United Kingdom', 'France', 'Spain'],
  regions: ['North America', 'Europe', 'Asia'],
  programTypes: ['Full-Time MBA', 'Executive MBA'],
  roundNames: ['Round 1', 'Round 2', 'Rolling Admissions'],
};

// September 2026, matching the product's live cycle.
const NOW = new Date(Date.UTC(2026, 8, 8, 12));

describe('normalise', () => {
  it('strips punctuation but keeps word boundaries', () => {
    expect(normalise("What's HBS's deadline?")).toBe('what s hbs s deadline');
  });

  it('collapses whitespace', () => {
    expect(normalise('  round   1  ')).toBe('round 1');
  });

  it('preserves hyphens so hyphenated programme types still match', () => {
    expect(normalise('Full-Time MBA')).toBe('full-time mba');
  });
});

describe('matchSchools', () => {
  it('matches a full name', () => {
    expect(matchSchools('Harvard Business School deadlines', VOCAB).map((s) => s.id)).toEqual(['s1']);
  });

  it('matches an acronym', () => {
    expect(matchSchools('when is HBS due', VOCAB).map((s) => s.id)).toEqual(['s1']);
  });

  it('matches a slug written with spaces', () => {
    expect(matchSchools('london business school', VOCAB).map((s) => s.id)).toEqual(['s3']);
  });

  it('is case insensitive', () => {
    expect(matchSchools('INSEAD', VOCAB).map((s) => s.id)).toEqual(['s5']);
    expect(matchSchools('insead', VOCAB).map((s) => s.id)).toEqual(['s5']);
  });

  it('does NOT match an acronym buried inside another word', () => {
    // The defect being prevented: a bare `includes('ie')` matches "Berkeley",
    // "review" and "studies", returning IE Business School for a question
    // that never mentioned it. The user gets a real school and a real
    // deadline - just not the one they asked about, which is unreportable.
    expect(matchSchools('berkeley', VOCAB)).toHaveLength(0);
    expect(matchSchools('I would like to review my studies', VOCAB)).toHaveLength(0);
  });

  it('matches IE when it stands alone as a word', () => {
    expect(matchSchools('IE deadlines', VOCAB).map((s) => s.id)).toEqual(['s4']);
  });

  it('finds two schools in a comparison', () => {
    expect(matchSchools('HBS vs Wharton', VOCAB).map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });

  it('returns each school once even when name and acronym both appear', () => {
    expect(matchSchools('Harvard Business School (HBS)', VOCAB)).toHaveLength(1);
  });
  it('returns nothing for a school that is not in the vocabulary', () => {
    // Stanford is absent, so the parser must not fabricate it.
    expect(matchSchools('Stanford GSB deadlines', VOCAB)).toHaveLength(0);
  });

  it('matches the shorthand people actually type, not just the stored name', () => {
    // Found by probing the live database: the row is "Berkeley Haas School of
    // Business", but nobody types that. Matching only full name / short name
    // / slug missed it entirely - a false negative, which is invisible
    // because the assistant just answers something broader instead.
    const vocab: IntentVocabulary = {
      ...VOCAB,
      schools: [
        { id: 'b1', name: 'Berkeley Haas School of Business', slug: 'berkeley-haas', shortName: 'Berkeley Haas' },
      ],
    };
    expect(matchSchools('when is berkeley due', vocab).map((s) => s.id)).toEqual(['b1']);
  });

  it('ignores words generic enough to name half the database', () => {
    // "business school" identifies nobody; treating it as a match would
    // answer a question the user never asked.
    expect(matchSchools('tell me about business school', VOCAB)).toHaveLength(0);
    expect(matchSchools('which university is best', VOCAB)).toHaveLength(0);
  });

  it('never lets a place name act as a school shorthand', () => {
    // Regression found against live data: "Europe" is unique to "China Europe
    // International Business School", so token matching resolved "schools in
    // Europe" to CEIBS. Geography must always beat a substring coincidence.
    const vocab: IntentVocabulary = {
      ...VOCAB,
      schools: [
        { id: 'c1', name: 'China Europe International Business School', slug: 'ceibs', shortName: 'CEIBS' },
      ],
      regions: ['Europe', 'Asia'],
    };
    expect(matchSchools('schools in Europe', vocab)).toHaveLength(0);
    expect(parseIntent('schools in Europe', vocab, NOW).kind).toBe('schools');
    // The school itself must still be reachable by its real name.
    expect(matchSchools('CEIBS', vocab).map((s) => s.id)).toEqual(['c1']);
  });
  it('does not use an ambiguous token that two schools share', () => {
    // "Melbourne" belongs to two rows, so it must resolve to neither rather
    // than to whichever happens to sort first. Note the slugs deliberately
    // differ from the token: an exact slug match is a legitimate full-name
    // hit and should still win.
    const vocab: IntentVocabulary = {
      ...VOCAB,
      schools: [
        { id: 'x1', name: 'Melbourne Business School', slug: 'melbourne-business-school', shortName: null },
        { id: 'x2', name: 'Melbourne Graduate School', slug: 'melbourne-graduate-school', shortName: null },
      ],
    };
    expect(matchSchools('melbourne', vocab)).toHaveLength(0);
    // Either school is still reachable by its full name.
    expect(matchSchools('Melbourne Business School', vocab).map((s) => s.id)).toEqual(['x1']);
  });
});

describe('monthRange', () => {
  it('resolves a future month within the same year', () => {
    expect(monthRange('december', NOW)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('rolls a past month forward to the next year', () => {
    // Asked in September, "January" means the January that is coming. The
    // alternative silently returns an empty range for a perfectly good
    // question.
    expect(monthRange('january', NOW)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
  });

  it('treats the current month as current, not next year', () => {
    expect(monthRange('september', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('handles February in a leap year', () => {
    expect(monthRange('february', new Date(Date.UTC(2028, 0, 5, 12)))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });

  it('returns null for a non-month', () => {
    expect(monthRange('smarch', NOW)).toBeNull();
  });
});

describe('parseIntent - deadlines', () => {
  it('scopes deadlines to a named school', () => {
    const intent = parseIntent('HBS deadlines', VOCAB, NOW);
    expect(intent.kind).toBe('deadlines');
    if (intent.kind !== 'deadlines') return;
    expect(intent.filters.schoolIds).toEqual(['s1']);
  });
  it('reads a month into a date range', () => {
    const intent = parseIntent('what is due in January', VOCAB, NOW);
    expect(intent.kind).toBe('deadlines');
    if (intent.kind !== 'deadlines') return;
    expect(intent.filters.from).toBe('2027-01-01');
    expect(intent.filters.to).toBe('2027-01-31');
  });

  it('does not double up prepositions in the label', () => {
    // Rendered as "Deadlines for in January" before this, which reads as the
    // string-concatenation bug it was.
    const intent = parseIntent('deadlines in January', VOCAB, NOW);
    expect(intent.label).toBe('Deadlines in January');
  });

  it('names the school in the label when one is given', () => {
    const intent = parseIntent('HBS deadlines', VOCAB, NOW);
    expect(intent.label).toBe('Deadlines for Harvard Business School');
  });

  it('combines a school and a round name', () => {
    const intent = parseIntent('Wharton Round 2 deadline', VOCAB, NOW);
    expect(intent.kind).toBe('deadlines');
    if (intent.kind !== 'deadlines') return;
    expect(intent.filters.schoolIds).toEqual(['s2']);
    expect(intent.filters.roundNames).toEqual(['Round 2']);
  });

  it('hides past deadlines by default', () => {
    const intent = parseIntent('deadlines in Europe', VOCAB, NOW);
    if (intent.kind !== 'deadlines') throw new Error('expected deadlines');
    expect(intent.filters.includePast).toBeUndefined();
  });

  it('includes past deadlines only when explicitly asked', () => {
    const intent = parseIntent('show closed deadlines for HBS', VOCAB, NOW);
    if (intent.kind !== 'deadlines') throw new Error('expected deadlines');
    expect(intent.filters.includePast).toBe(true);
  });

  it('sorts by nearest so an undated round cannot lead', () => {
    const intent = parseIntent('upcoming deadlines', VOCAB, NOW);
    if (intent.kind !== 'deadlines') throw new Error('expected deadlines');
    expect(intent.filters.sort).toBe('nearest');
  });

  it('only emits filter values drawn from the vocabulary', () => {
    // The anti-hallucination property, asserted directly.
    const intent = parseIntent('deadlines in Europe for Full-Time MBA', VOCAB, NOW);
    if (intent.kind !== 'deadlines') throw new Error('expected deadlines');
    for (const region of intent.filters.regions ?? []) {
      expect(VOCAB.regions).toContain(region);
    }
    for (const type of intent.filters.programTypes ?? []) {
      expect(VOCAB.programTypes).toContain(type);
    }
  });
});

describe('parseIntent - other kinds', () => {  it('recognises a comparison of two schools', () => {
    const intent = parseIntent('compare HBS vs Wharton', VOCAB, NOW);
    expect(intent.kind).toBe('compare');
    if (intent.kind !== 'compare') return;
    expect(intent.slugs.sort()).toEqual(['harvard-business-school', 'wharton']);
  });

  it('keeps schools in the order the user wrote them', () => {
    // Matching tries longest names first, so match order is not reading
    // order. "compare HBS vs INSEAD" rendered as "Comparing INSEAD and
    // Harvard Business School", which reads as though it misheard.
    const intent = parseIntent('compare HBS vs INSEAD', VOCAB, NOW);
    if (intent.kind !== 'compare') throw new Error('expected compare');
    expect(intent.slugs).toEqual(['harvard-business-school', 'insead']);
    expect(intent.label).toBe('Comparing Harvard Business School and INSEAD');
  });

  it('does not treat "vs" as a comparison when only one school is named', () => {
    // "Wharton vs the rest" cannot be compared against nothing; falling back
    // to the school page is more useful than an empty comparison.
    const intent = parseIntent('Wharton vs the rest', VOCAB, NOW);
    expect(intent.kind).toBe('school-detail');
  });

  it('shows a school page for a bare school name', () => {
    const intent = parseIntent('INSEAD', VOCAB, NOW);
    expect(intent.kind).toBe('school-detail');
    if (intent.kind !== 'school-detail') return;
    expect(intent.slug).toBe('insead');
  });

  it('lists schools for a region query', () => {
    const intent = parseIntent('schools in Europe', VOCAB, NOW);
    expect(intent.kind).toBe('schools');
    if (intent.kind !== 'schools') return;
    expect(intent.filters.regions).toEqual(['Europe']);
  });

  it('answers a greeting with help rather than a search', () => {
    expect(parseIntent('hi', VOCAB, NOW).kind).toBe('help');
    expect(parseIntent('help', VOCAB, NOW).kind).toBe('help');
  });
});

describe('parseIntent - refusing to guess', () => {
  it('returns unknown for gibberish', () => {
    const intent = parseIntent('asdfgh qwerty', VOCAB, NOW);
    expect(intent.kind).toBe('unknown');
  });

  it('returns unknown for an empty question', () => {
    expect(parseIntent('   ', VOCAB, NOW).kind).toBe('unknown');
  });

  it('does not answer a question about a school we do not hold', () => {
    // The single most important test here. We have no Stanford row, so the
    // only honest response is that we cannot answer - never a plausible date.
    const intent = parseIntent('Stanford GSB deadline', VOCAB, NOW);
    if (intent.kind === 'deadlines') {
      // It may fall through to a generic deadline search, but it must NOT
      // claim to have scoped that search to Stanford.
      expect(intent.filters.schoolIds).toBeUndefined();
    } else {
      expect(intent.kind).toBe('unknown');
    }
  });

  it('offers suggestions when it cannot parse', () => {
    const intent = parseIntent('asdfgh', VOCAB, NOW);
    if (intent.kind !== 'unknown') throw new Error('expected unknown');
    expect(intent.suggestions.length).toBeGreaterThan(0);
  });
});

describe('defaultSuggestions', () => {
  it('builds examples from real vocabulary, never invented names', () => {
    const suggestions = defaultSuggestions(VOCAB);
    const named = suggestions.filter((s) => s.includes('Harvard') || s.includes('Wharton'));
    expect(named.length).toBeGreaterThan(0);
  });

  it('degrades gracefully with an empty database', () => {
    // An empty vocabulary must not throw and must not name a school.
    const empty: IntentVocabulary = {
      schools: [], countries: [], regions: [], programTypes: [], roundNames: [],
    };
    expect(() => defaultSuggestions(empty)).not.toThrow();
    expect(defaultSuggestions(empty).length).toBeGreaterThan(0);
  });
});
