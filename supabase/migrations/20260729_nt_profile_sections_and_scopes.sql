-- Support the NT BLI profile with distinct Gospels and Acts display/test scopes.
-- The existing GOSPELS_ACTS ability scope remains unchanged; these narrower
-- assessment scopes only control item selection and reporting.

begin;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_nt_profile_sections_and_scopes',
  'public',
  procedure.proname,
  'function',
  pg_get_functiondef(procedure.oid)
from pg_proc procedure
join pg_namespace namespace
  on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.oid in (
    'public.obs_nt_scope_key(text,text)'::regprocedure,
    'public.obs_nt_question_matches_scope(text,text,text)'::regprocedure,
    'public.obs_get_scope_summary(uuid,text,text)'::regprocedure
  )
  and not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260729_nt_profile_sections_and_scopes'
      and backup.object_schema = 'public'
      and backup.object_name = procedure.proname
      and backup.object_type = 'function'
  );

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_nt_profile_sections_and_scopes'
    and object_schema = 'public'
    and object_type = 'function'
    and object_name in (
      'obs_nt_scope_key',
      'obs_nt_question_matches_scope',
      'obs_get_scope_summary'
    );

  if backup_count <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT profile scope backup failed: functions=%s/3.',
        backup_count
      );
  end if;
end
$$;

create or replace function public.obs_nt_scope_key(
  p_section text,
  p_book_code text default null
)
returns text
language sql
stable
parallel safe
set search_path = public
as $$
  select case
    when p_book_code is not null then upper(btrim(p_book_code))
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      = 'GOSPELS' then 'GOSPELS'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      = 'ACTS' then 'ACTS'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('GOSPELS_ACTS', 'GOSPELS_AND_ACTS') then 'GOSPELS_ACTS'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('PAULINE', 'PAULINE_EPISTLES') then 'PAULINE'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('GENERAL', 'GENERAL_EPISTLES') then 'GENERAL'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('APOCALYPSE', 'REVELATION') then 'APOCALYPSE'
    else 'NT'
  end;
$$;

