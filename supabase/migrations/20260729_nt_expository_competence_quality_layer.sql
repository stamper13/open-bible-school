-- Make the NT pilot measure text-grounded expository competence.
--
-- Policy:
--   approved    = routes first and carries full IRT evidence
--   provisional = routes only after approved material and carries 0.55 weight
--   rewrite     = not routed and contributes no IRT evidence
--
-- The first review covers the 139 live NT questions. Future questions must
-- receive a review row before the NT router can select them.

begin;

do $$
declare
  live_nt_questions integer;
begin
  if to_regclass('public.v_nt_question_bank') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.user_abilities') is null
     or to_regprocedure(
       'public.obs_start_nt_assessment(text,text,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_nt_assessment_question(uuid)'
     ) is null
     or to_regprocedure(
       'public.update_theta_internal(uuid,text,uuid,boolean)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT expository-quality prerequisites are missing.';
  end if;

  select count(*)
  into live_nt_questions
  from public.v_nt_question_bank;

  if live_nt_questions <> 139 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected the reviewed 139-question NT bank, found %s; classification requires regeneration.',
        live_nt_questions
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
  '20260729_nt_expository_competence_quality_layer',
  'public',
  procedure.proname,
  'function',
  pg_get_functiondef(procedure.oid)
from pg_proc procedure
join pg_namespace namespace
  on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.oid in (
    'public.obs_start_nt_assessment(text,text,integer)'::regprocedure,
    'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure,
    'public.update_theta_internal(uuid,text,uuid,boolean)'::regprocedure
  )
  and not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag =
            '20260729_nt_expository_competence_quality_layer'
      and backup.object_schema = 'public'
      and backup.object_name = procedure.proname
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
  '20260729_nt_expository_competence_quality_layer',
  'public',
  'user_abilities',
  'data',
  coalesce(
    jsonb_agg(to_jsonb(ability) order by ability.user_id, ability.scope),
    '[]'::jsonb
  )::text
from public.user_abilities ability
where ability.scope in (
  'NT', 'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_nt_expository_competence_quality_layer'
    and backup.object_schema = 'public'
    and backup.object_name = 'user_abilities'
    and backup.object_type = 'data'
);

do $$
declare
  function_backups integer;
  ability_backups integer;
begin
  select
    count(*) filter (where object_type = 'function'),
    count(*) filter (
      where object_type = 'data'
        and object_name = 'user_abilities'
    )
  into function_backups, ability_backups
  from public.obs_schema_backups
  where backup_tag =
          '20260729_nt_expository_competence_quality_layer'
    and object_schema = 'public';

  if function_backups <> 3 or ability_backups <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT quality backup failed: functions=%s/3 ability_data=%s/1.',
        function_backups,
        ability_backups
      );
  end if;
end
$$;

create table if not exists public.obs_nt_expository_item_reviews (
  generated_question_id uuid primary key
    references public.ot_generated_questions(id) on delete cascade,
  review_status text not null check (
    review_status in ('approved', 'provisional', 'rewrite', 'excluded')
  ),
  expository_target text not null check (
    expository_target in (
      'narrative_detail',
      'narrative_sequence',
      'book_structure',
      'local_context',
      'argument_flow',
      'authorial_claim',
      'intertextual_use'
    )
  ),
  text_dependence smallint not null check (text_dependence between 1 and 3),
  orthodoxy_guessability smallint not null check (
    orthodoxy_guessability between 1 and 3
  ),
  book_discrimination smallint not null check (
    book_discrimination between 1 and 3
  ),
  confessional_sensitivity text not null check (
    confessional_sensitivity in ('low', 'moderate', 'high')
  ),
  routing_priority smallint not null check (routing_priority between 0 and 3),
  scoring_weight double precision not null check (
    scoring_weight between 0.0 and 1.0
  ),
  review_basis text not null,
  review_notes text not null,
  reviewed_by text not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obs_nt_expository_review_policy_ck check (
    (
      review_status = 'approved'
      and routing_priority = 3
      and scoring_weight = 1.0
    )
    or (
      review_status = 'provisional'
      and routing_priority = 1
      and scoring_weight = 0.55
    )
    or (
      review_status in ('rewrite', 'excluded')
      and routing_priority = 0
      and scoring_weight = 0.0
    )
  )
);

