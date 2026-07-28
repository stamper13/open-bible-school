-- Replace the universal historical-Writings gate with book-specific context.
--
-- Universal recommendation foundation:
--   Torah -> Former Prophets through 2 Kings.
--
-- Conditional context:
--   Chronicles supports prophets centered on Judah, David, Zion, and temple.
--   Ezra-Nehemiah supports the post-exilic prophets.
--
-- These dependencies affect recommendation order only. They never award BLI
-- credit, infer a correct response, or suppress measured prophetic weaknesses.

begin;

do $$
declare
  historical_unit_count integer;
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regprocedure(
       'public.obs_get_user_recommendation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_get_unit_mastery_score(uuid,text,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Conditional prophetic-dependency prerequisites are missing; nothing changed.';
  end if;

  select count(*)::integer
  into historical_unit_count
  from public.obs_learning_units
  where unit_key in (
    '1ch-1-29',
    '2ch-1-36',
    'ezr-1-10',
    'neh-1-13'
  )
    and is_foundation;

  if historical_unit_count <> 4 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected four globally foundational historical-Writings units before conversion; found %s.',
        historical_unit_count
      );
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260728_conditional_prophetic_recommendation_dependencies',
  'public',
  'obs_get_user_recommendation_v2',
  'function',
  pg_get_functiondef(
    'public.obs_get_user_recommendation_v2(uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260728_conditional_prophetic_recommendation_dependencies'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_get_user_recommendation_v2'
    and backup.object_type = 'function'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260728_conditional_prophetic_recommendation_dependencies',
  'public',
  'obs_learning_units_conditional_history',
  'data',
  jsonb_agg(to_jsonb(unit) order by unit.sequence_order)::text
from public.obs_learning_units unit
where unit.unit_key in (
  '1ch-1-29',
  '2ch-1-36',
  'ezr-1-10',
  'neh-1-13'
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260728_conditional_prophetic_recommendation_dependencies'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_learning_units_conditional_history'
    and backup.object_type = 'data'
);

do $$
declare
  function_backups integer;
  data_backups integer;
  data_rows integer;
begin
  select count(*)::integer
  into function_backups
  from public.obs_schema_backups
  where backup_tag =
      '20260728_conditional_prophetic_recommendation_dependencies'
    and object_schema = 'public'
    and object_name = 'obs_get_user_recommendation_v2'
    and object_type = 'function';

  select
    count(*)::integer,
    max(jsonb_array_length(definition::jsonb))
  into data_backups, data_rows
  from public.obs_schema_backups
  where backup_tag =
      '20260728_conditional_prophetic_recommendation_dependencies'
    and object_schema = 'public'
    and object_name = 'obs_learning_units_conditional_history'
    and object_type = 'data';

  if function_backups <> 1
     or data_backups <> 1
     or data_rows <> 4
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Conditional dependency backup failed: function=%s data=%s/%s.',
        function_backups,
        data_backups,
        data_rows
      );
  end if;
end
$$;

create table if not exists
  public.obs_prophetic_recommendation_dependencies (
    target_book_code text not null,
    prerequisite_unit_key text not null
      references public.obs_learning_units(unit_key)
      on delete restrict,
    priority integer not null,
    rationale text not null,
    created_at timestamptz not null default now(),
    primary key (target_book_code, prerequisite_unit_key),
    constraint obs_prophetic_dependency_book_ck
      check (target_book_code = upper(target_book_code)),
    constraint obs_prophetic_dependency_priority_ck
      check (priority between 1 and 100)
  );

alter table public.obs_prophetic_recommendation_dependencies
  enable row level security;

