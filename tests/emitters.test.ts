import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the generated SQL against the real schema.
 *
 * These exist because the deadline collector shipped SQL referencing
 * `cycle_id`, `round_name`, `round_order` and a `status` column on
 * application_rounds - none of which exist - and omitted end_year, which is
 * NOT NULL. Every statement it produced would have aborted, and nothing in the
 * test suite or the type checker could see it, because generated SQL is just a
 * string until Postgres parses it.
 *
 * Rather than assert against a hand-copied column list (which would drift the
 * same way), these parse the actual migration files.
 */

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

function allMigrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

const SQL = allMigrationSql();

/** Column names declared for a table in the migrations. */
function columnsOf(table: string): Set<string> {
  const re = new RegExp(
    `create table if not exists ${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'i',
  );
  const m = SQL.match(re);
  if (!m) throw new Error(`No create table for ${table}`);
  const cols = new Set<string>();
  for (const line of m[1].split('\n')) {
    const c = line.match(/^\s{2}([a-z_]+)\s+[a-z]/i);
    if (c) cols.add(c[1]);
  }
  return cols;
}

/** Column names an INSERT statement targets, per table. */
function insertedColumns(sql: string): { table: string; columns: string[] }[] {
  const out: { table: string; columns: string[] }[] = [];
  const re = /insert\s+into\s+([a-z_]+)\s*\(([^)]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({
      table: m[1],
      columns: m[2].split(',').map((c) => c.trim()).filter(Boolean),
    });
  }
  return out;
}

function runEmitter(script: string): string {
  return execFileSync('npx', ['tsx', script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
}

const EMITTERS = [
  ['schools + programmes', 'scripts/data/emit-seed-sql.ts'],
  ['application cycles', 'scripts/data/emit-cycles-sql.ts'],
] as const;

describe.each(EMITTERS)('%s emitter', (_label, script) => {
  const sql = runEmitter(script);

  it('produces a non-empty transactional script', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
  });

  it('only inserts into columns that exist in the migrations', () => {
    for (const { table, columns } of insertedColumns(sql)) {
      const known = columnsOf(table);
      for (const col of columns) {
        expect(known.has(col), `${table}.${col} does not exist`).toBe(true);
      }
    }
  });

  it('supplies every NOT NULL column that has no default', () => {
    // end_year is exactly this case, and omitting it aborted the insert.
    const required: Record<string, string[]> = {
      schools: ['name', 'slug', 'country', 'region', 'city'],
      programs: ['school_id', 'name', 'slug'],
      application_cycles: ['program_id', 'cycle_name', 'start_year', 'end_year'],
    };
    for (const { table, columns } of insertedColumns(sql)) {
      for (const col of required[table] ?? []) {
        // school_id / program_id arrive via `select ... from`, not the column
        // list, so only assert those the statement is responsible for naming.
        if (col.endsWith('_id') && !columns.includes(col)) continue;
        expect(columns, `${table} insert omits ${col}`).toContain(col);
      }
    }
  });

  it('uses valid enum values where an enum column is set', () => {
    const enums: Record<string, string[]> = {};
    const reEnum = /create type ([a-z_]+) as enum \(([^)]*)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = reEnum.exec(SQL)) !== null) {
      enums[m[1]] = m[2].split(',').map((s) => s.trim().replace(/'/g, ''));
    }

    // Every value any enum can hold. A literal that looks like an enum member
    // but belongs to no enum is the bug this catches: 'NEEDS_REVIEW' is a
    // record_status and was being passed to a cycle_status column.
    const known = new Set(Object.values(enums).flat());

    // Only screaming-snake literals are candidates. Single words like 'MBA'
    // and 'HBS' are ordinary text (short names, programme names) and would
    // produce false positives. An emitter that sets no enum column at all is
    // valid, so an empty candidate list is not a failure.
    const candidates = sql.match(/'[A-Z]{2,}(?:_[A-Z]+)+'/g) ?? [];

    for (const lit of new Set(candidates)) {
      expect(known, `${lit} is not a value of any enum type`).toContain(
        lit.replace(/'/g, ''),
      );
    }
  });

  it('never emits a deadline, decision date or round', () => {
    // The seeds carry institutional facts only. Dates come from
    // collect-deadlines.ts with a source URL, or from a human in the admin UI.
    expect(sql).not.toMatch(/insert\s+into\s+application_rounds/i);
    expect(sql).not.toMatch(/\bdeadline\b/i);
    expect(sql).not.toMatch(/\bdecision_date\b/i);    // A bare ISO date anywhere in a seed would mean a date was invented.
    expect(sql).not.toMatch(/'\d{4}-\d{2}-\d{2}'/);
  });
});

/**
 * A row that inserts successfully but is invisible to the site is a silent
 * failure: the SQL editor reports 49 rows, and every public query returns 0.
 * This caught exactly that - the emitter omitted `status`, the column defaults
 * to 'DRAFT', and cycles_public_read excludes DRAFT from anon.
 */
describe('application cycles visibility', () => {
  const sql = runEmitter('scripts/data/emit-cycles-sql.ts');

  it('sets status explicitly rather than relying on the DRAFT default', () => {
    for (const { table, columns } of insertedColumns(sql)) {
      if (table !== 'application_cycles') continue;
      expect(columns, 'cycles insert omits status').toContain('status');
    }
  });

  it('sets a status the public read policy does not filter out', () => {
    const policy = SQL.match(
      /create policy cycles_public_read on application_cycles([\s\S]*?);/i,
    );
    expect(policy, 'cycles_public_read policy not found').toBeTruthy();

    // Read the excluded status straight from the policy, so tightening the
    // policy later fails this test rather than silently hiding the seed.
    const excluded = policy![1].match(/status\s*<>\s*'([A-Z_]+)'/);
    expect(excluded, 'policy no longer filters on status').toBeTruthy();

    const inserted = sql.match(/select p\.id,[^\n]*'([A-Z_]+)'/);
    expect(inserted, 'no status literal in the cycles insert').toBeTruthy();
    expect(inserted![1]).not.toBe(excluded![1]);
  });

  it('uses a status that is a real cycle_status value', () => {
    const e = SQL.match(/create type cycle_status as enum \(([^)]*)\)/i);
    const values = e![1].split(',').map((s) => s.trim().replace(/'/g, ''));
    const inserted = sql.match(/select p\.id,[^\n]*'([A-Z_]+)'/);
    expect(values).toContain(inserted![1]);
  });
});
