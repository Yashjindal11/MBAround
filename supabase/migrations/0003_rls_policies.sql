-- ===========================================================================
-- MBAround — 0003 Row Level Security
-- ===========================================================================
-- Security model:
--   anon / authenticated : read PUBLISHED content only; may INSERT suggestions
--   EDITOR               : may edit content
--   ADMIN                : may edit + delete content, review suggestions
--   SUPER_ADMIN          : full control, including admin_users
--
-- Authorisation is enforced in the database, never in the browser.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Role helpers.
--
-- SECURITY DEFINER so policies can read admin_users without granting the
-- caller direct access to it (and without recursive policy evaluation).
-- ---------------------------------------------------------------------------
create or replace function auth_role()
returns admin_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from admin_users where user_id = auth.uid();
$$;

create or replace function is_editor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from admin_users
    where user_id = auth.uid()
      and role in ('SUPER_ADMIN', 'ADMIN', 'EDITOR')
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from admin_users
    where user_id = auth.uid()
      and role in ('SUPER_ADMIN', 'ADMIN')
  );
$$;

create or replace function is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from admin_users
    where user_id = auth.uid() and role = 'SUPER_ADMIN'
  );
$$;

revoke all on function auth_role()      from public;
revoke all on function is_editor()      from public;
revoke all on function is_admin()       from public;
revoke all on function is_super_admin() from public;
grant execute on function auth_role(), is_editor(), is_admin(), is_super_admin()
  to anon, authenticated;

-- ---------------------------------------------------------------------------
alter table schools            enable row level security;
alter table programs           enable row level security;
alter table application_cycles enable row level security;
alter table application_rounds enable row level security;
alter table ranking_sources    enable row level security;
alter table school_rankings    enable row level security;
alter table admin_users        enable row level security;
alter table suggestions        enable row level security;
alter table audit_log          enable row level security;

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
drop policy if exists schools_public_read on schools;
create policy schools_public_read on schools
  for select to anon, authenticated
  using (is_published or is_editor());

drop policy if exists schools_editor_insert on schools;
create policy schools_editor_insert on schools
  for insert to authenticated with check (is_editor());

drop policy if exists schools_editor_update on schools;
create policy schools_editor_update on schools
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists schools_admin_delete on schools;
create policy schools_admin_delete on schools
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
drop policy if exists programs_public_read on programs;
create policy programs_public_read on programs
  for select to anon, authenticated
  using (
    is_editor()
    or (is_published and exists (
      select 1 from schools s where s.id = programs.school_id and s.is_published
    ))
  );

drop policy if exists programs_editor_insert on programs;
create policy programs_editor_insert on programs
  for insert to authenticated with check (is_editor());

drop policy if exists programs_editor_update on programs;
create policy programs_editor_update on programs
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists programs_admin_delete on programs;
create policy programs_admin_delete on programs
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- application_cycles
-- ---------------------------------------------------------------------------
drop policy if exists cycles_public_read on application_cycles;
create policy cycles_public_read on application_cycles
  for select to anon, authenticated
  using (
    is_editor()
    or (status <> 'DRAFT' and exists (
      select 1 from programs p join schools s on s.id = p.school_id
      where p.id = application_cycles.program_id
        and p.is_published and s.is_published
    ))
  );

drop policy if exists cycles_editor_insert on application_cycles;
create policy cycles_editor_insert on application_cycles
  for insert to authenticated with check (is_editor());

drop policy if exists cycles_editor_update on application_cycles;
create policy cycles_editor_update on application_cycles
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists cycles_admin_delete on application_cycles;
create policy cycles_admin_delete on application_cycles
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- application_rounds
-- ---------------------------------------------------------------------------
drop policy if exists rounds_public_read on application_rounds;
create policy rounds_public_read on application_rounds
  for select to anon, authenticated
  using (
    is_editor()
    or exists (
      select 1
      from application_cycles c
      join programs p on p.id = c.program_id
      join schools  s on s.id = p.school_id
      where c.id = application_rounds.application_cycle_id
        and c.status <> 'DRAFT'
        and p.is_published
        and s.is_published
    )
  );

drop policy if exists rounds_editor_insert on application_rounds;
create policy rounds_editor_insert on application_rounds
  for insert to authenticated with check (is_editor());

drop policy if exists rounds_editor_update on application_rounds;
create policy rounds_editor_update on application_rounds
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists rounds_admin_delete on application_rounds;
create policy rounds_admin_delete on application_rounds
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- rankings (public read, editor write)
-- ---------------------------------------------------------------------------
drop policy if exists ranking_sources_public_read on ranking_sources;
create policy ranking_sources_public_read on ranking_sources
  for select to anon, authenticated using (true);

drop policy if exists ranking_sources_editor_write on ranking_sources;
create policy ranking_sources_editor_write on ranking_sources
  for all to authenticated using (is_editor()) with check (is_editor());

drop policy if exists school_rankings_public_read on school_rankings;
create policy school_rankings_public_read on school_rankings
  for select to anon, authenticated using (true);

drop policy if exists school_rankings_editor_write on school_rankings;
create policy school_rankings_editor_write on school_rankings
  for all to authenticated using (is_editor()) with check (is_editor());

-- ---------------------------------------------------------------------------
-- admin_users — readable by editors, writable only by super admins.
-- Prevents privilege escalation via the client.
-- ---------------------------------------------------------------------------
drop policy if exists admin_users_self_read on admin_users;
create policy admin_users_self_read on admin_users
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists admin_users_super_write on admin_users;
create policy admin_users_super_write on admin_users
  for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- suggestions
-- Anonymous users may SUBMIT but never read, update or approve.
-- ---------------------------------------------------------------------------
drop policy if exists suggestions_anon_insert on suggestions;
create policy suggestions_anon_insert on suggestions
  for insert to anon, authenticated
  with check (status = 'PENDING' and reviewed_by is null and reviewed_at is null);

drop policy if exists suggestions_admin_read on suggestions;
create policy suggestions_admin_read on suggestions
  for select to authenticated using (is_editor());

drop policy if exists suggestions_admin_update on suggestions;
create policy suggestions_admin_update on suggestions
  for update to authenticated using (is_editor()) with check (is_editor());

drop policy if exists suggestions_admin_delete on suggestions;
create policy suggestions_admin_delete on suggestions
  for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- audit_log — append-only. No UPDATE or DELETE policy exists for anyone,
-- so history cannot be rewritten through the API.
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_admin_read on audit_log;
create policy audit_log_admin_read on audit_log
  for select to authenticated using (is_editor());

drop policy if exists audit_log_editor_insert on audit_log;
create policy audit_log_editor_insert on audit_log
  for insert to authenticated with check (is_editor());
