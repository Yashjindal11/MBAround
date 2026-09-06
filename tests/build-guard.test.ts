import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the production build against shipping a site that cannot reach its
 * database.
 *
 * A real deploy did exactly that and reported success: the bundle built, the
 * sitemap wrote 10 static URLs, and the result would have been a live site
 * whose every data-bearing page rendered its empty state. The only signal was
 * one `console.warn` in the middle of otherwise normal output.
 *
 * MBAround has no static content worth serving — schools, deadlines and every
 * filter come from Supabase — so an unconfigured production build has no
 * useful output at all, and must fail loudly instead of quietly.
 */

const ROOT = process.cwd();

/** Runs the sitemap generator with a controlled environment. */
function runSitemap(env: Record<string, string>): { status: number; output: string } {
  try {
    const output = execFileSync('npx', ['tsx', 'scripts/generate-sitemap.ts'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        // Point dotenv at a path that does not exist so the developer's real
        // .env cannot leak in and mask a missing-credentials case.
        DOTENV_CONFIG_PATH: path.join(ROOT, '.env.does-not-exist'),
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
        CI: '',
        CF_PAGES_BRANCH: '',
        WORKERS_CI_BRANCH: '',
        NODE_ENV: '',
        MBAROUND_ALLOW_UNCONFIGURED_BUILD: '',
        ...env,
      },
    });
    return { status: 0, output };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      status: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

describe('production build guard', () => {
  // Each case spawns `npx tsx`, which costs several seconds on Windows. The
  // default 5s budget times out on a cold cache, so these fail for reasons
  // that have nothing to do with the behaviour under test.
  const SPAWN_TIMEOUT = 60_000;

  it('fails a CI build with no Supabase credentials', () => {
    const { status, output } = runSitemap({ CI: 'true' });
    expect(status).not.toBe(0);
    expect(output).toContain('REFUSING TO BUILD');
  }, SPAWN_TIMEOUT);

  it('fails a Cloudflare main-branch build with no credentials', () => {
    // This is the exact environment of the deploy that silently succeeded.
    const { status } = runSitemap({ CF_PAGES_BRANCH: 'main' });
    expect(status).not.toBe(0);
  }, SPAWN_TIMEOUT);

  it('allows a Cloudflare preview branch to build unconfigured', () => {
    // Preview deploys of a feature branch are for reviewing layout, and
    // failing them for want of a database would block that.
    const { status } = runSitemap({ CF_PAGES_BRANCH: 'feature/x' });
    expect(status).toBe(0);
  }, SPAWN_TIMEOUT);

  it('allows a local build with no CI markers', () => {
    const { status } = runSitemap({});
    expect(status).toBe(0);
  }, SPAWN_TIMEOUT);

  it('honours an explicit opt-out even in CI', () => {
    const { status } = runSitemap({
      CI: 'true',
      MBAROUND_ALLOW_UNCONFIGURED_BUILD: 'true',
    });
    expect(status).toBe(0);
  }, SPAWN_TIMEOUT);

  it('names the variables that must be set', () => {
    // An error that does not say what to do sends the reader to the source.
    const { output } = runSitemap({ CI: 'true' });
    expect(output).toContain('VITE_SUPABASE_URL');
    expect(output).toContain('VITE_SUPABASE_ANON_KEY');
  }, SPAWN_TIMEOUT);
});

describe('deployment configuration', () => {
  const wrangler = readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');

  it('declares the assets directory explicitly', () => {
    // Wrangler's framework auto-detection refused to deploy because it only
    // configures Vite 6+. Declaring this makes the deploy independent of it.
    expect(wrangler).toMatch(/\[assets\]/);
    expect(wrangler).toMatch(/directory\s*=\s*"\.\/dist"/);
  });

  it('serves deep links through the SPA entrypoint', () => {
    // Without this /schools/<slug> 404s on hard refresh and to crawlers.
    expect(wrangler).toMatch(/not_found_handling\s*=\s*"single-page-application"/);
  });

  it('uses a Vite version Wrangler can auto-configure', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    ) as { devDependencies: Record<string, string> };
    const major = Number(pkg.devDependencies.vite.replace(/^[^\d]*/, '').split('.')[0]);
    expect(major).toBeGreaterThanOrEqual(6);
  });
});
