/**
 * Emits the 2026-27 application cycle for every published programme.
 *
 * Deliberately emits ZERO rounds. A cycle is a factual container - "IIM
 * Bangalore's PGP has a 2026-27 intake" is safe to assert. A round is not:
 * emitting "Round 1 / Round 2 / Round 3" would assert that a school uses a
 * three-round structure, and plenty use rolling, two-stage or CAT-linked
 * processes instead. Inventing structure is the same class of error as
 * inventing dates, just less obvious, so this script refuses to do it.
 *
 * Rounds arrive one of two ways, both evidence-based:
 *   - scripts/data/collect-deadlines.ts, read off official pages with a
 *     source_url recorded, or
 *   - a human entering them in the admin panel.
 *
 * Run: npx tsx scripts/data/emit-cycles-sql.ts > cycles.sql
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProgramSeed {
  name: string;
  programType: string;
}
interface SchoolSeed {
  name: string;
  slug: string;
  programs: ProgramSeed[];
}

const CYCLE = process.env.MBAROUND_CYCLE ?? '2026-27';
const START = Number(CYCLE.slice(0, 4));
const END = START + 1;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const { schools } = JSON.parse(
  readFileSync(path.join(__dirname, 'schools.json'), 'utf8'),
) as { schools: SchoolSeed[] };

const out: string[] = [];
out.push('-- MBAround application cycles');
out.push(`-- Cycle: ${CYCLE}`);
out.push('--');
out.push('-- Contains NO rounds and NO dates. Cycles are containers only.');
out.push('');
out.push('begin;');
out.push('');

let n = 0;
for (const school of schools) {
  for (const program of school.programs) {
    const pslug = slugify(program.name);
    out.push(
      `insert into application_cycles (program_id, cycle_name, start_year, end_year, is_current)\n` +
        `select p.id, '${CYCLE}', ${START}, ${END}, true\n` +
        `from programs p join schools s on s.id = p.school_id\n` +
        `where s.slug = '${school.slug}' and p.slug = '${pslug}'\n` +
        `on conflict (program_id, cycle_name) do update set\n` +
        `  start_year = excluded.start_year,\n` +
        `  end_year = excluded.end_year,\n` +
        `  is_current = excluded.is_current;`,
    );
    out.push('');
    n++;
  }
}

out.push('commit;');
out.push('');
out.push('-- Verify:');
out.push(`--   select count(*) from application_cycles;  -- expect ${n}`);
out.push('--   select count(*) from application_rounds;  -- expect 0');

console.log(out.join('\n'));
console.error(`[cycles] ${n} cycles, 0 rounds, 0 dates.`);
