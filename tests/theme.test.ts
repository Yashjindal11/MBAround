import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../src/lib/theme';

/**
 * The resolution rule is small but load-bearing: it decides what every user
 * sees on first paint, and it is duplicated in the inline <script> in
 * index.html. If these expectations change, that script must change too.
 */
describe('resolveTheme', () => {
  it('honours an explicit choice regardless of the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system setting when the preference is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('defaults to light when the system expresses no dark preference', () => {
    // matchMedia is absent or false in older browsers and in SSR; light is the
    // safe fallback because the CSS variables at :root are the light theme.
    expect(resolveTheme('system', false)).toBe('light');
  });
});
