/**
 * Validates the 2026-27 deadline seed against schools.json and against the
 * CHECK constraints in migration 0001, before any SQL reaches the database.
 *
 * Each test corresponds to a way this import could put wrong data in front of
 * a user:
 *
 *  - A slug or programme name that does not resolve means a school silently
 *    gets no deadlines, and nobody notices because absence looks like "not
 *    announced yet".
 *  - A decision date before its deadline violates a CHECK and would abort the
 *    transaction partway through.
 *  - A date on an unannounced round violates the constraint that exists
 *    specifically to make fabricated data structurally impossible.
 *  - An estimated date slipping through would be indistinguishable from a
 *    real one once stored.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CYCLES, CYCLE_NAME, SOURCE_NAME } from '../scripts/data/deadlines-2026-27.js';

const ROOT = process.cwd();

interface SchoolSeed {
  name: string;
  slug: string;
  programs: { name: string }[];
}

const { schools } = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts', 'data', 'schools.json'), 'utf8'),
) as { schools: SchoolSeed[] };

const bySlug = new Map(schools.map((s) => [s.slug, s]));

describe('2026-27 deadline seed: resolves against real schools', () => {
  it('every school slug exists in schools.json', () => {
    for (const c of CYCLES) {
      expect(bySlug.has(c.schoolSlug), `unknown school slug: ${c.schoolSlug}`).toBe(true);
    }
  });

  it('every programme name exists for its school', () => {
    // The SQL joins on programme name, so a mismatch resolves to zero cycles
    // and that school quietly gets nothing.
    for (const c of CYCLES) {
      const names = bySlug.get(c.schoolSlug)?.programs.map((p) => p.name) ?? [];
      expect(names, `${c.schoolSlug} has no programme "${c.programName}"`).toContain(c.programName);
    }
  });

  it('does not import the same school and programme twice', () => {
    const seen = new Set<string>();
    for (const c of CYCLES) {
      const key = `${c.schoolSlug}::${c.programName}`;
      expect(seen.has(key), `duplicate cycle: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe('2026-27 deadline seed: satisfies schema constraints', () => {
  it('never places a decision date before its deadline', () => {
    // Mirrors rounds_decision_after_deadline.
    for (const c of CYCLES) {
      for (const r of c.rounds) {
        if (r.deadline && r.decisionDate) {
          expect(
            r.decisionDate >= r.deadline,
            `${c.schoolSlug} ${r.name}: decision ${r.decisionDate} precedes ${r.deadline}`,
          ).toBe(true);
        }
      }
    }
  });

  it('never attaches a decision date to a round with no deadline', () => {
    // Mirrors rounds_unannounced_has_no_dates: the emitter derives
    // is_announced from `deadline is not null`, so a decision date without a
    // deadline would produce an unannounced row carrying a date.
    for (const c of CYCLES) {
      for (const r of c.rounds) {
        if (!r.deadline) {
          expect(r.decisionDate, `${c.schoolSlug} ${r.name}: decision without deadline`).toBe(null);
        }
      }
    }
  });

  it('uses unique round names within a cycle', () => {
    // The on-conflict target is (application_cycle_id, name); duplicates
    // inside one cycle would collapse into a single row.
    for (const c of CYCLES) {
      const names = c.rounds.map((r) => r.name);
      expect(new Set(names).size, `${c.schoolSlug} has duplicate round names`).toBe(names.length);
    }
  });

  it('emits only well-formed, real calendar dates', () => {
    for (const c of CYCLES) {
      for (const r of c.rounds) {
        for (const d of [r.deadline, r.decisionDate]) {
          if (d === null) continue;
          expect(d, `${c.schoolSlug} ${r.name}: malformed date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          // Catches 2026-02-30, which the regex alone accepts.
          expect(new Date(d + 'T12:00:00Z').toISOString().slice(0, 10)).toBe(d);
        }
      }
    }
  });

  it('keeps every date inside the cycle it claims to describe', () => {
    // A 2026-27 cycle should not carry a 2025 or 2028 date; that would be a
    // transcription slip rather than a real deadline.
    for (const c of CYCLES) {
      for (const r of c.rounds) {
        for (const d of [r.deadline, r.decisionDate]) {
          if (d === null) continue;
          const year = Number(d.slice(0, 4));
          expect(year, `${c.schoolSlug} ${r.name}: ${d} outside 2026-27`).toBeGreaterThanOrEqual(
            2026,
          );
          expect(year).toBeLessThanOrEqual(2027);
        }
      }
    }
  });
});

describe('2026-27 deadline seed: refuses to invent data', () => {
  it('carries no estimated dates', () => {
    // The source marked estimates "(Est)". An estimate is indistinguishable
    // from a real date once stored, and someone will plan around it.
    const blob = JSON.stringify(CYCLES);
    expect(blob).not.toMatch(/\(Est\)/i);
    expect(blob).not.toMatch(/estimated/i);
  });

  it('never claims verification, because nothing here was verified', () => {
    // Typed in by hand, not read off an official page. With no source_url,
    // no row is entitled to is_verified.
    const blob = JSON.stringify(CYCLES);
    expect(blob).not.toMatch(/sourceUrl/i);
    expect(blob).not.toMatch(/isVerified/i);
    expect(SOURCE_NAME).toMatch(/pending verification/i);
  });

  it('targets a single named cycle rather than assuming one', () => {
    expect(CYCLE_NAME).toBe('2026-27');
  });

  it('does not assume a fixed R1/R2/R3 structure', () => {
    // Real structures here include Early Action, Consortium rounds, dated
    // HEC deadlines and rolling admissions.
    const shapes = CYCLES.map((c) => c.rounds.map((r) => r.name).join('|'));
    const plainThree = shapes.filter((s) => s === 'Round 1|Round 2|Round 3').length;
    expect(plainThree).toBeLessThan(CYCLES.length);

    const names = CYCLES.flatMap((c) => c.rounds.map((r) => r.name));
    expect(names.some((n) => !/^Round \d$/.test(n))).toBe(true);
  });

  it('records a rolling-admissions round with no date at all', () => {
    // "Rolling" is a real fact worth storing; it just has no deadline.
    const ie = CYCLES.find((c) => c.schoolSlug === 'ie-business-school');
    expect(ie).toBeDefined();
    expect(ie!.rounds[0].deadline).toBe(null);
    expect(ie!.rounds[0].decisionDate).toBe(null);
  });
});
