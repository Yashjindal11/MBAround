import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  DEMO_BANNER,
  demoDeadlineRows,
  demoSchools,
  isDemoRequested,
} from '../src/lib/demoData';

/**
 * Demo fixtures exist so the timeline layouts can be evaluated while
 * `application_rounds` is empty. The whole reason they are safe is that they
 * are confined to the browser and clearly labelled.
 *
 * These tests defend that confinement. The fixtures themselves are cosmetic;
 * the containment is not, because a fixture that reached Supabase would be
 * indistinguishable from a real deadline for a real school.
 */

const ROOT = process.cwd();
const NOW = new Date('2026-09-07T12:00:00Z');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('demo fixtures — containment', () => {
  it('is never imported by anything that writes to Supabase', () => {
    // scripts/ contains the seeders and emitters. If demo data were reachable
    // from there it could be written to the database or the sitemap.
    const scripts = walk(path.join(ROOT, 'scripts'));
    const offenders = scripts.filter((f) =>
      /demoData|demo-data/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('is only imported by timeline code, never by queries or admin', () => {
    const src = walk(path.join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f));
    const importers = src.filter((f) => {
      if (f.endsWith(path.join('lib', 'demoData.ts'))) return false;
      return /from '.*demoData'/.test(readFileSync(f, 'utf8'));
    });

    // Only the shared timeline hook should reach for fixtures. Pages go
    // through it, so a new page cannot quietly acquire demo data.
    expect(importers.map((f) => path.basename(f)).sort()).toEqual([
      'useTimelineData.ts',
    ]);
  });

  it('never reaches the admin write path', () => {
    const adminQueries = readFileSync(
      path.join(ROOT, 'src', 'lib', 'queries', 'admin.ts'),
      'utf8',
    );
    expect(adminQueries).not.toMatch(/demo/i);
  });

  it('is off unless explicitly requested', () => {
    expect(isDemoRequested('')).toBe(false);
    expect(isDemoRequested('?foo=1')).toBe(false);
    // Guard against a truthy-ish value switching it on by accident.
    expect(isDemoRequested('?demo=0')).toBe(false);
    expect(isDemoRequested('?demo=true')).toBe(false);
    expect(isDemoRequested('?demo=1')).toBe(true);
  });

  it('carries a warning that names the data as not real', () => {
    expect(DEMO_BANNER).toMatch(/fictional|sample/i);
    expect(DEMO_BANNER).toMatch(/not stored in the database/i);
  });
});

describe('demo fixtures — shape', () => {
  const rows = demoDeadlineRows(NOW);

  it('uses school names that cannot be mistaken for real ones', () => {
    const real = /harvard|stanford|wharton|insead|kellogg|booth|columbia|mit|iim/i;
    for (const row of rows) {
      expect(row.schoolName).not.toMatch(real);
    }
  });

  it('marks every demo school slug so links can be suppressed', () => {
    // v3 links school names to /schools/:slug. A demo slug resolves to
    // nothing, so pages must be able to detect one.
    for (const school of demoSchools(NOW)) {
      expect(school.slug.startsWith('demo-')).toBe(true);
    }
    for (const row of rows) {
      expect(row.schoolSlug.startsWith('demo-')).toBe(true);
    }
  });

  it('never marks an unannounced round as verified', () => {
    // The core data-integrity rule: no date means nothing to verify.
    for (const row of rows) {
      if (!row.deadline) {
        expect(row.isAnnounced).toBe(false);
        expect(row.isVerified).toBe(false);
        expect(row.lastVerified).toBeNull();
      }
    }
  });

  it('keeps isAnnounced consistent with the presence of a deadline', () => {
    for (const row of rows) {
      expect(row.isAnnounced).toBe(row.deadline !== null);
    }
  });

  it('exercises past, present and future so layouts cannot look one-sided', () => {
    const days = rows
      .filter((r) => r.deadline)
      .map((r) => Math.round((Date.parse(r.deadline!) - Date.parse('2026-09-07')) / 86_400_000));

    expect(days.some((d) => d < 0)).toBe(true);
    expect(days.some((d) => d === 0)).toBe(true);
    expect(days.some((d) => d > 90)).toBe(true);
  });

  it('includes unannounced rounds, which are the case most easily dropped', () => {
    expect(rows.filter((r) => !r.deadline).length).toBeGreaterThan(0);
  });

  it('does not assume a three-round R1/R2/R3 structure', () => {
    const names = new Set(rows.map((r) => r.roundName));
    // A "Stage" and a single-window programme both exist, so any view that
    // hardcodes round vocabulary or count will visibly break here.
    expect([...names].some((n) => n.startsWith('Stage'))).toBe(true);
    expect(names.has('Common Application')).toBe(true);

    const perProgram = new Map<string, number>();
    for (const r of rows) perProgram.set(r.programId, (perProgram.get(r.programId) ?? 0) + 1);
    const counts = [...perProgram.values()];
    expect(counts).toContain(1);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });
  it('produces at least one same-day collision across schools', () => {
    // v3 warns about these explicitly. Without one in the fixtures, the
    // warning could never be previewed and could regress unnoticed.
    const byDay = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!r.deadline) continue;
      byDay.set(r.deadline, (byDay.get(r.deadline) ?? new Set()).add(r.schoolId));
    }
    expect([...byDay.values()].some((s) => s.size > 1)).toBe(true);
  });

  it('produces a near-miss the proportional track view cannot separate', () => {
    const dates = [...new Set(rows.filter((r) => r.deadline).map((r) => r.deadline!))].sort();
    const adjacent = dates.some((d, i) => {
      if (i === 0) return false;
      const gap = Math.abs(Date.parse(d) - Date.parse(dates[i - 1]));
      return gap > 0 && gap <= 2 * 86_400_000;
    });
    expect(adjacent).toBe(true);
  });

  it('generates dates relative to now, so fixtures do not rot', () => {
    const later = demoDeadlineRows(new Date('2027-09-07T12:00:00Z'));
    const a = rows.find((r) => r.deadline)!;
    const b = later.find((r) => r.roundId === a.roundId)!;
    expect(b.deadline).not.toBe(a.deadline);
  });
  it('emits sources that cannot be mistaken for a real citation', () => {
    for (const row of rows) {
      if (row.sourceUrl) expect(row.sourceUrl).toContain('.invalid');
    }
  });
});

describe('timeline variants — SEO', () => {
  const variants = ['TimelineV2Page.tsx', 'TimelineV3Page.tsx'];

  it('keeps the alternative layouts out of the index', () => {
    // v2 and v3 render the same data as /timeline in different layouts.
    // Indexing all three splits ranking signals between pages competing for
    // the same query. Whichever layout wins becomes /timeline and drops this.
    for (const file of variants) {
      const source = readFileSync(path.join(ROOT, 'src', 'pages', file), 'utf8');
      expect(source).toMatch(/noindex:\s*true/);
    }
  });

  it('does not add the variants to the sitemap', () => {
    const sitemap = readFileSync(path.join(ROOT, 'scripts', 'generate-sitemap.ts'), 'utf8');
    expect(sitemap).not.toContain('/timeline/v2');
    expect(sitemap).not.toContain('/timeline/v3');
    // The canonical timeline must still be listed.
    expect(sitemap).toContain("{ path: '/timeline'");
  });
});
