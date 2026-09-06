-- ===========================================================================
-- MBAround — 0001 initial schema
-- ===========================================================================
-- Relational V1 schema. Supabase/Postgres is the single source of truth for
-- all MBA content; the frontend contains no hardcoded school data.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type cycle_status as enum ('DRAFT', 'UPCOMING', 'CURRENT', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type suggestion_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('SUPER_ADMIN', 'ADMIN', 'EDITOR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type record_status as enum ('OK', 'NEEDS_REVIEW');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table if not exists schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  short_name    text,
  description   text,
  country       text not null,
  region        text not null,
  state         text,
  city          text not null,
  website_url   text,
  admissions_url text,
  logo_url      text,
  image_url     text,
  is_featured   boolean not null default false,
  is_published  boolean not null default false,
  is_verified   boolean not null default false,
  status        record_status not null default 'NEEDS_REVIEW',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint schools_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint schools_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists schools_published_idx  on schools (is_published, display_order, name);
create index if not exists schools_country_idx    on schools (country);
create index if not exists schools_region_idx     on schools (region);
create index if not exists schools_featured_idx   on schools (is_featured) where is_featured;
create index if not exists schools_name_trgm_idx  on schools using gin (name gin_trgm_ops);

drop trigger if exists schools_set_updated_at on schools;
create trigger schools_set_updated_at
  before update on schools
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- programs  (a school may offer several)
-- ---------------------------------------------------------------------------
create table if not exists programs (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  name            text not null,
  slug            text not null,
  program_type    text not null default 'Full-time MBA',
  description     text,
  duration_months integer,
  is_published    boolean not null default false,
  is_verified     boolean not null default false,
  status          record_status not null default 'NEEDS_REVIEW',
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint programs_slug_unique_per_school unique (school_id, slug),
  constraint programs_duration_sane check (duration_months is null or duration_months between 1 and 120)
);

create index if not exists programs_school_idx    on programs (school_id, display_order);
create index if not exists programs_published_idx on programs (is_published);
create index if not exists programs_type_idx      on programs (program_type);

drop trigger if exists programs_set_updated_at on programs;
create trigger programs_set_updated_at
  before update on programs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- application_cycles
-- ---------------------------------------------------------------------------
create table if not exists application_cycles (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references programs(id) on delete cascade,
  cycle_name  text not null,
  start_year  integer not null,
  end_year    integer not null,
  status      cycle_status not null default 'DRAFT',
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cycles_unique_per_program unique (program_id, cycle_name),
  constraint cycles_years_ordered check (end_year >= start_year)
);

-- At most one current cycle per programme.
create unique index if not exists cycles_one_current_per_program
  on application_cycles (program_id) where is_current;

create index if not exists cycles_program_idx on application_cycles (program_id, start_year desc);
create index if not exists cycles_status_idx  on application_cycles (status);

drop trigger if exists cycles_set_updated_at on application_cycles;
create trigger cycles_set_updated_at
  before update on application_cycles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- application_rounds
-- ---------------------------------------------------------------------------
-- Supports arbitrary round structures: R1..R4, Early Decision, Rolling,
-- or any custom school-specific name. Never assume three rounds.
-- ---------------------------------------------------------------------------
create table if not exists application_rounds (
  id                   uuid primary key default gen_random_uuid(),
  application_cycle_id uuid not null references application_cycles(id) on delete cascade,
  name                 text not null,
  deadline             date,
  decision_date        date,
  notes                text,
  is_announced         boolean not null default false,
  is_verified          boolean not null default false,
  status               record_status not null default 'NEEDS_REVIEW',
  source_url           text,
  source_name          text,
  last_verified        timestamptz,
  display_order        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint rounds_unique_per_cycle unique (application_cycle_id, name),

  -- Data-integrity rules that make fabricated data structurally impossible.
  -- A round cannot carry a date unless it is marked announced.
  constraint rounds_unannounced_has_no_dates
    check (is_announced or (deadline is null and decision_date is null)),

  -- A round cannot be "verified" without a date and an official source.
  constraint rounds_verified_requires_source
    check (not is_verified or (deadline is not null and source_url is not null)),

  -- Decisions cannot precede their deadline.
  constraint rounds_decision_after_deadline
    check (decision_date is null or deadline is null or decision_date >= deadline)
);

create index if not exists rounds_cycle_idx     on application_rounds (application_cycle_id, display_order);
create index if not exists rounds_deadline_idx  on application_rounds (deadline) where deadline is not null;
create index if not exists rounds_announced_idx on application_rounds (is_announced, deadline);
create index if not exists rounds_verified_idx  on application_rounds (is_verified);
create index if not exists rounds_stale_idx     on application_rounds (last_verified);

drop trigger if exists rounds_set_updated_at on application_rounds;
create trigger rounds_set_updated_at
  before update on application_rounds
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Ranking attribution (never MBAround's own ranking)
-- ---------------------------------------------------------------------------
create table if not exists ranking_sources (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  publisher  text not null,
  edition    text not null,
  url        text,
  created_at timestamptz not null default now(),
  constraint ranking_sources_unique unique (publisher, name, edition)
);

create table if not exists school_rankings (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references schools(id) on delete cascade,
  ranking_source_id uuid not null references ranking_sources(id) on delete cascade,
  rank              integer,
  created_at        timestamptz not null default now(),
  constraint school_rankings_unique unique (school_id, ranking_source_id),
  constraint school_rankings_rank_positive check (rank is null or rank > 0)
);

create index if not exists school_rankings_school_idx on school_rankings (school_id);

-- ---------------------------------------------------------------------------
-- admin_users  (being a Google user does NOT make you an admin)
-- ---------------------------------------------------------------------------
create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       admin_role not null default 'EDITOR',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- suggestions  (public corrections, reviewed before touching canonical data)
-- ---------------------------------------------------------------------------
create table if not exists suggestions (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid references schools(id) on delete set null,
  program_id      uuid references programs(id) on delete set null,
  round_id        uuid references application_rounds(id) on delete set null,
  field_name      text,
  issue           text not null,
  suggested_value text,
  source_url      text,
  notes           text,
  email           text,
  status          suggestion_status not null default 'PENDING',
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),

  constraint suggestions_issue_not_blank check (length(btrim(issue)) > 0),
  constraint suggestions_issue_max_len check (length(issue) <= 2000),
  constraint suggestions_reviewed_consistent
    check ((status = 'PENDING') = (reviewed_at is null))
);

create index if not exists suggestions_status_idx on suggestions (status, created_at desc);
create index if not exists suggestions_school_idx on suggestions (school_id);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       uuid references auth.users(id) on delete set null,
  actor_email text,
  entity_type text not null,
  entity_id   uuid not null,
  action      text not null,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_entity_idx  on audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists audit_log_actor_idx   on audit_log (actor);