alter table public.obs_nt_expository_item_reviews
  enable row level security;

revoke all on table public.obs_nt_expository_item_reviews
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.obs_nt_expository_item_reviews
  to service_role;

with reviewed as (
  select
    question.generated_question_id,
    coalesce(
      question.payload->>'dimension_key',
      question.payload->>'dimension',
      ''
    ) as dimension_key,
    coalesce(question.payload->>'prompt', question.prompt, '') as prompt,
    question.question_type,
    case
      when question.generated_question_id in (
        '302f9726-9faf-4218-a317-d9aaa1b95bf6'::uuid,
        'fb5605ab-043e-4fff-8712-79738a493056'::uuid,
        'b9193244-913e-48d7-bc85-90ded4d86e23'::uuid,
        'cc1152a0-5d1f-434c-80b3-68c3141553a6'::uuid,
        '610e11fb-c147-47f7-93fc-dff7069d7e88'::uuid,
        '77925cb6-3419-4abe-9b89-904df8c546b1'::uuid,
        '064a5034-9edf-4007-a452-3fcc264aa567'::uuid,
        'ed5c4697-ef57-46d9-a542-5baa5d06f243'::uuid,
        'fa36cffb-5c56-40a6-9206-18cdbf2d9d9e'::uuid,
        '75850444-2558-4ee7-a598-37eab64c9ffa'::uuid,
        'c120ab4e-6c48-4b57-958d-9152bbbd357a'::uuid,
        '9b9e2c5f-2adf-4c89-bc24-0e738ceba0f4'::uuid
      ) then 'rewrite'
      when coalesce(
        question.payload->>'dimension_key',
        question.payload->>'dimension',
        ''
      ) in (
        'structure_cross_ref',
        'events_timeline',
        'geography_nations',
        'characters_lineage'
      ) then 'approved'
      when question.generated_question_id in (
        '4b5b40c5-c5f8-4011-a59a-716a7524d909'::uuid,
        'b757e745-b25f-4d52-a64d-01c64e599c5d'::uuid,
        '51854e14-9905-4c3c-9640-28604fff748a'::uuid,
        '8d21bd15-c328-4892-8eb6-bbceb17ff42b'::uuid,
        'd2f01936-48c2-4ca2-8110-daee3192bcb4'::uuid,
        '2d91ad85-a6ed-4266-8a4f-ed4b035dac00'::uuid,
        '54349b43-f0d2-49e6-8d7c-31707431cf11'::uuid,
        '445c1515-b1ee-49ed-a8fd-937e3dbe4d5e'::uuid,
        'e4f2efb4-98f6-4245-9d31-fd2ab7c91e7f'::uuid,
        'ed5363eb-e95f-4a2f-a591-b77dd8942b27'::uuid,
        '8f42b1d1-5655-42e5-83bf-225b11871e9d'::uuid,
        '267a35c4-fc29-44fc-9b8a-22fdd7a4ff88'::uuid,
        '83ff8cbd-c4c7-4fe9-aba4-b0835e6710c5'::uuid,
        'cf59acf5-c713-45cf-83e3-ca1cd61645dd'::uuid,
        '4189776d-9f31-4515-816e-5cb6544c7896'::uuid,
        '7592fbb8-3af1-4a74-abf4-5b3ac4553fe2'::uuid,
        '6cd55d33-1370-4190-952d-43375930ef50'::uuid,
        '8efd145f-61bd-43a4-9dee-fb1a14644269'::uuid,
        'ab28afaa-3d1a-4f65-aa34-81914b972159'::uuid,
        'ccb907bd-3784-484f-8886-b81194e49c79'::uuid
      ) then 'approved'
      when question.question_type = 'nt_gospel_pilot_mcq_v1'
        and coalesce(question.payload->>'prompt', question.prompt, '') ~* (
          'first sign|material opens|immediately after|major narrative '
          || 'movement|Mary do after|women discover|narrative begin'
        )
        then 'approved'
      else 'provisional'
    end as review_status
  from public.v_nt_question_bank question
), classified as (
  select
    reviewed.*,
    case
      when dimension_key = 'events_timeline'
        then 'narrative_sequence'
      when dimension_key in ('geography_nations', 'characters_lineage')
        then 'narrative_detail'
      when dimension_key = 'structure_cross_ref'
        then 'book_structure'
      when dimension_key = 'law_commands'
        then 'local_context'
      when prompt ~* (
        'why|what follows|so that|because|explain|what pattern|'
        || 'what accomplished|what does .* do with'
      )
        then 'argument_flow'
      else 'authorial_claim'
    end as expository_target
  from reviewed
)
insert into public.obs_nt_expository_item_reviews (
  generated_question_id,
  review_status,
  expository_target,
  text_dependence,
  orthodoxy_guessability,
  book_discrimination,
  confessional_sensitivity,
  routing_priority,
  scoring_weight,
  review_basis,
  review_notes,
  reviewed_by,
  reviewed_at,
  updated_at
)
select
  generated_question_id,
  review_status,
  expository_target,
  case review_status
    when 'approved' then 3
    when 'provisional' then 2
    else 1
  end,
  case review_status
    when 'approved' then 1
    when 'provisional' then 2
    else 3
  end,
  case review_status
    when 'approved' then 3
    when 'provisional' then 2
    else 1
  end,
  case
    when dimension_key in (
      'theological_reasoning',
      'law_commands',
      'promise_prophecy'
    ) then 'moderate'
    else 'low'
  end,
  case review_status
    when 'approved' then 3
    when 'provisional' then 1
    else 0
  end,
  case review_status
    when 'approved' then 1.0
    when 'provisional' then 0.55
    else 0.0
  end,
  'initial_139_item_expository_audit_v1',
  case review_status
    when 'approved' then
      'Requires textual detail, book structure, narrative sequence, or the author''s stated line of reasoning.'
    when 'provisional' then
      'Text-based, but current wording or distractors may allow an answer from general Christian familiarity; route after approved items and reduce evidence weight.'
    else
      'Too answerable from general orthodox familiarity; rewrite with a context-dependent stem and plausible orthodox distractors before reactivation.'
  end,
  '20260729_nt_expository_quality_layer',
  now(),
  now()
