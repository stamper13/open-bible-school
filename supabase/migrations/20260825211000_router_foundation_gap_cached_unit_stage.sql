-- Router latency: cache unit/stage lookup for dashboard foundation-gap guard.
--
-- The 200-question replay timed out after the V4 candidate cache because the
-- public next-question wrapper still checked dashboard foundation gaps by
-- expanding obs_question_bank_with_units and recomputing focused item stage.
-- The candidate cache already stores stage; this patch adds unit_key and uses
-- cached unit/stage rows for that guard.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.obs_router_candidate_facts') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure('public.obs_refresh_router_candidate_facts()') is null
     or to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Foundation-gap cached unit/stage prerequisites are missing; nothing was changed.';
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
  '20260825211000_router_foundation_gap_cached_unit_stage',
  'public',
  'obs_refresh_router_candidate_facts',
  'function',
  pg_get_functiondef('public.obs_refresh_router_candidate_facts()'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260825211000_router_foundation_gap_cached_unit_stage'
    and backup.object_name = 'obs_refresh_router_candidate_facts'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260825211000_router_foundation_gap_cached_unit_stage',
  'public',
  'get_next_assessment_question',
  'function',
  pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260825211000_router_foundation_gap_cached_unit_stage'
    and backup.object_name = 'get_next_assessment_question'
);

alter table public.obs_router_candidate_facts
  add column if not exists unit_key text;

create index if not exists obs_router_candidate_facts_unit_stage_idx
  on public.obs_router_candidate_facts (unit_key, candidate_stage, generated_question_id)
  where unit_key is not null
    and is_valid_assessment_candidate;

create or replace function public.obs_refresh_router_candidate_facts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refreshed integer;
begin
  truncate table public.obs_router_candidate_facts;

  insert into public.obs_router_candidate_facts (
    generated_question_id,
    question_type,
    prompt,
    payload,
    event_id,
    resolved_event_title,
    book_code,
    section_key,
    unit_key,
    created_at,
    routing_score,
    importance_conceptual,
    importance_context,
    dimension_key,
    stem_family,
    question_family,
    effective_a,
    effective_b,
    candidate_stage,
    information_reliability,
    is_valid_assessment_candidate,
    is_valid_section_screen,
    refreshed_at
  )
  select
    question.generated_question_id,
    question.question_type,
    coalesce(question.payload->>'prompt', question.prompt),
    question.payload,
    question.event_id,
    coalesce(event.event_title, question.book_code || ' question'),
    question.book_code,
    public.canonical_assessment_scope(question.book_code),
    unit_question.unit_key,
    question.created_at,
    question.routing_score,
    question.importance_conceptual,
    question.importance_context,
    question.dimension_key,
    nullif(question.payload->>'stem_family', ''),
    nullif(lower(btrim(question.payload->>'question_family')), ''),
    public.obs_effective_item_irt_a(
      question.payload,
      event.irt_a::double precision
    ),
    public.obs_effective_item_irt_b(
      question.payload,
      event.irt_b::double precision
    ),
    public.obs_focused_item_stage(
      question.question_type,
      question.payload,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      )
    ),
    public.obs_router_information_reliability(
      question.payload,
      event.irt_a::double precision,
      event.irt_b::double precision
    ),
    (
      question.generated_question_id is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        (
          question.question_type = 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices') between 3 and 5
          and jsonb_typeof(question.payload->'correct_order') = 'array'
          and jsonb_array_length(question.payload->'correct_order')
            = jsonb_array_length(question.payload->'choices')
        )
        or (
          question.question_type <> 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices') = 4
          and coalesce(
            question.payload->>'correct_choice_id',
            question.payload->>'answer_id',
            question.payload->>'correctAnswerId'
          ) is not null
          and exists (
            select 1
            from jsonb_array_elements(question.payload->'choices') choice
            where choice->>'id' = coalesce(
              question.payload->>'correct_choice_id',
              question.payload->>'answer_id',
              question.payload->>'correctAnswerId'
            )
          )
        )
      )
    ),
    (
      question.question_type = 'section_screen_mcq_v1'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') = 4
    ),
    now()
  from public.obs_question_bank_with_dimensions question
  left join public.bible_events event
    on event.id = question.event_id
  left join public.obs_question_bank_with_units unit_question
    on unit_question.generated_question_id = question.generated_question_id
  where question.generated_question_id is not null;

  get diagnostics v_refreshed = row_count;
  analyze public.obs_router_candidate_facts;
  return v_refreshed;