insert into public.obs_prophetic_recommendation_dependencies (
  target_book_code,
  prerequisite_unit_key,
  priority,
  rationale
)
values
  (
    'ISA', '1ch-1-29', 10,
    'Davidic kingship, Zion, temple, and worship supply Isaiah''s historical framework.'
  ),
  (
    'ISA', '2ch-1-36', 20,
    'Judah''s monarchy, Assyria, reform, and exile frame Isaiah''s ministry.'
  ),
  (
    'MIC', '2ch-1-36', 10,
    'Judah''s monarchy and Assyrian crisis frame Micah''s warnings and hope.'
  ),
  (
    'JER', '2ch-1-36', 10,
    'Judah''s final kings, reform, apostasy, and exile frame Jeremiah.'
  ),
  (
    'LAM', '2ch-1-36', 10,
    'Jerusalem''s fall and exile provide Lamentations'' historical setting.'
  ),
  (
    'EZE', '2ch-1-36', 10,
    'The collapse of Judah and exile provide Ezekiel''s historical setting.'
  ),
  (
    'DAN', '2ch-1-36', 10,
    'Judah''s collapse and Babylonian exile provide Daniel''s setting.'
  ),
  (
    'HAB', '2ch-1-36', 10,
    'Judah''s late monarchy and Babylonian threat frame Habakkuk.'
  ),
  (
    'ZEP', '2ch-1-36', 10,
    'Judah''s late monarchy and reform setting frame Zephaniah.'
  ),
  (
    'HAG', '2ch-1-36', 10,
    'Exile and Cyrus''s decree connect Judah''s history to Haggai.'
  ),
  (
    'HAG', 'ezr-1-10', 20,
    'The return and temple rebuilding are Haggai''s immediate context.'
  ),
  (
    'ZEC', '2ch-1-36', 10,
    'Exile and restoration connect Judah''s history to Zechariah.'
  ),
  (
    'ZEC', 'ezr-1-10', 20,
    'The return and temple rebuilding are Zechariah''s immediate context.'
  ),
  (
    'MAL', '2ch-1-36', 10,
    'The history of temple, exile, and return frames Malachi.'
  ),
  (
    'MAL', 'ezr-1-10', 20,
    'Restored worship and covenant reform provide Malachi''s context.'
  ),
  (
    'MAL', 'neh-1-13', 30,
    'Nehemiah''s post-exilic reforms closely parallel Malachi''s concerns.'
  )
on conflict (target_book_code, prerequisite_unit_key) do update set
  priority = excluded.priority,
  rationale = excluded.rationale;

update public.obs_learning_units
set is_foundation = false
where unit_key in (
  '1ch-1-29',
  '2ch-1-36',
  'ezr-1-10',
  'neh-1-13'
);

