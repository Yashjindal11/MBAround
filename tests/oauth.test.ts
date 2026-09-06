import { describe, expect, it } from 'vitest';
import { parseOAuthError } from '../src/pages/admin/AdminLayout';

/**
 * OAuth failures come back as URL parameters, and if they are not read the
 * app renders an ordinary sign-in form as though nothing happened. That makes
 * the two most common setup mistakes - a redirect URI that is not on the
 * allow-list, and a provider that was never enabled - completely invisible.
 */
describe('parseOAuthError', () => {
  it('returns null for a clean callback', () => {
    expect(parseOAuthError('', '')).toBeNull();
    expect(parseOAuthError('?code=abc123', '')).toBeNull();
  });

  it('reads an error from the query string', () => {
    expect(parseOAuthError('?error=access_denied', '')).toBe('access_denied');
  });

  it('reads an error from the hash fragment', () => {
    // The implicit flow puts errors here. Reading only the query string looks
    // correct and silently misses every one of them.
    expect(parseOAuthError('', '#error=server_error')).toBe('server_error');
  });

  it('prefers the human-readable description over the code', () => {
    expect(
      parseOAuthError('?error=invalid_request&error_description=Redirect+URI+mismatch', ''),
    ).toBe('Redirect URI mismatch');
  });

  it('decodes plus-encoded spaces in a fragment description', () => {
    expect(
      parseOAuthError('', '#error=x&error_description=Unsupported+provider%3A+google'),
    ).toBe('Unsupported provider: google');
  });

  it('falls back to the code when no description is supplied', () => {
    expect(parseOAuthError('?error=temporarily_unavailable', '')).toBe(
      'temporarily_unavailable',
    );
  });

  it('tolerates a leading ? and # being present or absent', () => {
    expect(parseOAuthError('error=a', '')).toBe('a');
    expect(parseOAuthError('', 'error=b')).toBe('b');
  });
});
