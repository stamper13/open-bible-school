-- Fix event-less and New Testament answers being silently omitted from BLI/theta.
--
-- Compatibility policy:
--   * Keep bible_events calibration and event-significance weights authoritative
--     for event-linked questions.
--   * For event-less questions, resolve book and calibration from v_question_bank.
--   * Default missing calibration to a=1, b=0 and missing significance to tier 2,
--     matching the old function's existing COALESCE behavior.
--   * Reject unknown ability scopes instead of widening them to all answers.

begin;

create table if not exists public.obs_schema_backups (
  id uuid primary key default gen_random_uuid(),
  backup_tag text not null,
  object_schema text not null,
  object_name text not null,
  object_type text not null,
  definition text not null,
  created_at timestamptz not null default now()
);

do $$
declare
  function_name text;
  function_args text;
  old_definition text;
begin
  for function_name, function_args in
    values
      ('compute_bli', 'uuid'),
      ('update_theta_internal', 'uuid,text,uuid,boolean')
  loop
    if not exists (
      select 1
      from public.obs_schema_backups b
      where b.backup_tag = '20260711_fix_bli_eventless_nt_scoring'
        and b.object_schema = 'public'
        and b.object_name = function_name
        and b.object_type = 'function'
    ) then
      select pg_get_functiondef(to_regprocedure('public.' || function_name || '(' || function_args || ')'))
      into old_definition;

      if old_definition is null then
        raise exception 'Required function public.%(%) does not exist', function_name, function_args;
      end if;

      insert into public.obs_schema_backups (
        backup_tag, object_schema, object_name, object_type, definition
      ) values (
        '20260711_fix_bli_eventless_nt_scoring',
        'public',
        function_name,
        'function',
        old_definition
      );
    end if;
  end loop;
end $$;

