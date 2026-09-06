-- ===========================================================================
-- MBAround — 0004 audit logging + data health
-- ===========================================================================
-- Audit entries are written by database triggers, not by the client, so any
-- write path (admin UI, SQL editor, future cron worker) is recorded.
-- ===========================================================================

create or replace function log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action     text;
  v_entity_id  uuid;
  v_before     jsonb;
  v_after      jsonb;
  v_entity     text := tg_argv[0];
  v_email      text;
begin
  if tg_op = 'INSERT' then
    v_action := v_entity || '_CREATED';
    v_entity_id := new.id;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);

    -- Publish/unpublish is more meaningful than a generic update.
    if to_jsonb(old) ? 'is_published'
       and (old.is_published is distinct from new.is_published) then
      v_action := case when new.is_published then 'PUBLISHED' else 'UNPUBLISHED' end;
    else
      v_action := v_entity || '_UPDATED';
    end if;

    -- Skip no-op updates.
    if v_before = v_after then
      return new;
    end if;
  else
    v_action := v_entity || '_DELETED';
    v_entity_id := old.id;
    v_before := to_jsonb(old);
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into audit_log (actor, actor_email, entity_type, entity_id, action, before_data, after_data)
  values (auth.uid(), v_email, v_entity, v_entity_id, v_action, v_before, v_after);

  return coalesce(new, old);
end;
$$;

drop trigger if exists schools_audit on schools;
create trigger schools_audit
  after insert or update or delete on schools
  for each row execute function log_audit_event('SCHOOL');

drop trigger if exists programs_audit on programs;
create trigger programs_audit
  after insert or update or delete on programs
  for each row execute function log_audit_event('PROGRAM');

drop trigger if exists cycles_audit on application_cycles;
create trigger cycles_audit
  after insert or update or delete on application_cycles
  for each row execute function log_audit_event('CYCLE');

drop trigger if exists rounds_audit on application_rounds;
create trigger rounds_audit
  after insert or update or delete on application_rounds
  for each row execute function log_audit_event('ROUND');

-- ---------------------------------------------------------------------------
-- Suggestion review.
--
-- Approving records the decision and writes an audit entry. It deliberately
-- does NOT auto-apply the suggested value to canonical data: a human edits the
-- record so that a source is checked first. This keeps unverified public input
-- from silently overwriting verified production data.
-- ---------------------------------------------------------------------------
create or replace function review_suggestion(
  p_suggestion_id uuid,
  p_approve       boolean
)
returns suggestions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_row    suggestions;
  v_email  text;
begin
  if not is_editor() then
    raise exception 'Not authorised to review suggestions'
      using errcode = '42501';
  end if;

  select to_jsonb(s) into v_before from suggestions s where s.id = p_suggestion_id;
  if v_before is null then
    raise exception 'Suggestion % not found', p_suggestion_id using errcode = 'P0002';
  end if;

  if (v_before ->> 'status') <> 'PENDING' then
    raise exception 'Suggestion % has already been reviewed', p_suggestion_id
      using errcode = '22023';
  end if;

  update suggestions
     set status      = case when p_approve then 'APPROVED' else 'REJECTED' end::suggestion_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_suggestion_id
  returning * into v_row;

  select email into v_email from auth.users where id = auth.uid();

  insert into audit_log (actor, actor_email, entity_type, entity_id, action, before_data, after_data)
  values (
    auth.uid(), v_email, 'SUGGESTION', p_suggestion_id,
    case when p_approve then 'SUGGESTION_APPROVED' else 'SUGGESTION_REJECTED' end,
    v_before, to_jsonb(v_row)
  );

  return v_row;
end;
$$;

revoke all on function review_suggestion(uuid, boolean) from public, anon;
grant execute on function review_suggestion(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Data health counters for the admin dashboard.
-- Computed in one round trip rather than a dozen client-side queries.
-- ---------------------------------------------------------------------------
create or replace function data_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when not is_editor() then null else jsonb_build_object(
    'totalSchools',          (select count(*) from schools),
    'publishedSchools',      (select count(*) from schools where is_published),
    'verifiedSchools',       (select count(*) from schools where is_verified),
    'unpublishedSchools',    (select count(*) from schools where not is_published),
    'totalPrograms',         (select count(*) from programs),
    'currentCycles',         (select count(*) from application_cycles where is_current),
    'totalRounds',           (select count(*) from application_rounds),
    'upcomingDeadlines',     (select count(*) from application_rounds
                              where deadline is not null and deadline >= current_date),
    'unannouncedRounds',     (select count(*) from application_rounds where not is_announced),
    'needsReview',           (select count(*) from application_rounds
                              where is_announced and not is_verified),
    'missingOfficialSource', (select count(*) from application_rounds
                              where is_announced and source_url is null),
    'staleRounds',           (select count(*) from application_rounds
                              where is_verified
                                and (last_verified is null
                                     or last_verified < now() - interval '30 days')),
    'pendingSuggestions',    (select count(*) from suggestions where status = 'PENDING')
  ) end;
$$;

revoke all on function data_health() from public, anon;
grant execute on function data_health() to authenticated;