create or replace function public.obs_nt_question_matches_scope(
  p_book_code text,
  p_nt_division text,
  p_scope_key text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case upper(coalesce(p_scope_key, 'NT'))
    when 'NT' then true
    when 'GOSPELS' then
      upper(coalesce(p_book_code, '')) in ('MAT', 'MRK', 'LUK', 'JHN')
    when 'ACTS' then
      upper(coalesce(p_book_code, '')) = 'ACT'
    when 'GOSPELS_ACTS' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        in ('GOSPELS_ACTS', 'GOSPELS_AND_ACTS')
    when 'PAULINE' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        in ('PAULINE', 'PAULINE_EPISTLES')
    when 'GENERAL' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        in ('GENERAL', 'GENERAL_EPISTLES')
    when 'APOCALYPSE' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        = 'APOCALYPSE'
    else upper(coalesce(p_book_code, '')) = upper(p_scope_key)
  end;
$$;

create or replace function public.obs_get_scope_summary(
  p_user_id uuid,
  p_scope_type text,
  p_scope_key text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select
      upper(btrim(p_scope_type)) as scope_type,
      btrim(p_scope_key) as scope_key
    where public.obs_is_authorized_user(p_user_id)
      and upper(btrim(p_scope_type)) in (
        'TESTAMENT', 'SECTION', 'BOOK', 'DIMENSION', 'UNIT'
      )
  ),
  matched as (
    select
      evidence.*,
      unit.unit_key,
      unit.label as unit_label
    from public.obs_answer_evidence evidence
    cross join requested request
    left join public.obs_learning_units unit
      on unit.book_code = evidence.book_code
     and evidence.inferred_chapter between unit.start_chapter and unit.end_chapter
    where evidence.user_id = p_user_id
      and case request.scope_type
        when 'TESTAMENT' then evidence.testament = upper(request.scope_key)
        when 'SECTION' then case
          when upper(regexp_replace(request.scope_key, '[^A-Za-z0-9]+', '_', 'g'))
            = 'GOSPELS'
            then evidence.book_code in ('MAT', 'MRK', 'LUK', 'JHN')
          when upper(regexp_replace(request.scope_key, '[^A-Za-z0-9]+', '_', 'g'))
            = 'ACTS'
            then evidence.book_code = 'ACT'
          else lower(evidence.section) = lower(request.scope_key)
        end
        when 'BOOK' then evidence.book_code = upper(request.scope_key)
        when 'DIMENSION' then
          evidence.dimension_key = public.obs_normalize_dimension_key(
            case
              when upper(split_part(request.scope_key, ':', 1)) in ('OT', 'NT')
                then split_part(request.scope_key, ':', 2)
              else request.scope_key
            end
          )
          and (
            upper(split_part(request.scope_key, ':', 1)) not in ('OT', 'NT')
            or evidence.testament = upper(split_part(request.scope_key, ':', 1))
          )
        when 'UNIT' then unit.unit_key = request.scope_key
        else false
      end
  ),
  totals as (
    select
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      min(answered_at) as first_answered_at,
      max(answered_at) as last_answered_at
    from matched
  ),
  by_book as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'book_code', book_code,
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', round(correct::numeric / nullif(answered, 0) * 100, 1)
        )
        order by book_code
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        book_code,
        count(*)::integer as answered,
        count(*) filter (where is_correct)::integer as correct,
        count(*) filter (where is_idk)::integer as idk
      from matched
      group by book_code
    ) grouped
  ),
  by_dimension as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dimension_key', dimension_key,
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', round(correct::numeric / nullif(answered, 0) * 100, 1)
        )
        order by dimension_key
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        dimension_key,
        count(*)::integer as answered,
        count(*) filter (where is_correct)::integer as correct,
        count(*) filter (where is_idk)::integer as idk
      from matched
      group by dimension_key
    ) grouped
  )
  select jsonb_build_object(
    'scope_type', requested.scope_type,
    'scope_key', requested.scope_key,
    'answered', totals.answered,
    'correct', totals.correct,
    'idk', totals.idk,
    'accuracy', round(totals.correct::numeric / nullif(totals.answered, 0) * 100, 1),
    'first_answered_at', totals.first_answered_at,
    'last_answered_at', totals.last_answered_at,
    'evidence_level', case
      when totals.answered < 5 then 'Needs more evidence'
      when totals.answered < 12 then 'Low evidence'
      when totals.answered < 25 then 'Moderate evidence'
      else 'High evidence'
    end,
    'books', by_book.value,
    'dimensions', by_dimension.value
  )
  from requested
  cross join totals
  cross join by_book
  cross join by_dimension;
$$;

comment on function public.obs_nt_scope_key(text, text) is
  'Normalizes broad, division, Gospels-only, Acts-only, and book NT assessment scopes.';
comment on function public.obs_nt_question_matches_scope(text, text, text) is
  'Matches NT questions to broad, division, Gospels-only, Acts-only, or book scopes.';
comment on function public.obs_get_scope_summary(uuid, text, text) is
  'Authorized learner evidence summary, including distinct Gospels/Acts sections and testament-qualified dimensions.';

grant execute on function public.obs_nt_scope_key(text, text)
  to anon, authenticated, service_role;
grant execute on function public.obs_nt_question_matches_scope(text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.obs_get_scope_summary(uuid, text, text)
  to anon, authenticated, service_role;

do $$
begin
  if public.obs_nt_scope_key('Gospels', null) <> 'GOSPELS'
     or public.obs_nt_scope_key('Acts', null) <> 'ACTS'
     or not public.obs_nt_question_matches_scope('MAT', 'Gospels_Acts', 'GOSPELS')
     or public.obs_nt_question_matches_scope('ACT', 'Gospels_Acts', 'GOSPELS')
     or not public.obs_nt_question_matches_scope('ACT', 'Gospels_Acts', 'ACTS')
     or public.obs_nt_question_matches_scope('JHN', 'Gospels_Acts', 'ACTS')
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT Gospels/Acts scope verification failed.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