create or replace function public.obs_get_user_recommendation_v2(
  p_user_id uuid
)
returns table (
  unit_key text,
  label text,
  section text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  sequence_order integer,
  is_foundation boolean,
  answered integer,
  correct integer,
  raw_score numeric,
  display_score integer,
  baseline_display_score_required integer,
  retest_question_target integer,
  focus_text text,
  reason text,
  recommendation_kind text,
  dimension_key text,
  dimension_label text,
  dimension_short_label text,
  dimension_answered integer,
  dimension_correct integer,
  dimension_display_score integer,
  dimension_available_questions integer,
  dimension_focus_text text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
  ),
  scored_units as (
    select
      unit.*,
      mastery.answered,
      mastery.correct,
      mastery.raw_score,
      mastery.display_score,
      mastery.highest_stage_attempted
    from public.obs_learning_units unit
    join authorized on true
    cross join lateral public.obs_get_unit_mastery_score(
      p_user_id,
      unit.unit_key,
      null
    ) mastery
  ),
  foundation_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Universal biblical-history foundation needs more evidence'
        else 'Universal biblical-history foundation is below baseline'
      end as unit_reason
    from scored_units scored
    where is_foundation
      and (
        answered < min_answers_required
        or coalesce(display_score, 0) <
          baseline_display_score_required
      )
    order by sequence_order
    limit 1
  ),
  dependency_unit_keys as (
    select distinct prerequisite_unit_key as unit_key
    from public.obs_prophetic_recommendation_dependencies
  ),
  later_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Later unit needs more ladder evidence'
        else 'Lowest post-foundation mastery score'
      end as unit_reason
    from scored_units scored
    where not is_foundation
      and not exists (
        select 1
        from dependency_unit_keys dependency
        where dependency.unit_key = scored.unit_key
      )
      and (
        answered < min_answers_required
        or coalesce(display_score, 0) <
          baseline_display_score_required
      )
    order by
      case when answered < min_answers_required then 0 else 1 end,
      coalesce(display_score, 0),
      sequence_order
    limit 1
  ),
  dependency_gap as (
    select
      prerequisite.*,
      'Historical context needed before '
        || target.label as unit_reason
    from later_gap target
    join public.obs_prophetic_recommendation_dependencies dependency
      on dependency.target_book_code = target.book_code
    join scored_units prerequisite
      on prerequisite.unit_key = dependency.prerequisite_unit_key
    where prerequisite.answered <
        prerequisite.min_answers_required
       or coalesce(prerequisite.display_score, 0) <
        prerequisite.baseline_display_score_required
    order by
      dependency.priority,
      prerequisite.sequence_order
    limit 1
  ),
  standalone_dependency_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Historical context unit needs more evidence'
        else 'Historical context unit is below baseline'
      end as unit_reason
    from scored_units scored
    join dependency_unit_keys dependency
      on dependency.unit_key = scored.unit_key
    where answered < min_answers_required
       or coalesce(display_score, 0) <
        baseline_display_score_required
    order by
      case when answered < min_answers_required then 0 else 1 end,
      coalesce(display_score, 0),
      sequence_order
    limit 1
  ),
  selected as (
    select * from foundation_gap
    union all
    select * from dependency_gap
    where not exists (select 1 from foundation_gap)
    union all
    select * from later_gap
    where not exists (select 1 from foundation_gap)
      and not exists (select 1 from dependency_gap)
    union all
    select * from standalone_dependency_gap
    where not exists (select 1 from foundation_gap)
      and not exists (select 1 from dependency_gap)
      and not exists (select 1 from later_gap)
    limit 1
  ),
  available_dimensions as (
    select
      selected.unit_key,
      selected.baseline_display_score_required,
      dimension.dimension_key,
      dimension.label as dimension_label,
      dimension.short_label as dimension_short_label,
      dimension.description as dimension_focus_text,
      dimension.sort_order,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      ))::integer as available_questions
    from selected
    join public.obs_question_bank_with_units question
      on question.unit_key = selected.unit_key
      or (
        selected.start_chapter = 1
        and question.book_code = selected.book_code
        and question.question_type = 'book_orientation_mcq_v1'
      )
    join public.obs_bli_dimensions dimension
      on dimension.dimension_key = question.dimension_key
     and not dimension.is_advanced
    group by
      selected.unit_key,
      selected.baseline_display_score_required,
      dimension.dimension_key,
      dimension.label,
      dimension.short_label,
      dimension.description,
      dimension.sort_order
  ),
  scored_dimensions as (
    select
      available.*,
      mastery.answered,
      mastery.correct,
      mastery.display_score
    from available_dimensions available
    cross join lateral public.obs_get_unit_mastery_score(
      p_user_id,
      available.unit_key,
      available.dimension_key
    ) mastery
  ),
  selected_dimension as (
    select dimension.*
    from scored_dimensions dimension
    where dimension.available_questions >= 8
      and dimension.answered >= 3
      and coalesce(dimension.display_score, 800)
        < dimension.baseline_display_score_required
    order by
      dimension.display_score,
      dimension.answered desc,
      dimension.sort_order
    limit 1
  )
  select
    selected.unit_key,
    selected.label,
    selected.section,
    selected.book_code,
    selected.start_chapter,
    selected.end_chapter,
    selected.sequence_order,
    selected.is_foundation,
    selected.answered,
    selected.correct,
    selected.raw_score,
    selected.display_score,
    selected.baseline_display_score_required,
    case
      when dimension.dimension_key is null
        then selected.retest_question_target
      else least(
        selected.retest_question_target,
        dimension.available_questions
      )
    end,
    selected.focus_text,
    case
      when dimension.dimension_key is null then selected.unit_reason
      else 'Weakest supported dimension inside the selected learning unit'
    end,
    case
      when dimension.dimension_key is null then 'UNIT'
      else 'DIMENSION'
    end,
    dimension.dimension_key,
    dimension.dimension_label,
    dimension.dimension_short_label,
    dimension.answered,
    dimension.correct,
    dimension.display_score,
    dimension.available_questions,
    dimension.dimension_focus_text
  from selected
  left join selected_dimension dimension
    on dimension.unit_key = selected.unit_key;
$$;

revoke all on table
  public.obs_prophetic_recommendation_dependencies
  from public, anon, authenticated;
grant select on table
  public.obs_prophetic_recommendation_dependencies
  to service_role;

revoke all on function
  public.obs_get_user_recommendation_v2(uuid)
  from public, anon;
grant execute on function
  public.obs_get_user_recommendation_v2(uuid)
  to authenticated, service_role;

comment on function public.obs_get_user_recommendation_v2(uuid) is
  'Recommends the earliest universal foundation gap, then applies book-specific historical prerequisites before a prophetic target; preserves dimension-aware focused retesting.';

notify pgrst, 'reload schema';

commit;
