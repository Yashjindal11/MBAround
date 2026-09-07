/**
 * Architectural guards for the assistant.
 *
 * The assistant's safety rests on one structural claim: it retrieves, it does
 * not generate. Every date, school name and round it shows was read from
 * Supabase by the same query functions the rest of the site uses.
 *
 * That claim is easy to state and easy to erode. Someone adding "just a
 * little" text generation, or calling an AI endpoint to make answers friendly,
 * would not be obviously wrong in review - but it would turn a reference tool
 * into something that states deadlines it has no evidence for. With 121 rounds
 * imported and none verified, a fluent wrong answer is entirely possible.
 *
 * These tests assert the source, so the boundary fails loudly rather than
 * eroding quietly. They are deliberately blunt: a legitimate future change
 * should have to edit this file and read the reasoning.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const intent = read('src/lib/assistant/intent.ts');
const resolve = read('src/lib/assistant/resolve.ts');
const ui = read('src/components/Assistant.tsx');

/**
 * Strips comments so the guards inspect executable code only.
 *
 * The distinction matters: comments naming real schools are how the tricky
 * cases stay understood - why "IE" must not match inside "Berkeley", why
 * "Europe" must not resolve to CEIBS. Those explanations are the record of
 * bugs found against live data and are worth more than the tidiness of
 * removing them. A hardcoded name in *code* is the actual defect.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

const intentCode = codeOnly(intent);
const resolveCode = codeOnly(resolve);
const uiCode = codeOnly(ui);
const allCode = [intentCode, resolveCode, uiCode].join('\n');

describe('the assistant retrieves, it never generates', () => {  it('calls no AI or completion endpoint', () => {
    // The whole point. An LLM asked "when is Wharton R2?" answers fluently
    // and specifically whether or not a date exists.
    const providers = [
      'openai', 'anthropic', 'gemini', 'cohere', 'mistral',
      'completions', 'chat/completions', 'workers-ai', '@cf/meta',
    ];
    for (const provider of providers) {
      expect(allCode.toLowerCase()).not.toContain(provider);
    }
  });
  it('makes no network call of its own', () => {
    // Data must arrive through the query layer, which applies RLS, the
    // published filter and the verification fields. A bare fetch would
    // bypass all three.
    expect(intentCode).not.toMatch(/\bfetch\s*\(/);
    expect(resolveCode).not.toMatch(/\bfetch\s*\(/);
    expect(uiCode).not.toMatch(/\bfetch\s*\(/);
  });

  it('reaches Supabase only through the shared query layer', () => {
    // No direct client access, so the assistant cannot query a table the
    // rest of the site does not, or skip is_published.
    expect(resolve).toMatch(/from '\.\.\/queries\/public'/);
    expect(resolveCode).not.toMatch(/from\s+['"]\.\.\/supabase['"]/);
    expect(intentCode).not.toContain('supabase');
  });

  it('never hardcodes a school, date or deadline', () => {
    // Vocabulary comes from the database. A literal name here would let the
    // assistant discuss a school we do not hold - or hold a stale one after
    // it is unpublished.
    //
    // Executable code only: comments naming real schools document bugs found
    // against live data and are deliberately kept.
    const isoDate = /\b20\d{2}-\d{2}-\d{2}\b/;
    expect(intentCode).not.toMatch(isoDate);
    expect(resolveCode).not.toMatch(isoDate);
    expect(uiCode).not.toMatch(isoDate);

    for (const name of ['Harvard', 'Wharton', 'INSEAD', 'Stanford', 'Kellogg']) {
      expect(allCode).not.toContain(name);
    }
  });

  it('builds its vocabulary from live queries', () => {
    expect(resolve).toContain('getSchools()');
    expect(resolve).toContain('getFilterFacets()');
  });
});

describe('the assistant reuses the site\'s own presentation', () => {
  it('renders rows with the shared cards rather than its own markup', () => {
    // Guarantees an unverified or undated round carries the same badge in
    // chat as it does on a page. A bespoke renderer would be free to omit
    // the caveat precisely where it matters most.
    expect(ui).toContain("from './Cards'");
    expect(ui).toMatch(/<DeadlineCard\b/);
    expect(ui).toMatch(/<SchoolCard\b/);
  });

  it('states its provenance to the user', () => {
    expect(ui).toContain('never generated');
  });

  it('offers a route back to a linkable page', () => {
    // A chat answer that cannot be shared or bookmarked is a dead end, and
    // an unauditable one.
    expect(resolve).toContain('export function answerHref');
    expect(ui).toContain('answerHref');
  });
});

describe('the assistant declines rather than guesses', () => {
  it('has an explicit unknown branch', () => {
    expect(intent).toContain("kind: 'unknown'");
  });

  it('renders nothing at all without a database', () => {
    // Answering "no deadlines" while disconnected is a factual claim we
    // cannot support; showing no assistant is honest.
    expect(ui).toContain('if (!isSupabaseConfigured) return null;');
  });
});