from classified
on conflict (generated_question_id) do update
set
  review_status = excluded.review_status,
  expository_target = excluded.expository_target,
  text_dependence = excluded.text_dependence,
  orthodoxy_guessability = excluded.orthodoxy_guessability,
  book_discrimination = excluded.book_discrimination,
  confessional_sensitivity = excluded.confessional_sensitivity,
  routing_priority = excluded.routing_priority,
  scoring_weight = excluded.scoring_weight,
  review_basis = excluded.review_basis,
  review_notes = excluded.review_notes,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_at = excluded.updated_at;

create or replace view public.obs_nt_expository_review_queue
with (security_invoker = true)
as
select
  question.generated_question_id,
  question.book_code,
  question.question_type,
  coalesce(question.payload->>'prompt', question.prompt) as prompt,
  question.payload->'choices' as choices,
  question.payload->>'correct_choice_id' as correct_choice_id,
  review.review_status,
  review.expository_target,
  review.text_dependence,
  review.orthodoxy_guessability,
  review.book_discrimination,
  review.confessional_sensitivity,
  review.routing_priority,
  review.scoring_weight,
  review.review_notes,
  review.reviewed_at
from public.v_nt_question_bank question
join public.obs_nt_expository_item_reviews review
  on review.generated_question_id = question.generated_question_id
where review.review_status <> 'approved'
order by
  case review.review_status
    when 'rewrite' then 1
    when 'excluded' then 2
    else 3
  end,
  review.orthodoxy_guessability desc,
  question.book_code,
  question.generated_question_id;

