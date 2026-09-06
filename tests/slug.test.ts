import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify, uniqueSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Harvard Business School')).toBe('harvard-business-school');
  });

  it('strips diacritics so URLs stay ASCII', () => {
    expect(slugify('Universidade de São Paulo')).toBe('universidade-de-sao-paulo');
    expect(slugify('Université PSL')).toBe('universite-psl');
    expect(slugify('Kellogg — Zürich')).toBe('kellogg-zurich');
  });

  it('handles ampersands as words', () => {
    expect(slugify('Carnegie Mellon & Tepper')).toBe('carnegie-mellon-and-tepper');
  });

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugify('  The Wharton School, U. Penn!  ')).toBe('the-wharton-school-u-penn');
    expect(slugify('IESE / Barcelona')).toBe('iese-barcelona');
  });

  it('always produces output matching the database constraint', () => {
    for (const name of [
      'Harvard Business School',
      'INSEAD',
      'HEC Paris',
      'Universidade de São Paulo',
      'Ludwig-Maximilians-Universität München',
      'Hong Kong UST Business School',
    ]) {
      expect(isValidSlug(slugify(name))).toBe(true);
    }
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when free', () => {
    expect(uniqueSlug('INSEAD', [])).toBe('insead');
  });

  it('suffixes on collision', () => {
    expect(uniqueSlug('INSEAD', ['insead'])).toBe('insead-2');
    expect(uniqueSlug('INSEAD', ['insead', 'insead-2'])).toBe('insead-3');
  });

  it('throws rather than emit an invalid slug', () => {
    expect(() => uniqueSlug('!!!', [])).toThrow();
  });
});

describe('isValidSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidSlug('harvard-business-school')).toBe(true);
    expect(isValidSlug('insead')).toBe(true);
  });

  it('rejects malformed slugs', () => {
    expect(isValidSlug('Harvard')).toBe(false);
    expect(isValidSlug('double--hyphen')).toBe(false);
    expect(isValidSlug('-leading')).toBe(false);
    expect(isValidSlug('trailing-')).toBe(false);
    expect(isValidSlug('has space')).toBe(false);
  });
});