end;
$$;

revoke all on function public.obs_refresh_router_candidate_facts() from public;
revoke all on function public.obs_refresh_router_candidate_facts() from anon;
revoke all on function public.obs_refresh_router_candidate_facts() from authenticated;
grant execute on function public.obs_refresh_router_candidate_facts() to service_role;

do $$
declare
  v_refreshed integer;
  v_unit_stage_rows integer;
begin
  select public.obs_refresh_router_candidate_facts()
  into v_refreshed;

  select count(*)::integer
  into v_unit_stage_rows
  from public.obs_router_candidate_facts
  where unit_key is not null
    and candidate_stage = 1
    and is_valid_assessment_candidate;

  if v_refreshed < 1000 or v_unit_stage_rows < 100 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router candidate facts unit/stage refresh produced too few rows: %s total, %s unit stage-1.',
        v_refreshed,
        v_unit_stage_rows
      );
  end if;
end
$$;

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%dashboard foundation-gap cached unit stage%' then
    raise notice 'Dashboard foundation-gap cached unit stage is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$old$
  select exists (
    select 1
    from public.obs_get_ladder_state_v1(p_user_id) ladder
    where ladder.is_focus
      and ladder.state = 'insufficient_evidence'
      and public.obs_unit_has_foundation_items(ladder.unit_key)
      and not exists (
        select 1
        from public.assessment_answers answer
        join public.obs_question_bank_with_units question
          on question.generated_question_id = answer.generated_question_id
        left join public.bible_events event
          on event.id = question.event_id
        where answer.user_id = p_user_id
          and answer.scoring_eligible
          and question.unit_key = ladder.unit_key
          and public.obs_focused_item_stage(
            question.question_type,
            question.payload,
            public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
          ) = 1
      )
      and exists (
        select 1
        from public.obs_question_bank_with_units question
        left join public.bible_events event
          on event.id = question.event_id
        where question.unit_key = ladder.unit_key
          and question.payload ? 'choices'
          and jsonb_typeof(question.payload->'choices') = 'array'
          and public.obs_focused_item_stage(
            question.question_type,
            question.payload,
            public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
          ) = 1
          and not exists (
            select 1
            from public.assessment_answers previous
            where previous.user_id = p_user_id
              and previous.generated_question_id = question.generated_question_id
              and previous.scoring_eligible
          )
      )
  )
  into v_dashboard_foundation_gap;
$old$,
$new$
  -- dashboard foundation-gap cached unit stage
  select exists (
    select 1
    from public.obs_get_ladder_state_v1(p_user_id) ladder
    where ladder.is_focus
      and ladder.state = 'insufficient_evidence'
      and not exists (
        select 1
        from public.assessment_answers answer
        join public.obs_router_candidate_facts question
          on question.generated_question_id = answer.generated_question_id
        where answer.user_id = p_user_id
          and answer.scoring_eligible
          and question.unit_key = ladder.unit_key
          and question.candidate_stage = 1
      )
      and exists (
        select 1
        from public.obs_router_candidate_facts question
        where question.unit_key = ladder.unit_key
          and question.candidate_stage = 1
          and question.is_valid_assessment_candidate
          and not exists (
            select 1
            from public.assessment_answers previous
            where previous.user_id = p_user_id
              and previous.generated_question_id = question.generated_question_id
              and previous.scoring_eligible
          )
      )
  )
  into v_dashboard_foundation_gap;
$new$
  );

  if v_sql = v_original
     or v_sql not like '%dashboard foundation-gap cached unit stage%'
     or v_sql not like '%obs_router_candidate_facts question%'
     or v_sql like '%obs_unit_has_foundation_items(ladder.unit_key)%'
     or v_sql like '%from public.obs_question_bank_with_units question%left join public.bible_events event%' then
    raise exception using
      errcode = 'P0001',
      message = 'Dashboard foundation-gap cached unit/stage patch did not match the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_refresh_router_candidate_facts() is
  'Service-role helper that refreshes stable OT router candidate facts, including '
  'unit/stage facts for cached foundation-gap checks.';

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. Dashboard foundation-gap checks use '
  'cached unit/stage candidate facts.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