revoke all on table public.obs_nt_expository_review_queue
  from public, anon, authenticated;
grant select on table public.obs_nt_expository_review_queue
  to service_role;

create or replace function public.obs_start_nt_assessment(
  p_section text default null,
  p_book_code text default null,
  p_target_question_count integer default 20
)
returns table (
  attempt_id uuid,
  user_id uuid,
  testament text,
  scope_key text,
  target_question_count integer,
  available_question_count integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_scope_key text;
  v_target integer;
  v_available integer;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'An authenticated or anonymous Supabase session is required';
  end if;

  v_scope_key := public.obs_nt_scope_key(p_section, p_book_code);
  v_target := greatest(
    5,
    least(coalesce(p_target_question_count, 20), 50)
  );

  if p_book_code is not null and not exists (
    select 1
    from public.scripture_books book
    where book.book_code = upper(p_book_code)
      and public.obs_book_testament(book.book_code) = 'NT'
  ) then
    raise exception using
      errcode = '22023',
      message = format(
        'Unknown New Testament book code: %s',
        p_book_code
      );
  end if;

  select count(distinct coalesce(
    nullif(question.payload->>'stem_family', ''),
    question.generated_question_id::text
  ))::integer
  into v_available
  from public.v_nt_question_bank question
  join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
   and review.review_status in ('approved', 'provisional')
   and review.scoring_weight > 0.0
  left join public.scripture_books book
    on book.book_code = question.book_code
  where question.generated_question_id is not null
    and question.payload ? 'choices'
    and jsonb_typeof(question.payload->'choices') = 'array'
    and jsonb_array_length(question.payload->'choices') >= 2
    and public.obs_nt_question_matches_scope(
      question.book_code,
      book.nt_division,
      v_scope_key
    );

  if v_available = 0 then
    raise exception using
      errcode = 'P0002',
      message =
        'No expository-approved questions are available for this New Testament scope';
  end if;

  v_target := least(v_target, v_available);

  insert into public.assessment_attempts (
    user_id,
    prior_self_rating,
    testament,
    scope_key,
    assessment_kind,
    target_question_count
  ) values (
    v_user_id,
    3,
    'NT',
    v_scope_key,
    'nt_adaptive',
    v_target
  )
  returning id into v_attempt_id;

  return query
  select
    v_attempt_id,
    v_user_id,
    'NT'::text,
    v_scope_key,
    v_target,
    v_available;
end;
$function$;

create or replace function public.obs_get_next_nt_assessment_question(
  p_attempt_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  book_code text,
  book_name text,
  nt_division text,
  answered_count integer,
  target_question_count integer
)
language sql
security definer
set search_path = public
as $function$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.scope_key, 'NT')) as scope_key,
      greatest(
        1,
        coalesce(attempt.target_question_count, 20)
      ) as target_count
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = auth.uid()
      and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  ),
  attempt_answers as (
    select
      answer.generated_question_id,
      nullif(question.payload->>'stem_family', '') as stem_family
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    join authorized_attempt attempt
      on attempt.id = answer.attempt_id
  ),
  progress as (
    select count(*)::integer as answered
    from attempt_answers
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    where answer.user_id = auth.uid()
    group by answer.generated_question_id
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(
        question.payload->>'prompt',
        question.prompt
      ) as prompt,
      question.question_type,
      question.payload,
      question.book_code,
      book.name as book_name,
      book.nt_division,
      nullif(question.payload->>'stem_family', '') as stem_family,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      review.routing_priority,
      review.scoring_weight,
      public.obs_effective_item_irt_a(
        question.payload,
        null
      ) as effective_a,
      public.obs_effective_item_irt_b(
        question.payload,
        null
      ) as effective_b,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        nt_ability.theta - 0.5 * coalesce(nt_ability.theta_se, 1.0),
        0.0
      ) as theta_lcb,
      greatest(
        0.0,
        least(
          1.0,
          coalesce(
            public.obs_payload_number(
              question.payload,
              'importance_conceptual'
            ) / 100.0,
            0.60
          )
        )
      ) as importance_score,
      attempt.target_count
    from authorized_attempt attempt
    join public.v_nt_question_bank question
      on true
    join public.obs_nt_expository_item_reviews review
      on review.generated_question_id = question.generated_question_id
     and review.review_status in ('approved', 'provisional')
     and review.scoring_weight > 0.0
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.user_abilities ability
      on ability.user_id = attempt.user_id
     and ability.scope = case
       when attempt.scope_key in (
         'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
       ) then attempt.scope_key
       else public.obs_nt_scope_key(book.nt_division, null)
     end
    left join public.user_abilities nt_ability
      on nt_ability.user_id = attempt.user_id
     and nt_ability.scope = 'NT'
    left join user_history history
      on history.generated_question_id =
        question.generated_question_id
    cross join progress
    where progress.answered < attempt.target_count
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
      and public.obs_nt_question_matches_scope(
        question.book_code,
        book.nt_division,
        attempt.scope_key
      )
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id =
          question.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(
            question.payload->>'stem_family',
            ''
          )
      )
  ),
  ranked as (
    select
      candidate.*,
      (
        0.55 * public.obs_item_information(
          candidate.theta_lcb,
          candidate.effective_a,
          candidate.effective_b
        )
        + 0.25 * candidate.importance_score
        + 0.15 * (
          1.0 / (1.0 + candidate.times_answered)
        )
        + 0.05 * random()
      ) as adaptive_score
    from candidates candidate
  )
  select
    ranked.generated_question_id,
    ranked.prompt,
    ranked.question_type,
    ranked.payload->'choices',
    ranked.book_code,
    ranked.book_name,
    ranked.nt_division,
    progress.answered,
    ranked.target_count
  from ranked
  cross join progress
  order by
    ranked.routing_priority desc,
    ranked.adaptive_score desc,
    ranked.times_answered asc,
    ranked.last_answered_at asc nulls first,
    ranked.generated_question_id
  limit 1;
