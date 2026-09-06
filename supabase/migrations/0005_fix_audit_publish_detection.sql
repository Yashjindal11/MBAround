-- ===========================================================================
-- MBAround — 0005 fix audit publish detection
-- ===========================================================================
-- Running cycles.sql failed with:
--
--   ERROR: 42703: record "old" has no field "is_published"
--   CONTEXT: SQL expression "to_jsonb(old) ? 'is_published'
--            and (old.is_published is distinct from new.is_published)"
--
-- log_audit_event() is attached to four tables, but only `schools` and
-- `programs` have an is_published column. application_cycles and
-- application_rounds do not.
--
-- The original guard tried to handle that:
--
--   if to_jsonb(old) ? 'is_published'
--      and (old.is_published is distinct from new.is_published) then
--
-- That looks safe and is not. PL/pgSQL hands the whole boolean expression to
-- the SQL parser as one unit, and `old` is resolved against the actual record
-- type at that point. There is no short-circuit that spares the second
-- operand: for a trigger on application_cycles the expression cannot be
-- parsed at all, so it raises 42703 rather than evaluating to false.
--
-- The fix reads the field out of the jsonb copies, which are plain values
-- with no per-table structure, so the same code is valid for every table.
-- The record is never dereferenced by field name.
--
-- Why this was invisible until now:
--   - INSERT and DELETE never touch the branch, and every prior write to
--     cycles was an insert.
--   - Re-running cycles.sql was the first UPDATE on application_cycles,
--     because the `on conflict ... do update` only fires on the second run.
--   - The audit trigger is AFTER, so the failure aborted the transaction and
--     rolled the whole seed back.
--
-- The trigger definitions do not change; only the function body is replaced,
-- so `create or replace` is sufficient.
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
  v_pub_before jsonb;
  v_pub_after  jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := v_entity || '_CREATED';
    v_entity_id := new.id;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);

    -- Read is_published out of the jsonb rather than off the record. jsonb has
    -- no fixed shape, so a table without the column yields SQL NULL here
    -- instead of failing to parse. `->` (not `->>`) keeps true/false distinct
    -- from absent.
    v_pub_before := v_before -> 'is_published';
    v_pub_after  := v_after  -> 'is_published';

    -- Publish/unpublish is more meaningful than a generic update.
    if v_pub_before is not null
       and v_pub_after is not null
       and v_pub_before is distinct from v_pub_after then
      v_action := case when v_pub_after = 'true'::jsonb
                       then 'PUBLISHED' else 'UNPUBLISHED' end;
    else
      v_action := v_entity || '_UPDATED';
    end if;

    -- Skip no-op updates. Re-running an idempotent seed should not produce a
    -- log entry per row saying nothing changed.
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
