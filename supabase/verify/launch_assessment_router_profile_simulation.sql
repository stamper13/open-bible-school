-- Launch-gate assessment routing and scoring simulation.
--
-- Purpose:
--   Exercise the same OT/NT start -> next question -> submit -> BLI score path
--   used by the frontend with synthetic learner profiles.
--
-- Safety:
--   This script runs in one transaction and ends with rollback. It inserts
--   temporary anonymous auth users and assessment rows only long enough to
--   capture diagnostics.
--
-- Recommended run:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/verify/launch_assessment_router_profile_simulation.sql

begin;

set local lock_timeout = '5s';
set local statement_timeout = :'launch_statement_timeout';

create temporary table obs_launch_profiles (
  profile_key text primary key,
  testament text not null check (testament in ('OT', 'NT')),
  strong_scopes text[] not null default '{}',
  weak_scopes text[] not null default '{}',
  strong_dimensions text[] not null default '{}',
  weak_dimensions text[] not null default '{}',
  base_correct_pct integer not null,
  strong_correct_pct integer not null,
  weak_correct_pct integer not null,
  base_idk_pct integer not null,
  weak_idk_pct integer not null
) on commit drop;

insert into obs_launch_profiles (
  profile_key,
  testament,
  strong_scopes,
  weak_scopes,
  strong_dimensions,
  weak_dimensions,
  base_correct_pct,
  strong_correct_pct,
  weak_correct_pct,
  base_idk_pct,
  weak_idk_pct
) values
  (
    'OT_BEGINNER',
    'OT',
    '{}',
    array['TORAH', 'FORMER', 'LATTER', 'WRITINGS'],
    '{}',
    '{}',
    35,
    55,
    18,
    20,
    45
  ),
  (
    'OT_TORAH_STRONG_FORMER_WEAK',
    'OT',
    array['TORAH'],
    array['FORMER'],
    '{}',
    '{}',
    62,
    92,
    24,
    8,
    36
  ),
  (
    'OT_PROPHETS_STRONG_TORAH_WEAK',
    'OT',
    array['LATTER'],
    array['TORAH'],
    '{}',
    '{}',
    60,
    92,
    22,
    8,
    38
  ),
  (
    'OT_ADVANCED_GEOGRAPHY_WEAK',
    'OT',
    array['TORAH', 'FORMER', 'LATTER', 'WRITINGS'],
    '{}',
    '{}',
    array['geography_nations'],
    84,
    96,
    30,
    4,
    34
  ),
  (
    'NT_BEGINNER',
    'NT',
    '{}',
    array['GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'],
    '{}',
    '{}',
    38,
    55,
    20,
    18,
    42
  ),
  (
    'NT_GOSPELS_STRONG_EPISTLES_WEAK',
    'NT',
    array['GOSPELS_ACTS'],
    array['PAULINE', 'GENERAL'],
    '{}',
    '{}',
    62,
    92,
    24,
    8,
    34
  ),
  (
    'NT_PAUL_STRONG_GOSPELS_WEAK',
    'NT',
    array['PAULINE'],
    array['GOSPELS_ACTS'],
    '{}',
    '{}',
    60,
    90,
    24,
    8,
    34
  ),
  (
    'NT_ADVANCED_GOSPELS_ACTS_WEAK',
    'NT',
    array['PAULINE', 'GENERAL', 'APOCALYPSE'],
    array['GOSPELS_ACTS'],
    '{}',
    '{}',
    82,
    96,
    28,
    4,
    34
  );

delete from obs_launch_profiles
where :'launch_testament' <> 'ALL'
  and testament <> :'launch_testament';

do $preflight$
begin
  if to_regprocedure(
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)'
     ) is null then
    raise exception using
      errcode = 'P0001',
      message = 'Launch simulation requires 20260821125302_diversify_ot_baseline_fast_selector.sql to be deployed first.';
  end if;
end
$preflight$;

