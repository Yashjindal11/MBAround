import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Contrast checks for both palettes.
 *
 * A dark theme is easy to ship and hard to ship *readable*. Nothing else in
 * the suite would notice if ink-500 on the dark canvas dropped to 3:1 - it
 * would look intentional in a screenshot and be unusable for anyone with low
 * vision. These assertions read the real CSS variables, so drifting the
 * palette without re-checking contrast fails the build.
 *
 * Thresholds are WCAG 2.1: 4.5:1 for body text, 3:1 for large text and UI
 * boundaries.
 */

const css = readFileSync(
  path.resolve(process.cwd(), 'src/index.css'),
  'utf8',
);

function block(selector: 'root' | 'dark'): string {
  const marker = selector === 'root' ? ':root' : '.dark';
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker} block`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

function vars(selector: 'root' | 'dark'): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  const re = /--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g;
  let m: RegExpExecArray | null;
  const text = block(selector);
  while ((m = re.exec(text)) !== null) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

/** WCAG relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = vars('root');
const dark = vars('dark');

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (name, v) => {
  const canvas = v['sand'];
  const surface = v['surface'];

  it('defines every token the other theme defines', () => {
    const other = name === 'light' ? dark : light;
    for (const key of Object.keys(other)) {
      expect(v, `${name} is missing --${key}`).toHaveProperty(key);
    }
  });

  it('body text on the canvas meets AA (4.5:1)', () => {
    expect(contrast(v['ink-900'], canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it('body text on a raised surface meets AA (4.5:1)', () => {
    expect(contrast(v['ink-900'], surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('secondary text (ink-600) meets AA on both backgrounds', () => {
    expect(contrast(v['ink-600'], canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v['ink-600'], surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text (ink-500) stays legible at AA', () => {
    // ink-500 is used for dates and provenance lines - small, and the exact
    // text a user needs to read carefully.
    expect(contrast(v['ink-500'], surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent link colour meets AA on a surface', () => {
    expect(contrast(v['accent-700'], surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('borders are perceivable against the surface', () => {
    // Not a text threshold; borders only need to be visible.
    expect(contrast(v['ink-200'], surface)).toBeGreaterThanOrEqual(1.2);
  });

  it('canvas and surface are distinguishable from each other', () => {
    expect(contrast(canvas, surface)).toBeGreaterThan(1.01);
  });
});

describe('dark theme construction', () => {
  it('inverts the ink scale rather than reusing light values', () => {
    // ink-900 must remain "strongest text" in both themes, or every existing
    // utility silently changes meaning in dark mode.
    expect(luminance(dark['ink-900'])).toBeGreaterThan(luminance(dark['ink-50']));
    expect(luminance(light['ink-900'])).toBeLessThan(luminance(light['ink-50']));
  });

  it('uses a soft dark canvas rather than pure black', () => {
    // Pure black against light text causes halation, which matters on a page
    // people scan long date lists on.
    expect(luminance(dark['sand'])).toBeGreaterThan(0);
    const [r, g, b] = dark['sand'];
    expect(Math.max(r, g, b)).toBeGreaterThan(8);
  });

  it('raises the surface above the canvas so cards read as elevated', () => {
    expect(luminance(dark['surface'])).toBeGreaterThan(luminance(dark['sand']));
  });
});
