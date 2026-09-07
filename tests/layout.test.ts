import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards against nested scroll containers in the filter rail.
 *
 * The rail caps its own height and scrolls. A list *inside* it that also
 * carries `max-h` + `overflow-y-auto` produces two scrollbars sitting side by
 * side, each scrolling a different portion of the same column — the outer one
 * for the rail, the inner one for the school list. It looks broken because it
 * is: the user has to work out which bar moves which content, and the inner
 * list can never be scrolled into view once the outer one is at its end.
 *
 * The rule: exactly one scroll container per rail, owned by the rail.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const tsxFiles = walk(SRC).filter((f) => f.endsWith('.tsx'));

/** Files whose rails wrap page content and therefore own the scrolling. */
const RAIL_OWNERS = ['SchoolScope.tsx', 'Filters.tsx'];

describe('filter rail scrolling', () => {
  it('has exactly one scrolling container per rail component', () => {
    for (const name of RAIL_OWNERS) {
      const file = tsxFiles.find((f) => path.basename(f) === name);
      expect(file, `${name} should exist`).toBeDefined();
      const source = readFileSync(file!, 'utf8');

      // The desktop rail. Counting occurrences catches a second one being
      // added later inside the same component.
      const scrollers = source.match(/overflow-y-auto/g) ?? [];
      const railHeights = source.match(/max-h-\[calc\(100vh/g) ?? [];

      // One scroll region for desktop, one for the mobile drawer at most.
      expect(scrollers.length).toBeLessThanOrEqual(2);
      expect(railHeights.length).toBe(1);
    }
  });

  it('does not nest a fixed-height scroll list inside the rail', () => {
    // A `max-h-[NNrem]` paired with `overflow-y-auto` in a page that also
    // renders <ScopeRail> is the exact nesting that caused the double bar.
    const offenders: string[] = [];

    for (const file of tsxFiles) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('ScopeRail') && !source.includes('FilterBar')) continue;

      // Look for a rem-based cap on a scroll region, e.g. max-h-[22rem].
      const nested = /max-h-\[\d+(?:\.\d+)?rem\][^"'`]*overflow-y-auto|overflow-y-auto[^"'`]*max-h-\[\d+(?:\.\d+)?rem\]/.test(
        source,
      );
      if (nested) offenders.push(path.relative(ROOT, file));
    }

    expect(offenders).toEqual([]);
  });

  it('uses the slim scrollbar utility wherever the rail scrolls', () => {
    // The default Windows scrollbar is ~17px of high-contrast grey, which in a
    // narrow sidebar reads as a structural divider rather than a control.
    for (const name of RAIL_OWNERS) {
      const file = tsxFiles.find((f) => path.basename(f) === name)!;
      const source = readFileSync(file, 'utf8');
      const scrollBlocks = source.match(/className="[^"]*overflow-y-auto[^"]*"/g) ?? [];
      for (const block of scrollBlocks) {
        expect(block, `${name}: scroll region should use scroll-slim`).toContain('scroll-slim');
      }
    }
  });

  it('defines the scroll-slim utility it depends on', () => {
    const css = readFileSync(path.join(SRC, 'index.css'), 'utf8');
    expect(css).toContain('.scroll-slim');
    expect(css).toContain('scrollbar-width: thin');
    // Track must stay transparent so the bar only shows against its panel.
    expect(css).toMatch(/scroll-slim::-webkit-scrollbar-track\s*\{\s*background:\s*transparent/);
  });
});

describe('timeline layout ordering', () => {
  it('puts the calendar first, as the primary view', () => {
    const chrome = readFileSync(path.join(SRC, 'components', 'TimelineChrome.tsx'), 'utf8');
    const match = /TIMELINE_VIEWS = \[([\s\S]*?)\] as const/.exec(chrome);
    expect(match).not.toBeNull();

    const paths = [...match![1].matchAll(/path: '([^']+)'/g)].map((m) => m[1]);
    expect(paths[0]).toBe('/timeline/v2');
    // All three must still be reachable; promoting one must not drop another.    expect(paths).toContain('/timeline');
    expect(paths).toContain('/timeline/v3');
  });
});

/**
 * The calendar's density rules exist because the first version rendered a
 * six-row day grid for every month in range. A month with no deadlines still
 * cost a panel, a header, a zero-width load bar and a padded paragraph; a
 * month with one deadline cost ~35 empty cells. Across a quiet stretch of the
 * cycle the page read as mostly blank, which made it look broken rather than
 * merely sparse.
 *
 * These pin the thresholds by shape, not by cosmetics: an empty month must
 * return early and never reach the panel path, and the day grid must stay
 * gated behind a row count. Restyling is free; silently reinstating a full
 * panel for an empty month is not.
 */
describe('calendar density', () => {
  const source = readFileSync(path.join(SRC, 'pages', 'TimelineV2Page.tsx'), 'utf8');

  it('collapses an empty month instead of rendering a panel', () => {
    expect(source).toMatch(/if \(month\.rows\.length === 0\) \{\s*return \(/);

    // It must genuinely be an early return: the collapsed branch has to close
    // before the panel <section> is reached.
    const earlyReturn = source.indexOf('if (month.rows.length === 0)');
    const panel = source.indexOf("'panel overflow-hidden '");
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(earlyReturn);
  });

  it('leaves no dead empty-state branch inside the panel', () => {
    // Once the early return exists, the old in-panel empty state is
    // unreachable; keeping it invites a later reader to treat it as live.
    expect(source).not.toContain('No announced deadlines this month.');
  });

  it('falls back to rows for sparse months rather than a mostly-empty grid', () => {
    expect(source).toMatch(/density === 'grid' && month\.rows\.length > 2/);
  });

  it('labels the toggle "Auto", since it does not always render a grid', () => {
    // Calling it "Grid" while showing rows would be a small lie the user has
    // to reverse-engineer.
    expect(source).toMatch(/>\s*Auto\s*</);
    expect(source).not.toMatch(/>\s*Grid\s*</);
  });
});