create temporary table obs_launch_question_keys as
select
  question.generated_question_id,
  question.question_type,
  question.book_code,
  question.dimension_key,
  question.payload,
  coalesce(question.payload->>'prompt', question.prompt) as prompt,
  public.canonical_assessment_scope(question.book_code) as ot_scope,
  nullif(question.payload->>'stem_family', '') as stem_family,
  public.obs_assessment_question_similarity_key(
    question.payload,
    question.book_code,
    question.dimension_key,
    question.question_type,
    coalesce(question.payload->>'prompt', question.prompt)
  ) as similarity_key,
  coalesce(
    question.payload->>'correct_choice_id',
    question.payload->>'answer_id',
    question.payload->>'correctAnswerId'
  ) as correct_choice_id,
  nullif(question.payload->>'correct_answer', '') as correct_answer
from public.obs_question_bank_with_dimensions question
where question.generated_question_id is not null;

create index on obs_launch_question_keys (generated_question_id);

create temporary table obs_launch_runs (
  run_id uuid primary key,
  profile_key text not null,
  testament text not null,
  run_number integer not null,
  user_id uuid not null,
  attempt_id uuid,
  target_question_count integer not null,
  started_ok boolean not null default false,
  error_message text
) on commit drop;

create temporary table obs_launch_items (
  run_id uuid not null,
  profile_key text not null,
  testament text not null,
  run_number integer not null,
  item_number integer not null,
  generated_question_id uuid not null,
  book_code text,
  scope_key text,
  dimension_key text,
  question_type text,
  similarity_key text,
  answer_mode text not null,
  is_correct boolean not null,
  is_idk boolean not null,
  answered_count integer,
  target_question_count integer,
  prompt text,
  primary key (run_id, item_number)
) on commit drop;

create temporary table obs_launch_scores (
  run_id uuid primary key,
  profile_key text not null,
  testament text not null,
  run_number integer not null,
  ot_display_bli integer,
  ot_questions_answered integer,
  ot_accuracy_pct numeric,
  ot_section_scores jsonb,
  nt_display_bli integer,
  nt_questions_answered integer,
  nt_accuracy_pct numeric,
  nt_section_scores jsonb,
  combined_available boolean
) on commit drop;

create temporary table obs_launch_first_questions (
  profile_key text not null,
  testament text not null,
  run_number integer not null,
  generated_question_id uuid not null,
  book_code text,
  scope_key text,
  prompt text
) on commit drop;

grant all on table
  obs_launch_profiles,
  obs_launch_question_keys,
  obs_launch_runs,
  obs_launch_items,
  obs_launch_scores,
  obs_launch_first_questions
to authenticated;

insert into obs_launch_runs (
  run_id,
  profile_key,
  testament,
  run_number,
  user_id,
  target_question_count
)
select
  gen_random_uuid(),
  profile.profile_key,
  profile.testament,
  run_number,
  gen_random_uuid(),
  :'launch_question_count'::integer
from obs_launch_profiles profile
cross join generate_series(1, :'launch_run_count'::integer) as run_number;

insert into auth.users (
  id,
  aud,
  role,
  is_anonymous,
  created_at,
  updated_at
)
select
  run.user_id,
  'authenticated',
  'authenticated',
  true,
  now(),
  now()
from obs_launch_runs run;

do $simulation$
declare
  v_run record;
  v_profile obs_launch_profiles%rowtype;
  v_start jsonb;
  v_question jsonb;
  v_question_key obs_launch_question_keys%rowtype;
  v_submit jsonb;
  v_score jsonb;
  v_item integer;
  v_scope text;
  v_correct_pct integer;
  v_idk_pct integer;
  v_roll integer;
  v_idk_roll integer;
  v_should_correct boolean;
  v_should_idk boolean;
  v_response text;
  v_displayed_choice_text text;
  v_wrong_choice_id text;
  v_reverse_order jsonb;
  v_section_sort_assignments jsonb;
