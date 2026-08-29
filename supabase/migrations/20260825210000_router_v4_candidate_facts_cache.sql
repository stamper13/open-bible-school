-- Router latency: cache stable V4 candidate facts.
--
-- Measurements showed the remaining hot path is the V4/V5 base selector, not
-- the V6 app wrapper. V4 repeatedly expands the question-bank view and calls
-- stable per-question helpers while ranking. This cache precomputes those
-- stable values and rewires V4 to read them from a small private table.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regprocedure('public.obs_effective_item_irt_a(jsonb,double precision)') is null
     or to_regprocedure('public.obs_effective_item_irt_b(jsonb,double precision)') is null
     or to_regprocedure('public.obs_focused_item_stage(text,jsonb,double precision)') is null
     or to_regprocedure('public.obs_router_information_reliability(jsonb,double precision,double precision)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Router candidate facts cache prerequisites are missing; nothing was changed.';
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
  '20260825210000_router_v4_candidate_facts_cache',
  'public',
  'obs_rank_ot_assessment_candidates_v4',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260825210000_router_v4_candidate_facts_cache'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
);

create table if not exists public.obs_router_candidate_facts (
  generated_question_id uuid primary key,
  question_type text,
  prompt text,
  payload jsonb not null,
  event_id uuid,
  resolved_event_title text,
  book_code text,
  section_key text,
  created_at timestamptz,
  routing_score numeric,
  importance_conceptual numeric,
  importance_context numeric,
  dimension_key text,
  stem_family text,
  question_family text,
  effective_a double precision not null,
  effective_b double precision not null,
  candidate_stage integer not null,
  information_reliability double precision not null,
  is_valid_assessment_candidate boolean not null,
  is_valid_section_screen boolean not null,
  refreshed_at timestamptz not null default now()
);

alter table public.obs_router_candidate_facts enable row level security;

revoke all on table public.obs_router_candidate_facts from public;
revoke all on table public.obs_router_candidate_facts from anon;
revoke all on table public.obs_router_candidate_facts from authenticated;
grant select, insert, update, delete on table public.obs_router_candidate_facts to service_role;

create index if not exists obs_router_candidate_facts_scope_idx
  on public.obs_router_candidate_facts (book_code, dimension_key, generated_question_id)
  where is_valid_assessment_candidate;

create index if not exists obs_router_candidate_facts_dimension_idx
  on public.obs_router_candidate_facts (dimension_key, book_code)
  where is_valid_assessment_candidate;

create index if not exists obs_router_candidate_facts_family_idx
  on public.obs_router_candidate_facts (question_family, stem_family)
  where is_valid_assessment_candidate;

create index if not exists obs_router_candidate_facts_section_screen_idx
  on public.obs_router_candidate_facts (section_key, generated_question_id)
  where is_valid_section_screen;

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
  v_valid integer;
begin
  select public.obs_refresh_router_candidate_facts()
  into v_refreshed;

  select count(*)::integer
  into v_valid
  from public.obs_router_candidate_facts
  where is_valid_assessment_candidate;

  if v_refreshed < 1000 or v_valid < 1000 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router candidate facts refresh produced too few rows: %s total, %s valid.',
        v_refreshed,
        v_valid
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
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v4 router candidate facts cache%' then
    raise notice 'V4 router candidate facts cache is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
    'public.obs_question_bank_with_dimensions question',
    'public.obs_router_candidate_facts question'
  );

  v_sql := replace(
    v_sql,
$old$
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as answer_stage,
$old$,
$new$
      question.candidate_stage as answer_stage,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      coalesce(
        event.event_title,
        question.book_code || ' question'
      ) as resolved_event_title,
$old$,
$new$
      question.resolved_event_title,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      public.obs_effective_item_irt_a(
        question.payload,
        event.irt_a::double precision
      ) as effective_a,
$old$,
$new$
      question.effective_a,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      ) as effective_b,
$old$,
$new$
      question.effective_b,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as candidate_stage,
$old$,
$new$
      question.candidate_stage,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
      public.obs_router_information_reliability(
        question.payload,
        event.irt_a::double precision,
        event.irt_b::double precision
      ) as information_reliability,
$old$,
$new$
      question.information_reliability,
$new$
  );

  v_sql := replace(
    v_sql,
$old$
    where question.generated_question_id is not null
      and coalesce(question.payload->>'prompt', question.prompt) is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        (
          question.question_type = 'sequence_order_v1'
          and jsonb_array_length(question.payload->'choices')
            between 3 and 5
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
            from jsonb_array_elements(
              question.payload->'choices'
            ) choice
            where choice->>'id' = coalesce(
              question.payload->>'correct_choice_id',
              question.payload->>'answer_id',
              question.payload->>'correctAnswerId'
            )
          )
        )
      )
$old$,
$new$
    -- v4 router candidate facts cache
    where question.is_valid_assessment_candidate
$new$
  );

  if v_sql = v_original
     or v_sql not like '%v4 router candidate facts cache%'
     or v_sql not like '%obs_router_candidate_facts question%'
     or v_sql not like '%question.effective_a%'
     or v_sql not like '%question.effective_b%'
     or v_sql not like '%question.information_reliability%'
     or v_sql not like '%question.is_valid_assessment_candidate%' then
    raise exception using
      errcode = 'P0001',
      message = 'V4 candidate facts patch did not match the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on table public.obs_router_candidate_facts is
  'Private cache of stable question facts used by OT router candidate ranking. '
  'Refresh with obs_refresh_router_candidate_facts after question-bank or event '
  'metadata changes.';

comment on function public.obs_refresh_router_candidate_facts() is
  'Service-role helper that refreshes stable OT router candidate facts from the '
  'question bank, dimensions, and event metadata.';

comment on function public.obs_rank_ot_assessment_candidates_v4(uuid, uuid, text, integer, timestamptz, integer) is
  'Ranks OT assessment candidates for router v4. Stable candidate facts are read '
  'from obs_router_candidate_facts to reduce per-call view expansion and helper '
  'work.';

revoke all on function public.obs_rank_ot_assessment_candidates_v4(uuid, uuid, text, integer, timestamptz, integer) from public, anon;
grant execute on function public.obs_rank_ot_assessment_candidates_v4(uuid, uuid, text, integer, timestamptz, integer) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