create or replace function public.compute_bli(p_user_id uuid)
returns table(
  bli_score numeric,
  bli_level text,
  total_weighted_possible numeric,
  total_weighted_earned numeric,
  questions_answered integer,
  section_scores jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  k_reward       constant numeric := 0.20;
  reward_cap     constant numeric := 1.25;
  reward_floor   constant numeric := 0.70;
  guess_allowance constant numeric := 0.25;
  tf1            constant numeric := 1.0;
  tf2            constant numeric := 0.6;
  tf3            constant numeric := 0.35;
  v_bli numeric;
  v_level text;
  v_total_possible numeric := 0;
  v_total_earned numeric := 0;
  v_questions_answered integer := 0;
  v_section_scores jsonb;
begin
  with answer_rows as (
    select
      aa.is_correct,
      coalesce(aa.is_idk, false) as is_idk,
      upper(coalesce(be.book_code, qb.book_code)) as bk,
      bw.chronological_weight
        * case
            when coalesce(es.importance_tier, 2) = 1 then tf1
            when coalesce(es.importance_tier, 2) = 2 then tf2
            else tf3
          end as w,
      coalesce(
        be.irt_b,
        case
          when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (qb.payload->>'irt_b')::numeric
        end,
        0.0
      ) as b
    from public.assessment_answers aa
    join public.ot_generated_questions oq
      on oq.id = aa.generated_question_id
    left join public.bible_events be
      on be.id = oq.event_id
    left join public.v_question_bank qb
      on qb.generated_question_id = oq.id
    join public.book_bli_weights bw
      on upper(bw.book_code) = upper(coalesce(be.book_code, qb.book_code))
    left join public.event_significance es
      on es.event_id = oq.event_id
    where aa.user_id = p_user_id
      and oq.question_type not like 'quarantined%'
      and coalesce(be.book_code, qb.book_code) is not null
  ), totals as (
    select
      count(*)::integer as n,
      coalesce(sum(
        case
          when is_idk then 0
          when is_correct then
            w * least(reward_cap, greatest(reward_floor, 1.0 + k_reward * b))
          else
            -1 * w * (guess_allowance / (1.0 - guess_allowance))
        end
      ), 0) as earned,
      coalesce(sum(w), 0) as possible
    from answer_rows
  )
  select n, earned, possible
  into v_questions_answered, v_total_earned, v_total_possible
  from totals;

  if v_total_possible > 0 then
    v_bli := round((v_total_earned / v_total_possible) * 100, 1);
  else
    v_bli := 0;
  end if;
  v_bli := greatest(0, least(100, v_bli));

  v_level := case
    when v_bli >= 85 then 'Studied'
    when v_bli >= 65 then 'Literate'
    when v_bli >= 40 then 'Familiar'
    else 'Acquainted'
  end;

  with answer_rows as (
    select
      aa.is_correct,
      coalesce(aa.is_idk, false) as is_idk,
      upper(coalesce(be.book_code, qb.book_code)) as bk,
      bw.chronological_weight
        * case
            when coalesce(es.importance_tier, 2) = 1 then tf1
            when coalesce(es.importance_tier, 2) = 2 then tf2
            else tf3
          end as w
    from public.assessment_answers aa
    join public.ot_generated_questions oq
      on oq.id = aa.generated_question_id
    left join public.bible_events be
      on be.id = oq.event_id
    left join public.v_question_bank qb
      on qb.generated_question_id = oq.id
    join public.book_bli_weights bw
      on upper(bw.book_code) = upper(coalesce(be.book_code, qb.book_code))
    left join public.event_significance es
      on es.event_id = oq.event_id
    where aa.user_id = p_user_id
      and oq.question_type not like 'quarantined%'
      and coalesce(be.book_code, qb.book_code) is not null
  ), section_rows as (
    select
      case
        when bk in ('GEN','EXO','LEV','NUM','DEU') then 'Torah'
        when bk in ('JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST') then 'Former Prophets'
        when bk in ('ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL') then 'Latter Prophets'
        when bk in ('JOB','PSA','PRO','ECC','SNG') then 'Writings'
        when bk in ('MAT','MRK','LUK','JHN','ACT') then 'Gospels & Acts'
        when bk in ('ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM') then 'Pauline Epistles'
        when bk in ('HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD') then 'General Epistles'
        when bk = 'REV' then 'Apocalypse'
        else 'Unmapped'
      end as section,
      is_correct,
      is_idk,
      w
    from answer_rows
  )
  select jsonb_object_agg(section, section_data)
  into v_section_scores
  from (
    select
      section,
      jsonb_build_object(
        'correct', count(*) filter (where is_correct)::integer,
        'idk', count(*) filter (where is_idk)::integer,
        'total', count(*)::integer,
        'pct', round(count(*) filter (where is_correct)::numeric / nullif(count(*), 0) * 100, 1),
        'weighted_pct', round(
          sum(case when is_correct then w else 0 end) / nullif(sum(w), 0) * 100,
          1
        )
      ) as section_data
    from section_rows
    group by section
  ) scored_sections;

  return query
  select
    v_bli,
    v_level,
    v_total_possible,
    v_total_earned,
    v_questions_answered,
    coalesce(v_section_scores, '{}'::jsonb);
end;
$$;

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
as $$
declare
  v_scope text := upper(btrim(p_scope));
  v_books text[];
  v_theta double precision;
  v_se double precision;
  v_n integer;
begin
  v_books := case v_scope
    when 'BIBLE' then array[
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST',
      'JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL',
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM',
      'HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'
    ]
    when 'OT' then array[
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST',
      'JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'
    ]
    when 'NT' then array[
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM',
      'HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'
    ]
    when 'TORAH' then array['GEN','EXO','LEV','NUM','DEU']
    when 'FORMER' then array['JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST']
    when 'LATTER' then array['ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL']
    when 'WRITINGS' then array['JOB','PSA','PRO','ECC','SNG']
    when 'GOSPELS_ACTS' then array['MAT','MRK','LUK','JHN','ACT']
    when 'PAULINE' then array['ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM']
    when 'GENERAL' then array['HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD']
    when 'APOCALYPSE' then array['REV']
    else null
  end;

  if v_books is null then
    raise exception using
      errcode = '22023',
      message = format('Unsupported BLI ability scope: %s', coalesce(p_scope, '<null>'));
  end if;

  with hist as (
    select
      coalesce(
        be.irt_a,
        case
          when (qb.payload->>'irt_a') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (qb.payload->>'irt_a')::double precision
        end,
        1.0
      ) as a,
      coalesce(
        be.irt_b,
        case
          when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (qb.payload->>'irt_b')::double precision
        end,
        0.0
      ) as b,
      aa.is_correct::integer as r
    from public.assessment_answers aa
    join public.ot_generated_questions oq
      on oq.id = aa.generated_question_id
    left join public.bible_events be
      on be.id = oq.event_id
    left join public.v_question_bank qb
      on qb.generated_question_id = oq.id
    where aa.user_id = p_user_id
      and aa.answered_at is not null
      and oq.question_type not like 'quarantined%'
      and upper(coalesce(be.book_code, qb.book_code)) = any(v_books)
  ), grid as (
    select generate_series(-40, 40)::double precision * 0.1 as th
  ), likelihood as (
    select
      gr.th,
      -0.5 * gr.th * gr.th
        + coalesce(sum(h.r * ln(h.pp) + (1 - h.r) * ln(1 - h.pp)), 0) as logpost
    from grid gr
    left join lateral (
      select
        hh.r,
        least(
          1 - 1e-9,
          greatest(1e-9, 1.0 / (1.0 + exp(-hh.a * (gr.th - hh.b))))
        ) as pp
      from hist hh
    ) h on true
    group by gr.th
  ), weights as (
    select th, exp(logpost - max(logpost) over ()) as wt
    from likelihood
  ), posterior as (
    select th, wt / sum(wt) over () as pr
    from weights
  ), mean_theta as (
    select sum(th * pr) as m
    from posterior
  )
  select m.m, sqrt(sum(power(p.th - m.m, 2) * p.pr))
  into v_theta, v_se
  from posterior p
  cross join mean_theta m
  group by m.m;

  select count(*)
  into v_n
  from public.assessment_answers aa
  join public.ot_generated_questions oq
    on oq.id = aa.generated_question_id
  left join public.bible_events be
    on be.id = oq.event_id
  left join public.v_question_bank qb
    on qb.generated_question_id = oq.id
  where aa.user_id = p_user_id
    and aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
    and upper(coalesce(be.book_code, qb.book_code)) = any(v_books);

  insert into public.user_abilities (
    user_id, scope, theta, theta_se, n_responses, updated_at
  ) values (
    p_user_id,
    v_scope,
    coalesce(v_theta, 0.0),
    coalesce(v_se, 1.0),
    coalesce(v_n, 0),
    now()
  )
  on conflict (user_id, scope) do update
  set theta = excluded.theta,
      theta_se = excluded.theta_se,
      n_responses = excluded.n_responses,
      updated_at = now();
end;
$$;

notify pgrst, 'reload schema';

commit;