begin
  for v_run in
    select *
    from obs_launch_runs
    order by testament, profile_key, run_number
  loop
    select *
    into strict v_profile
    from obs_launch_profiles
    where profile_key = v_run.profile_key;

    perform set_config('request.jwt.claim.sub', v_run.user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    if v_run.testament = 'OT' then
      select to_jsonb(start_row)
      into v_start
      from public.obs_start_or_resume_ot_assessment_v2(
        null,
        null,
        null,
        null,
        v_run.target_question_count,
        true,
        null
      ) start_row;
    else
      select to_jsonb(start_row)
      into v_start
      from public.obs_start_nt_assessment(
        null,
        null,
        v_run.target_question_count
      ) start_row;
    end if;

    update obs_launch_runs
    set
      attempt_id = (v_start->>'attempt_id')::uuid,
      started_ok = (v_start ? 'attempt_id')
    where run_id = v_run.run_id;

    for v_item in 1..v_run.target_question_count
    loop
      if v_run.testament = 'OT' then
        select to_jsonb(question_row)
        into v_question
        from public.obs_get_next_ot_assessment_question(
          (v_start->>'attempt_id')::uuid
        ) question_row;
      else
        select to_jsonb(question_row)
        into v_question
        from public.obs_get_next_nt_assessment_question(
          (v_start->>'attempt_id')::uuid
        ) question_row;
      end if;

      if v_question is null
         or not (v_question ? 'out_generated_question_id') then
        exit;
      end if;

      select *
      into strict v_question_key
      from obs_launch_question_keys
      where generated_question_id =
        (v_question->>'out_generated_question_id')::uuid;

      v_scope := case
        when v_run.testament = 'OT' then v_question_key.ot_scope
        else upper(coalesce(v_question->>'nt_division', 'NT'))
      end;

      v_correct_pct := case
        when v_scope = any(v_profile.strong_scopes)
          or (
            v_question_key.dimension_key is not null
            and v_question_key.dimension_key = any(v_profile.strong_dimensions)
          )
          then v_profile.strong_correct_pct
        when v_scope = any(v_profile.weak_scopes)
          or (
            v_question_key.dimension_key is not null
            and v_question_key.dimension_key = any(v_profile.weak_dimensions)
          )
          then v_profile.weak_correct_pct
        else v_profile.base_correct_pct
      end;

      v_idk_pct := case
        when v_scope = any(v_profile.weak_scopes)
          or (
            v_question_key.dimension_key is not null
            and v_question_key.dimension_key = any(v_profile.weak_dimensions)
          )
          then v_profile.weak_idk_pct
        else v_profile.base_idk_pct
      end;

      v_roll := mod(abs(hashtext(
        v_run.profile_key || ':' || v_run.run_number || ':' ||
        v_question_key.generated_question_id::text
      )), 100);
      v_idk_roll := mod(abs(hashtext(
        'IDK:' || v_run.profile_key || ':' || v_run.run_number || ':' ||
        v_question_key.generated_question_id::text
      )), 100);
      v_should_correct := v_roll < v_correct_pct;
      v_should_idk := not v_should_correct and v_idk_roll < v_idk_pct;

      if v_question_key.question_type = 'ot_book_section_sort_v1' then
        select jsonb_agg(
          jsonb_build_object(
            'text',
            coalesce(choice->>'text', choice->>'label', choice->>'id'),
            'section_key',
            '__IDK__'
          )
          order by choice_ordinality
        )
        into v_section_sort_assignments
        from jsonb_array_elements(v_question->'choices')
          with ordinality as choice(choice, choice_ordinality);

        v_response := '__SECTION_SORT__';
        v_should_correct := false;
        v_should_idk := true;
      elsif v_should_idk then
        v_response := '__IDK__';
      elsif public.obs_is_order_response_question(
        v_question_key.question_type,
        v_question_key.payload
      ) then
        if v_should_correct then
          v_response := '__ORDER__:' ||
            coalesce(v_question_key.payload->'correct_order', '[]'::jsonb)::text;
        else
          select jsonb_agg(item.value order by item.ordinality desc)
          into v_reverse_order
          from jsonb_array_elements_text(
            coalesce(v_question_key.payload->'correct_order', '[]'::jsonb)
          ) with ordinality item(value, ordinality);
          v_response := '__ORDER__:' || coalesce(v_reverse_order, '[]'::jsonb)::text;
        end if;
      elsif v_should_correct then
        v_response := coalesce(v_question_key.correct_choice_id, '__IDK__');
      else
        select choice->>'id'
        into v_wrong_choice_id
        from jsonb_array_elements(v_question->'choices') choice
        where choice->>'id' <> v_question_key.correct_choice_id
        order by choice->>'id'
        limit 1;

        v_response := coalesce(v_wrong_choice_id, '__IDK__');
      end if;

      if v_question_key.question_type = 'ot_book_section_sort_v1' then
        select to_jsonb(submit_row)
        into v_submit
        from public.obs_submit_section_sort_answers(
          (v_start->>'attempt_id')::uuid,
          v_question_key.generated_question_id,
          coalesce(v_section_sort_assignments, '[]'::jsonb)
        ) submit_row;
      elsif v_run.testament = 'OT' then
        if public.obs_is_order_response_question(
          v_question_key.question_type,
          v_question_key.payload
        ) then
          v_displayed_choice_text := public.obs_sequence_choice_text(
            v_question->'choices',
            public.obs_parse_sequence_order(v_response)
          );
        else
          select choice->>'text'
          into v_displayed_choice_text
          from jsonb_array_elements(v_question->'choices') choice
          where choice->>'id' = v_response
          limit 1;
        end if;

        select to_jsonb(submit_row)
        into v_submit
        from public.obs_submit_ot_assessment_response_v2(
          (v_start->>'attempt_id')::uuid,
          v_question_key.generated_question_id,
          v_response,
          case when v_response = '__IDK__' then null else v_displayed_choice_text end,
          v_question->'choices'
        ) submit_row;
      else
        select to_jsonb(submit_row)
        into v_submit
        from public.obs_submit_nt_assessment_answer(
          (v_start->>'attempt_id')::uuid,
          v_question_key.generated_question_id,
          v_response
        ) submit_row;
      end if;

      if v_item = 1 then
        insert into obs_launch_first_questions (
          profile_key,
          testament,
          run_number,
          generated_question_id,
          book_code,
          scope_key,
          prompt
        ) values (
          v_run.profile_key,
          v_run.testament,
          v_run.run_number,
          v_question_key.generated_question_id,
          v_question_key.book_code,
          v_scope,
          v_question_key.prompt
        );
      end if;

      insert into obs_launch_items (
        run_id,
        profile_key,
        testament,
        run_number,
        item_number,
        generated_question_id,
        book_code,
        scope_key,
        dimension_key,
        question_type,
        similarity_key,
        answer_mode,
        is_correct,
        is_idk,
        answered_count,
        target_question_count,
        prompt
      ) values (
        v_run.run_id,
        v_run.profile_key,
        v_run.testament,
        v_run.run_number,
        v_item,
        v_question_key.generated_question_id,
        v_question_key.book_code,
        v_scope,
        v_question_key.dimension_key,
        v_question_key.question_type,
        v_question_key.similarity_key,
        case
          when v_should_idk then 'idk'
          when v_should_correct then 'correct'
          else 'miss'
        end,
        coalesce((v_submit->>'is_correct')::boolean, false),
        coalesce((v_submit->>'is_idk')::boolean, false),
        (v_submit->>'answered_count')::integer,
        (v_submit->>'target_question_count')::integer,
        v_question_key.prompt
      );

      exit when coalesce((v_submit->>'target_reached')::boolean, false);
    end loop;

    select to_jsonb(score_row)
    into v_score
    from public.obs_get_bli_scores_v2(v_run.user_id) score_row;

    insert into obs_launch_scores (
      run_id,
      profile_key,
      testament,
      run_number,
      ot_display_bli,
      ot_questions_answered,
      ot_accuracy_pct,
      ot_section_scores,
      nt_display_bli,
      nt_questions_answered,
      nt_accuracy_pct,
      nt_section_scores,
      combined_available
    ) values (
      v_run.run_id,
      v_run.profile_key,
      v_run.testament,
      v_run.run_number,
      (v_score->>'ot_display_bli')::integer,
      (v_score->>'ot_questions_answered')::integer,
      (v_score->>'ot_accuracy_pct')::numeric,
      v_score->'ot_section_scores',
      (v_score->>'nt_display_bli')::integer,
      (v_score->>'nt_questions_answered')::integer,
      (v_score->>'nt_accuracy_pct')::numeric,
      v_score->'nt_section_scores',
      (v_score->>'combined_available')::boolean
    );
  end loop;
end
$simulation$;

reset role;

-- High-level launch gate summary.
create temporary table obs_launch_gate_results on commit drop as
with run_metrics as (
  select
    run.run_id,
    run.profile_key,
    run.testament,
    run.run_number,
    count(item.*)::integer as served,
    count(distinct item.generated_question_id)::integer as distinct_questions,
    count(distinct item.scope_key)::integer as scopes_seen,
    count(*) filter (where duplicate_group.n > 1)::integer as duplicate_similarity_items,
    count(*) filter (
      where item.scope_key = any(profile.weak_scopes)
        or item.dimension_key = any(profile.weak_dimensions)
    )::integer as weak_probe_count,
    count(*) filter (
      where item.scope_key = any(profile.strong_scopes)
        or item.dimension_key = any(profile.strong_dimensions)
    )::integer as strong_probe_count,
    round(avg(case when item.is_correct then 1 else 0 end) * 100, 1) as observed_accuracy_pct,
    round(avg(case when item.is_idk then 1 else 0 end) * 100, 1) as observed_idk_pct
  from obs_launch_runs run
  join obs_launch_profiles profile
    on profile.profile_key = run.profile_key
  left join obs_launch_items item
    on item.run_id = run.run_id
  left join lateral (
    select count(*) as n
    from obs_launch_items sibling
    where sibling.run_id = item.run_id
      and sibling.similarity_key is not null
      and sibling.similarity_key = item.similarity_key
  ) duplicate_group on true
  group by run.run_id, run.profile_key, run.testament, run.run_number
)
select
  profile_key,
  testament,
  run_number,
  served,
  distinct_questions,
  scopes_seen,
  duplicate_similarity_items,
  weak_probe_count,
  strong_probe_count,
  observed_accuracy_pct,
  observed_idk_pct,
  case
    when served < 10 then 'FAIL: too few questions served'
    when distinct_questions <> served then 'FAIL: exact question repeated'
    when duplicate_similarity_items > 0 then 'WARN: similar duplicate cluster repeated'
    when testament = 'OT' and scopes_seen < 3 then 'WARN: OT coverage too narrow'
    when testament = 'NT' and scopes_seen < 3 then 'WARN: NT coverage too narrow'
    when array_length((select weak_scopes from obs_launch_profiles p where p.profile_key = run_metrics.profile_key), 1) > 0
      and weak_probe_count < 2 then 'WARN: weak area under-probed'
    else 'PASS'
  end as launch_gate
from run_metrics
order by testament, profile_key, run_number;

select *
from obs_launch_gate_results
order by testament, profile_key, run_number;

-- First-question variation check.
select
  testament,
  count(*)::integer as simulated_fresh_attempts,
  count(distinct generated_question_id)::integer as distinct_first_questions,
  count(distinct scope_key)::integer as first_question_scopes,
  string_agg(distinct scope_key, ', ' order by scope_key) as scope_list
from obs_launch_first_questions
group by testament
order by testament;

-- Final score sanity by profile.
select
  profile_key,
  testament,
  run_number,
  ot_questions_answered,
  ot_display_bli,
  ot_accuracy_pct,
  nt_questions_answered,
  nt_display_bli,
  nt_accuracy_pct,
  combined_available
from obs_launch_scores
order by testament, profile_key, run_number;

-- Compact per-scope distribution.
select
  profile_key,
  testament,
  run_number,
  scope_key,
  count(*)::integer as served,
  count(*) filter (where is_correct)::integer as correct,
  count(*) filter (where is_idk)::integer as idk
from obs_launch_items
group by profile_key, testament, run_number, scope_key
order by testament, profile_key, run_number, served desc, scope_key;

do $assertions$
declare
  v_bad_gate text;
  v_bad_first text;
begin
  select string_agg(
    profile_key || ':' || launch_gate,
    '; ' order by testament, profile_key, run_number
  )
  into v_bad_gate
  from obs_launch_gate_results
  where launch_gate <> 'PASS';

  if v_bad_gate is not null then
    raise exception 'Launch routing gate failed: %', v_bad_gate;
  end if;

  with first_question_metrics as (
    select
      testament,
      count(*)::integer as simulated_fresh_attempts,
      count(distinct generated_question_id)::integer as distinct_first_questions,
      count(distinct scope_key)::integer as first_question_scopes
    from obs_launch_first_questions
    group by testament
  )
  select string_agg(
    testament || ': ' ||
      distinct_first_questions::text || '/' ||
      simulated_fresh_attempts::text || ' distinct first questions',
    '; ' order by testament
  )
  into v_bad_first
  from first_question_metrics
  where simulated_fresh_attempts >= 4
    and distinct_first_questions < 3;

  if v_bad_first is not null then
    raise exception 'Launch first-question variation gate failed: %', v_bad_first;
  end if;
end
$assertions$;

rollback;