$function$;

create or replace function public.update_theta_internal(
  p_user_id uuid,
  p_scope text,
  p_event_id uuid,
  p_is_correct boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  idk_weight constant double precision := 0.25;
  v_scope text := upper(btrim(p_scope));
  v_books text[];
  v_theta double precision;
  v_se double precision;
  v_n integer;
begin
  v_books := public.obs_book_codes_for_scope(v_scope);
  if v_books is null then
    raise exception using
      errcode = '22023',
      message = format(
        'Unsupported BLI ability scope: %s',
        coalesce(p_scope, '<null>')
      );
  end if;

  with hist as (
    select
      public.obs_effective_item_irt_a(
        qb.payload,
        be.irt_a::double precision
      ) as a,
      public.obs_effective_item_irt_b(
        qb.payload,
        be.irt_b::double precision
      ) as b,
      case
        when coalesce(aa.is_idk, false) then 0
        else aa.is_correct::integer
      end as r,
      (
        case
          when coalesce(aa.is_idk, false) then idk_weight
          else 1.0::double precision
        end
      ) * (
        case
          when public.obs_book_testament(
            upper(coalesce(be.book_code, qb.book_code))
          ) = 'NT'
            then coalesce(review.scoring_weight, 0.0)
          else 1.0
        end
      ) as wt
    from public.assessment_answers aa
    join public.ot_generated_questions oq
      on oq.id = aa.generated_question_id
    left join public.bible_events be
      on be.id = oq.event_id
    left join public.v_question_bank qb
      on qb.generated_question_id = oq.id
    left join public.obs_nt_expository_item_reviews review
      on review.generated_question_id = oq.id
    where aa.user_id = p_user_id
      and aa.scoring_eligible
      and aa.answered_at is not null
      and oq.question_type not like 'quarantined%'
      and upper(coalesce(be.book_code, qb.book_code)) = any(v_books)
  ),
  grid as (
    select
      generate_series(-40, 40)::double precision * 0.1 as th
  ),
  likelihood as (
    select
      grid.th,
      -0.5 * grid.th * grid.th
        + coalesce(
          sum(
            history.wt * (
              history.r * ln(history.pp)
              + (1 - history.r) * ln(1 - history.pp)
            )
          ),
          0
        ) as logpost
    from grid
    left join lateral (
      select
        item.r,
        item.wt,
        least(
          1 - 1e-9,
          greatest(
            1e-9,
            1.0 / (
              1.0 + exp(-item.a * (grid.th - item.b))
            )
          )
        ) as pp
      from hist item
    ) history on true
    group by grid.th
  ),
  weights as (
    select
      th,
      exp(logpost - max(logpost) over ()) as wt
    from likelihood
  ),
  posterior as (
    select
      th,
      wt / sum(wt) over () as pr
    from weights
  ),
  mean_theta as (
    select sum(th * pr) as m
    from posterior
  )
  select
    mean_theta.m,
    sqrt(
      sum(
        power(posterior.th - mean_theta.m, 2)
          * posterior.pr
      )
    )
  into v_theta, v_se
  from posterior
  cross join mean_theta
  group by mean_theta.m;

  select count(*)
  into v_n
  from public.assessment_answers aa
  join public.ot_generated_questions oq
    on oq.id = aa.generated_question_id
  left join public.bible_events be
    on be.id = oq.event_id
  left join public.v_question_bank qb
    on qb.generated_question_id = oq.id
  left join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = oq.id
  where aa.user_id = p_user_id
    and aa.scoring_eligible
    and aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
    and upper(coalesce(be.book_code, qb.book_code)) = any(v_books)
    and (
      public.obs_book_testament(
        upper(coalesce(be.book_code, qb.book_code))
      ) <> 'NT'
      or coalesce(review.scoring_weight, 0.0) > 0.0
    );

  insert into public.user_abilities (
    user_id,
    scope,
    theta,
    theta_se,
    n_responses,
    updated_at
  ) values (
    p_user_id,
    v_scope,
    coalesce(v_theta, 0.0),
    coalesce(v_se, 1.0),
    coalesce(v_n, 0),
    now()
  )
  on conflict (user_id, scope) do update
  set
    theta = excluded.theta,
    theta_se = excluded.theta_se,
    n_responses = excluded.n_responses,
    updated_at = now();
end;
$function$;

do $$
declare
  ability record;
begin
  for ability in
    select user_id, scope
    from public.user_abilities
    where scope in (
      'NT', 'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
    )
    order by user_id, scope
  loop
    perform public.update_theta_internal(
      ability.user_id,
      ability.scope,
      null,
      false
    );
  end loop;
end
$$;

do $$
declare
  reviewed_count integer;
  approved_count integer;
  provisional_count integer;
  rewrite_count integer;
  covered_books integer;
  approved_books integer;
  unreviewed_count integer;
begin
  select
    count(*),
    count(*) filter (where review_status = 'approved'),
    count(*) filter (where review_status = 'provisional'),
    count(*) filter (where review_status = 'rewrite'),
    count(distinct question.book_code),
    count(distinct question.book_code) filter (
      where review.review_status = 'approved'
    )
  into
    reviewed_count,
    approved_count,
    provisional_count,
    rewrite_count,
    covered_books,
    approved_books
  from public.obs_nt_expository_item_reviews review
  join public.v_nt_question_bank question
    on question.generated_question_id = review.generated_question_id;

  select count(*)
  into unreviewed_count
  from public.v_nt_question_bank question
  left join public.obs_nt_expository_item_reviews review
    on review.generated_question_id = question.generated_question_id
  where review.generated_question_id is null;

  if reviewed_count <> 139
     or approved_count <> 68
     or provisional_count <> 59
     or rewrite_count <> 12
     or covered_books <> 27
     or approved_books <> 27
     or unreviewed_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT expository classification failed: reviewed=%s approved=%s provisional=%s rewrite=%s books=%s approved_books=%s unreviewed=%s.',
        reviewed_count,
        approved_count,
        provisional_count,
        rewrite_count,
        covered_books,
        approved_books,
        unreviewed_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
