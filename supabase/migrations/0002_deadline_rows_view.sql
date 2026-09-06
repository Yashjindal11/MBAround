-- ===========================================================================
-- MBAround — 0002 deadline_rows view
-- ===========================================================================
-- One flattened, join-free read surface powering the deadlines page, school
-- pages, timeline and comparison. Filtering/sorting happens in Postgres so a
-- page never downloads every school + programme + round to render 20 results.
-- ===========================================================================

create or replace view deadline_rows
with (security_invoker = true)
as
select
  r.id                  as round_id,
  r.name                as round_name,
  r.display_order       as round_order,
  r.deadline,
  r.decision_date,
  r.is_announced,
  r.is_verified,
  r.source_url,
  r.source_name,
  r.last_verified,
  r.notes,
  c.id                  as cycle_id,
  c.cycle_name,
  c.status              as cycle_status,
  c.is_current          as cycle_is_current,
  p.id                  as program_id,
  p.name                as program_name,
  p.program_type,
  p.duration_months,
  s.id                  as school_id,
  s.name                as school_name,
  s.slug                as school_slug,
  s.short_name          as school_short_name,
  s.country,
  s.region,
  s.state,
  s.city,
  s.admissions_url
from application_rounds r
join application_cycles c on c.id = r.application_cycle_id
join programs           p on p.id = c.program_id
join schools            s on s.id = p.school_id
where s.is_published
  and p.is_published
  and c.status <> 'DRAFT';

comment on view deadline_rows is
  'Flattened published rounds. security_invoker=true so the caller''s RLS applies.';
