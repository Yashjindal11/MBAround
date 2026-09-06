import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Structural checks on the migrations themselves.
 *
 * These exist because of a failure that no type checker and no unit test could
 * see: log_audit_event() is attached to four tables but dereferenced
 * `old.is_published`, a column only two of them have. The guard in front of it
 * (`to_jsonb(old) ? 'is_published' and ...`) looked like it made the access
 * conditional, but PL/pgSQL parses the whole boolean expression against the
 * real record type, so a trigger on application_cycles raised 42703 instead of
 * evaluating to false.
 *
 * The bug survived because INSERT and DELETE never reach that branch. It only
 * fired on the first UPDATE to a cycle - which was the second run of
 * cycles.sql, months into the project.
 */

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

const SQL = migrationFiles()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8'))
  .join('\n');

/** Column names declared for a table across all migrations. */
function columnsOf(table: string): Set<string> {
  const m = SQL.match(
    new RegExp(`create table if not exists ${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'),
  );
  if (!m) throw new Error(`No create table for ${table}`);
  const cols = new Set<string>();
  for (const line of m[1].split('\n')) {
    const c = line.match(/^\s{2}([a-z_]+)\s+[a-z]/i);
    if (c) cols.add(c[1]);
  }
  // Columns added later by alter table still belong to the table.
  const alter = new RegExp(`alter table ${table}\\s+add column(?: if not exists)? ([a-z_]+)`, 'gi');
  let a: RegExpExecArray | null;
  while ((a = alter.exec(SQL)) !== null) cols.add(a[1]);
  return cols;
}

/** The last definition of a function body wins, matching `create or replace`. */
function functionBody(name: string): string {
  const re = new RegExp(
    `create or replace function ${name}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'gi',
  );
  const all = SQL.match(re);
  if (!all) throw new Error(`No definition for ${name}`);
  return all[all.length - 1];
}

/** Tables carrying a trigger that calls the given function. */
function tablesTriggering(fn: string): { table: string; arg: string | null }[] {
  const out: { table: string; arg: string | null }[] = [];
  const re = new RegExp(
    `create trigger [a-z_]+\\s+after[^;]*?on ([a-z_]+)[\\s\\S]*?execute function ${fn}\\('?([A-Z_]*)'?\\)`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(SQL)) !== null) out.push({ table: m[1], arg: m[2] || null });
  return out;
}

describe('audit trigger', () => {
  const AUDITED = tablesTriggering('log_audit_event');

  it('is attached to more than one table', () => {
    // If this ever drops to one table the check below becomes vacuous.
    expect(AUDITED.length).toBeGreaterThan(1);
  });

  it('only dereferences record fields that every audited table has', () => {
    const body = functionBody('log_audit_event');

    // Field accesses on the trigger records. These are resolved against the
    // real row type at parse time, so one missing column breaks that table.
    const refs = new Set<string>();
    const re = /\b(?:old|new)\.([a-z_]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) refs.add(m[1].toLowerCase());

    expect(refs.size, 'no record field accesses found - regex may be stale').toBeGreaterThan(0);

    const columnSets = AUDITED.map((t) => ({ table: t.table, cols: columnsOf(t.table) }));
    for (const field of refs) {
      for (const { table, cols } of columnSets) {
        expect(
          cols.has(field),
          `log_audit_event references old/new.${field}, but ${table} has no such column`,
        ).toBe(true);
      }
    }
  });

  it('detects publish changes without touching the record type', () => {
    const body = functionBody('log_audit_event');
    // The safe form reads the flag out of the jsonb snapshot, which has no
    // per-table shape. Seeing the raw field access back is the regression.
    expect(body).not.toMatch(/\b(?:old|new)\.is_published\b/i);
    expect(body).toMatch(/->\s*'is_published'/);
  });

  it('still distinguishes publish from a generic update', () => {
    const body = functionBody('log_audit_event');
    expect(body).toContain("'PUBLISHED'");
    expect(body).toContain("'UNPUBLISHED'");
  });

  it('does not log no-op updates', () => {
    // Re-running an idempotent seed must not write one audit row per unchanged
    // record, or the log stops being readable as a change history.
    expect(functionBody('log_audit_event')).toMatch(
      /if v_before = v_after then\s*return new;/i,
    );
  });
});

describe('migration files', () => {
  it('are uniquely and sequentially numbered', () => {
    // Two migrations sharing a number apply in an order that depends on the
    // filesystem, which makes the schema non-reproducible.
    const numbers = migrationFiles().map((f) => Number(f.slice(0, 4)));
    expect(new Set(numbers).size).toBe(numbers.length);
    numbers.forEach((n, i) => expect(n).toBe(i + 1));
  });
});
