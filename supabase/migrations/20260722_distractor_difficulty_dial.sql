-- Distractor-distance difficulty dial.
--
-- Promotes distractor distance into live item calibration and routing:
--   d0: category-alien / obviously unrelated distractors
--   d1: true content from a distant book
--   d2: true content from a nearby book, section, or theme
--   d3: true content from the same book but wrong chapter or context
--
-- Payload contract:
--   "stem_family": "outline|ROM|3",
--   "distractor_distance": 3,
--   "irt_a": 1.0,       -- optional override
--   "irt_b": 1.95       -- optional fine-tuning override
--
-- Existing questions remain compatible. Item-first calibration activates only
-- when a valid d0-d3 tag is present. Untagged questions retain event-first
-- calibration, then fall back to payload metadata and finally to a=1, b=0.

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
  target record;
  old_definition text;
begin
  for target in
    select *
    from (
      values
        ('compute_bli', 'uuid'),
        ('update_theta_internal', 'uuid,text,uuid,boolean'),
        ('get_next_assessment_question', 'uuid,uuid'),
        ('obs_get_next_focused_question', 'uuid,uuid,text,text,integer,integer'),
        ('obs_simulate_router_v2', 'uuid,uuid,double precision,integer'),
        ('nt_get_pilot_questions', 'text,text,integer')
    ) as functions(function_name, function_args)
  loop
    if not exists (
      select 1
      from public.obs_schema_backups b
      where b.backup_tag = '20260722_distractor_difficulty_dial'
        and b.object_schema = 'public'
        and b.object_name = target.function_name
        and b.object_type = 'function'
    ) then
      select pg_get_functiondef(
        to_regprocedure(
          'public.' || target.function_name || '(' || target.function_args || ')'
        )
      )
      into old_definition;

      if old_definition is not null then
        insert into public.obs_schema_backups (
          backup_tag,
          object_schema,
          object_name,
          object_type,
          definition
        ) values (
          '20260722_distractor_difficulty_dial',
          'public',
          target.function_name,
          'function',
          old_definition
        );
      end if;
    end if;
  end loop;
end $$;

create table if not exists public.obs_distractor_distance_calibration (
  distance smallint primary key,
  distance_key text not null unique,
  label text not null,
  description text not null,
  default_irt_b double precision not null,
  min_irt_b double precision not null,
  max_irt_b double precision not null,
  constraint obs_distractor_distance_range_ck check (
    distance between 0 and 3
    and min_irt_b <= default_irt_b
    and default_irt_b <= max_irt_b
  )
);

insert into public.obs_distractor_distance_calibration (
  distance,
  distance_key,
  label,
  description,
  default_irt_b,
  min_irt_b,
  max_irt_b
)
values
  (
    0,
    'd0',
    'Category-alien',
    'Distractors are logically or categorically unrelated to the target content.',
    -0.65,
    -1.00,
    -0.30
  ),
  (
    1,
    'd1',
    'Distant-book',
    'Distractors are true biblical content drawn from a distant book or context.',
    0.30,
    0.00,
    0.60
  ),
  (
    2,
    'd2',
    'Near-book',
    'Distractors are true content from a nearby book, section, chronology, or theme.',
    1.20,
    0.90,
    1.50
  ),
  (
    3,
    'd3',
    'Same-book',
    'Distractors are true content from the same book but the wrong chapter or context.',
    1.95,
    1.70,
    2.20
  )
on conflict (distance) do update set
  distance_key = excluded.distance_key,
  label = excluded.label,
  description = excluded.description,
  default_irt_b = excluded.default_irt_b,
  min_irt_b = excluded.min_irt_b,
  max_irt_b = excluded.max_irt_b;

create or replace function public.obs_payload_number(
  p_payload jsonb,
  p_key text
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when p_payload is not null
      and p_key is not null
      and (p_payload->>p_key) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
      then (p_payload->>p_key)::double precision
    else null
  end;
$$;

create or replace function public.obs_normalize_distractor_distance(
  p_value text
)
returns smallint
language sql
immutable
parallel safe
as $$
  select case lower(btrim(coalesce(p_value, '')))
    when '0' then 0
    when 'd0' then 0
    when '1' then 1
    when 'd1' then 1
    when '2' then 2
    when 'd2' then 2
    when '3' then 3
    when 'd3' then 3
    else null
  end::smallint;
$$;

create or replace function public.obs_effective_item_irt_a(
  p_payload jsonb,
  p_event_irt_a double precision default null
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when public.obs_normalize_distractor_distance(
      p_payload->>'distractor_distance'
    ) is not null
    then greatest(
      0.25,
      least(
        3.0,
        coalesce(
          public.obs_payload_number(p_payload, 'irt_a'),
          p_event_irt_a,
          1.0
        )
      )
    )
    else greatest(
      0.25,
      least(
        3.0,
        coalesce(
          p_event_irt_a,
          public.obs_payload_number(p_payload, 'irt_a'),
          1.0
        )
      )
    )
  end;
$$;

create or replace function public.obs_effective_item_irt_b(
  p_payload jsonb,
  p_event_irt_b double precision default null
)
returns double precision
language sql
stable
parallel safe
set search_path = public
as $$
  select case
    when public.obs_normalize_distractor_distance(
      p_payload->>'distractor_distance'
    ) is not null
    then greatest(
      -4.0,
      least(
        4.0,
        coalesce(
          public.obs_payload_number(p_payload, 'irt_b'),
          (
            select c.default_irt_b
            from public.obs_distractor_distance_calibration c
            where c.distance = public.obs_normalize_distractor_distance(
              p_payload->>'distractor_distance'
            )
          ),
          p_event_irt_b,
          0.0
        )
      )
    )
    else greatest(
      -4.0,
      least(
        4.0,
        coalesce(
          p_event_irt_b,
          public.obs_payload_number(p_payload, 'irt_b'),
          0.0
        )
      )
    )
  end;
$$;

create or replace function public.obs_item_information(
  p_theta double precision,
  p_irt_a double precision,
  p_irt_b double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  with probability as (
    select 1.0 / (
      1.0 + exp(
        -greatest(0.25, least(3.0, coalesce(p_irt_a, 1.0)))
        * (
          greatest(-4.0, least(4.0, coalesce(p_theta, 0.0)))
          - greatest(-4.0, least(4.0, coalesce(p_irt_b, 0.0)))
        )
      )
    ) as p
  )
  select least(
    1.0,
    4.0
      * power(greatest(0.25, least(3.0, coalesce(p_irt_a, 1.0))), 2)
      * p
      * (1.0 - p)
  )
  from probability;
$$;

create or replace view public.obs_question_distractor_profiles as
select
  q.generated_question_id,
  q.book_code,
  q.question_type,
  nullif(q.payload->>'stem_family', '') as stem_family,
  q.payload->>'distractor_distance' as authored_distance,
  public.obs_normalize_distractor_distance(
    q.payload->>'distractor_distance'
  ) as distractor_distance,
  public.obs_payload_number(q.payload, 'irt_a') as authored_irt_a,
  public.obs_payload_number(q.payload, 'irt_b') as authored_irt_b,
  be.irt_a::double precision as event_irt_a,
  be.irt_b::double precision as event_irt_b,
  public.obs_effective_item_irt_a(q.payload, be.irt_a::double precision)
    as effective_irt_a,
  public.obs_effective_item_irt_b(q.payload, be.irt_b::double precision)
    as effective_irt_b,
  case
    when q.payload ? 'distractor_distance'
      and public.obs_normalize_distractor_distance(
        q.payload->>'distractor_distance'
      ) is null
      then 'invalid_distance'
    when public.obs_normalize_distractor_distance(
      q.payload->>'distractor_distance'
    ) is not null
      and nullif(q.payload->>'stem_family', '') is null
      then 'missing_stem_family'
    when public.obs_payload_number(q.payload, 'irt_b') is not null
      and c.distance is not null
      and public.obs_payload_number(q.payload, 'irt_b')
        not between c.min_irt_b and c.max_irt_b
      then 'item_b_outside_distance_band'
    when c.distance is not null then 'ready'
    else 'legacy_fallback'
  end as metadata_status
from public.v_question_bank q
left join public.bible_events be
  on be.id = q.event_id
left join public.obs_distractor_distance_calibration c
  on c.distance = public.obs_normalize_distractor_distance(
    q.payload->>'distractor_distance'
  );

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
  k_reward constant numeric := 0.20;
  reward_cap constant numeric := 1.25;
  reward_floor constant numeric := 0.70;
  guess_allowance constant numeric := 0.25;
  tf1 constant numeric := 1.0;
  tf2 constant numeric := 0.6;
  tf3 constant numeric := 0.35;
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
      public.obs_effective_item_irt_b(
        qb.payload,
        be.irt_b::double precision
      )::numeric as b
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
      public.obs_effective_item_irt_a(
        qb.payload,
        be.irt_a::double precision
      ) as a,
      public.obs_effective_item_irt_b(
        qb.payload,
        be.irt_b::double precision
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

drop function if exists public.get_next_assessment_question(uuid, uuid);

create function public.get_next_assessment_question(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select a.id
    from public.assessment_attempts a
    where a.id = p_attempt_id
      and a.user_id = p_user_id
      and auth.uid() = p_user_id
  ),
  attempt_answers as (
    select
      aa.generated_question_id,
      nullif(used.payload->>'stem_family', '') as stem_family
    from public.assessment_answers aa
    join public.v_question_bank used
      on used.generated_question_id = aa.generated_question_id
    join authorized_attempt authorized
      on authorized.id = aa.attempt_id
    where aa.user_id = p_user_id
  ),
  user_history as (
    select
      aa.generated_question_id,
      count(*)::integer as times_answered,
      max(aa.answered_at) as last_answered_at
    from public.assessment_answers aa
    where aa.user_id = p_user_id
      and aa.generated_question_id is not null
    group by aa.generated_question_id
  ),
  raw_candidates as (
    select
      q.generated_question_id,
      q.question_type,
      coalesce(q.payload->>'prompt', q.prompt) as prompt,
      q.payload,
      q.book_code,
      q.created_at,
      q.routing_score,
      q.importance_conceptual,
      q.importance_context,
      coalesce(be.event_title, q.book_code || ' question') as event_title,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      public.obs_effective_item_irt_a(
        q.payload,
        be.irt_a::double precision
      ) as effective_a,
      public.obs_effective_item_irt_b(
        q.payload,
        be.irt_b::double precision
      ) as effective_b,
      coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0)
        as theta_lcb,
      least(
        1.0,
        greatest(
          0.0,
          case
            when q.importance_conceptual is not null
              or q.importance_context is not null
            then (
              0.70 * coalesce(q.importance_conceptual, 0)
              + 0.30 * coalesce(q.importance_context, 0)
            ) / 100.0
            else coalesce(q.routing_score / 100.0, 0.50)
          end
        )
      ) as importance_score
    from authorized_attempt authorized
    join public.v_question_bank q
      on true
    left join public.bible_events be
      on be.id = q.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = case
       when q.book_code in ('GEN','EXO','LEV','NUM','DEU') then 'TORAH'
       when q.book_code in ('JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST') then 'FORMER'
       when q.book_code in ('ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL') then 'LATTER'
       when q.book_code in ('JOB','PSA','PRO','ECC','SNG') then 'WRITINGS'
       else 'OT'
     end
    left join user_history history
      on history.generated_question_id = q.generated_question_id
    where q.generated_question_id is not null
      and q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and coalesce(q.importance_conceptual, 0) >= 55
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id = q.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(q.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(q.payload->>'stem_family', '')
      )
  ),
  scored as (
    select
      candidate.*,
      public.obs_item_information(
        candidate.theta_lcb,
        candidate.effective_a,
        candidate.effective_b
      ) as information_score,
      1.0 / (1.0 + candidate.times_answered) as exposure_score
    from raw_candidates candidate
  ),
  ranked as (
    select
      scored.*,
      (
        0.50 * information_score
        + 0.35 * importance_score
        + 0.10 * exposure_score
        + 0.05 * random()
      ) as adaptive_score
    from scored
  )
  select
    generated_question_id as out_generated_question_id,
    prompt,
    question_type,
    payload->'choices' as choices,
    event_title,
    book_code,
    case
      when coalesce(importance_conceptual, routing_score, 0) >= 80 then 1
      when coalesce(importance_conceptual, routing_score, 0) >= 60 then 2
      else 3
    end as importance_tier,
    case
      when book_code in ('GEN','EXO','LEV','NUM','DEU') then 'Torah'
      when book_code in ('JOS','JDG','RUT','1SA','2SA','1KI','2KI') then 'Former Prophets'
      when book_code in ('ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL') then 'Latter Prophets'
      when book_code in ('1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG') then 'Writings'
      else 'Old Testament'
    end as section
  from ranked
  order by adaptive_score desc, times_answered asc, last_answered_at asc nulls first
  limit 1;
$$;

create or replace function public.obs_get_next_focused_question(
  p_user_id uuid,
  p_attempt_id uuid,
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select a.id
    from public.assessment_attempts a
    where a.id = p_attempt_id
      and a.user_id = p_user_id
      and auth.uid() = p_user_id
  ),
  target as (
    select unit.*
    from public.obs_learning_units unit
    join authorized_attempt authorized on true
    where (p_unit_key is not null and unit.unit_key = p_unit_key)
       or (
         p_unit_key is null
         and p_book_code is not null
         and unit.book_code = upper(p_book_code)
         and unit.start_chapter = p_start_chapter
         and unit.end_chapter = p_end_chapter
       )
    order by unit.sequence_order
    limit 1
  ),
  attempt_answers as (
    select
      aa.generated_question_id,
      nullif(used.payload->>'stem_family', '') as stem_family
    from public.assessment_answers aa
    join public.v_question_bank used
      on used.generated_question_id = aa.generated_question_id
    join authorized_attempt authorized
      on authorized.id = aa.attempt_id
    where aa.user_id = p_user_id
  ),
  user_history as (
    select
      aa.generated_question_id,
      count(*)::integer as times_answered,
      max(aa.answered_at) as last_answered_at
    from public.assessment_answers aa
    where aa.user_id = p_user_id
      and aa.generated_question_id is not null
    group by aa.generated_question_id
  ),
  raw_candidates as (
    select
      q.*,
      coalesce(t.label, q.unit_label, q.book_code || ' focused retest')
        as target_label,
      coalesce(t.section, q.unit_section, 'Old Testament') as target_section,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      public.obs_effective_item_irt_a(
        q.payload,
        event.irt_a::double precision
      ) as effective_a,
      public.obs_effective_item_irt_b(
        q.payload,
        event.irt_b::double precision
      ) as effective_b,
      coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0)
        as theta_lcb,
      least(
        1.0,
        greatest(
          0.0,
          case
            when q.importance_conceptual is not null
              or q.importance_context is not null
            then (
              0.70 * coalesce(q.importance_conceptual, 0)
              + 0.30 * coalesce(q.importance_context, 0)
            ) / 100.0
            else coalesce(q.routing_score / 100.0, 0.50)
          end
        )
      ) as importance_score
    from public.obs_question_bank_with_units q
    join authorized_attempt authorized on true
    left join target t on true
    left join public.bible_events event
      on event.id = q.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = case
       when q.book_code in ('GEN','EXO','LEV','NUM','DEU') then 'TORAH'
       when q.book_code in ('JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST') then 'FORMER'
       when q.book_code in ('ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL') then 'LATTER'
       when q.book_code in ('JOB','PSA','PRO','ECC','SNG') then 'WRITINGS'
       else 'OT'
     end
    left join user_history history
      on history.generated_question_id = q.generated_question_id
    where q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and (
        (p_unit_key is not null and q.unit_key = p_unit_key)
        or (
          p_unit_key is null
          and p_book_code is not null
          and q.book_code = upper(p_book_code)
          and q.inferred_chapter between p_start_chapter and p_end_chapter
        )
      )
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id = q.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(q.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(q.payload->>'stem_family', '')
      )
  ),
  scored as (
    select
      candidate.*,
      public.obs_item_information(
        candidate.theta_lcb,
        candidate.effective_a,
        candidate.effective_b
      ) as information_score,
      1.0 / (1.0 + candidate.times_answered) as exposure_score
    from raw_candidates candidate
  ),
  ranked as (
    select
      scored.*,
      (
        0.50 * information_score
        + 0.35 * importance_score
        + 0.10 * exposure_score
        + 0.05 * random()
      ) as adaptive_score
    from scored
  )
  select
    generated_question_id as out_generated_question_id,
    coalesce(payload->>'prompt', prompt) as prompt,
    question_type,
    payload->'choices' as choices,
    target_label as event_title,
    book_code,
    case
      when coalesce(importance_conceptual, routing_score, 0) >= 80 then 1
      when coalesce(importance_conceptual, routing_score, 0) >= 60 then 2
      else 3
    end as importance_tier,
    target_section as section
  from ranked
  order by adaptive_score desc, times_answered asc, last_answered_at asc nulls first
  limit 1;
$$;

create or replace function public.obs_simulate_router_v2(
  p_attempt_id uuid,
  p_user_id uuid,
  p_theta_override double precision default null,
  p_limit integer default 25
)
returns table (
  candidate_rank bigint,
  generated_question_id uuid,
  book_code text,
  dimension_key text,
  stem_family text,
  event_difficulty double precision,
  authored_item_difficulty double precision,
  effective_item_difficulty double precision,
  theta_used double precision,
  target_dimension_share double precision,
  observed_dimension_share double precision,
  dimension_need_score double precision,
  information_score double precision,
  importance_score double precision,
  times_answered integer,
  total_score double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with attempt as (
    select a.*
    from public.assessment_attempts a
    where a.id = p_attempt_id
      and a.user_id = p_user_id
  ),
  attempt_answers as (
    select
      aa.generated_question_id,
      q.book_code,
      q.dimension_key,
      nullif(q.payload->>'stem_family', '') as stem_family
    from public.assessment_answers aa
    join public.obs_question_bank_with_dimensions q
      on q.generated_question_id = aa.generated_question_id
    where aa.attempt_id = p_attempt_id
      and aa.user_id = p_user_id
  ),
  observed_by_dimension as (
    select dimension_key, count(*)::double precision as answered
    from attempt_answers
    group by dimension_key
  ),
  observed_total as (
    select count(*)::double precision as answered
    from attempt_answers
  ),
  user_history as (
    select
      aa.generated_question_id,
      count(*)::integer as times_answered
    from public.assessment_answers aa
    where aa.user_id = p_user_id
      and aa.generated_question_id is not null
    group by aa.generated_question_id
  ),
  eligible_targets as (
    select
      target.book_code,
      target.dimension_key,
      target.target_active_questions::double precision
    from public.question_coverage_targets target
    cross join attempt a
    where public.question_matches_assessment_scope(
      target.book_code,
      a.testament,
      a.scope_key
    )
  ),
  target_profiles as (
    select
      dimension_key,
      sum(target_active_questions)
        / nullif(sum(sum(target_active_questions)) over (), 0) as target_share
    from eligible_targets
    group by dimension_key
  ),
  raw_candidates as (
    select
      q.generated_question_id,
      q.book_code,
      q.dimension_key,
      nullif(q.payload->>'stem_family', '') as stem_family,
      event.irt_b::double precision as event_b,
      public.obs_payload_number(q.payload, 'irt_b') as authored_b,
      public.obs_effective_item_irt_b(
        q.payload,
        event.irt_b::double precision
      ) as effective_b,
      public.obs_effective_item_irt_a(
        q.payload,
        event.irt_a::double precision
      ) as effective_a,
      coalesce(
        p_theta_override,
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        0.0
      ) as theta_used,
      coalesce(profile.target_share, 0.0) as target_share,
      coalesce(observed.answered / nullif(total.answered, 0), 0.0)
        as observed_share,
      coalesce(history.times_answered, 0) as times_answered,
      least(
        1.0,
        greatest(
          0.0,
          case
            when q.importance_conceptual is not null
              or q.importance_context is not null
            then (
              0.70 * coalesce(q.importance_conceptual, 0)
              + 0.30 * coalesce(q.importance_context, 0)
            ) / 100.0
            else coalesce(q.routing_score / 100.0, 0.50)
          end
        )
      ) as importance_score
    from attempt a
    join public.obs_question_bank_with_dimensions q
      on public.question_matches_assessment_scope(
        q.book_code,
        a.testament,
        a.scope_key
      )
    left join public.bible_events event
      on event.id = q.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = case
       when a.scope_key in ('OT', 'NT')
         then public.canonical_assessment_scope(q.book_code)
       else a.scope_key
     end
    join eligible_targets book_target
      on book_target.book_code = q.book_code
     and book_target.dimension_key = q.dimension_key
     and book_target.target_active_questions > 0
    left join target_profiles profile
      on profile.dimension_key = q.dimension_key
    left join observed_by_dimension observed
      on observed.dimension_key = q.dimension_key
    cross join observed_total total
    left join user_history history
      on history.generated_question_id = q.generated_question_id
    where q.generated_question_id is not null
      and q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and jsonb_array_length(q.payload->'choices') = 4
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id = q.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(q.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(q.payload->>'stem_family', '')
      )
  ),
  scored as (
    select
      candidate.*,
      greatest(0.0, candidate.target_share - candidate.observed_share)
        as dimension_need,
      public.obs_item_information(
        candidate.theta_used,
        candidate.effective_a,
        candidate.effective_b
      ) as information_score
    from raw_candidates candidate
  ),
  ranked as (
    select
      scored.*,
      (
        0.40 * scored.dimension_need
        + 0.35 * scored.information_score
        + 0.20 * scored.importance_score
        + 0.05 * (1.0 / (1.0 + scored.times_answered))
      ) as total_score
    from scored
  )
  select
    row_number() over (
      order by total_score desc, times_answered asc, generated_question_id
    ) as candidate_rank,
    generated_question_id,
    book_code,
    dimension_key,
    stem_family,
    event_b,
    authored_b,
    effective_b,
    theta_used,
    target_share,
    observed_share,
    dimension_need,
    information_score,
    importance_score,
    times_answered,
    total_score
  from ranked
  order by candidate_rank
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

create or replace function public.nt_get_pilot_questions(
  p_section text default null,
  p_book_code text default null,
  p_limit integer default 20
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  book_code text,
  book_name text,
  nt_division text
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select
      q.generated_question_id,
      coalesce(q.payload->>'prompt', q.prompt) as prompt,
      q.question_type,
      q.payload,
      q.book_code,
      book.name as book_name,
      book.nt_division,
      nullif(q.payload->>'stem_family', '') as stem_family,
      public.obs_effective_item_irt_a(q.payload, null) as effective_a,
      public.obs_effective_item_irt_b(q.payload, null) as effective_b,
      coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0)
        as theta_lcb,
      greatest(
        0.0,
        least(
          1.0,
          coalesce(
            public.obs_payload_number(q.payload, 'importance_conceptual') / 100.0,
            0.60
          )
        )
      ) as importance_score
    from public.v_nt_question_bank q
    left join public.scripture_books book
      on book.book_code = q.book_code
    left join public.user_abilities ability
      on ability.user_id = auth.uid()
     and ability.scope = upper(
       regexp_replace(book.nt_division, '[^A-Za-z0-9]+', '_', 'g')
     )
    where q.generated_question_id is not null
      and q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and (p_book_code is null or q.book_code = upper(p_book_code))
      and (p_section is null or book.nt_division = p_section)
  ),
  scored as (
    select
      candidate.*,
      (
        0.70 * public.obs_item_information(
          candidate.theta_lcb,
          candidate.effective_a,
          candidate.effective_b
        )
        + 0.25 * candidate.importance_score
        + 0.05 * random()
      ) as adaptive_score
    from candidates candidate
  ),
  one_per_family as (
    select
      scored.*,
      row_number() over (
        partition by coalesce(
          scored.stem_family,
          scored.generated_question_id::text
        )
        order by scored.adaptive_score desc, scored.generated_question_id
      ) as family_rank
    from scored
  )
  select
    generated_question_id as out_generated_question_id,
    prompt,
    question_type,
    payload->'choices' as choices,
    book_code,
    book_name,
    nt_division
  from one_per_family
  where family_rank = 1
  order by adaptive_score desc, generated_question_id
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

comment on table public.obs_distractor_distance_calibration is
  'Canonical d0-d3 distractor-distance bands used as the item difficulty dial.';

comment on view public.obs_question_distractor_profiles is
  'Active question calibration audit, including distractor distance, stem family, and effective IRT values.';

comment on function public.obs_effective_item_irt_b(jsonb, double precision) is
  'Uses item-first difficulty for d0-d3 questions and preserves event-first calibration for untagged legacy questions.';

grant select on public.obs_distractor_distance_calibration
  to anon, authenticated, service_role;
grant select on public.obs_question_distractor_profiles
  to authenticated, service_role;
grant execute on function public.obs_payload_number(jsonb, text)
  to anon, authenticated, service_role;
grant execute on function public.obs_normalize_distractor_distance(text)
  to anon, authenticated, service_role;
grant execute on function public.obs_effective_item_irt_a(jsonb, double precision)
  to anon, authenticated, service_role;
grant execute on function public.obs_effective_item_irt_b(jsonb, double precision)
  to anon, authenticated, service_role;
grant execute on function public.obs_item_information(double precision, double precision, double precision)
  to anon, authenticated, service_role;

revoke all on function public.obs_simulate_router_v2(
  uuid, uuid, double precision, integer
) from public, anon, authenticated;
grant execute on function public.obs_simulate_router_v2(
  uuid, uuid, double precision, integer
) to service_role;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated;

revoke all on function public.obs_get_next_focused_question(
  uuid, uuid, text, text, integer, integer
) from public, anon;
grant execute on function public.obs_get_next_focused_question(
  uuid, uuid, text, text, integer, integer
) to authenticated;

revoke all on function public.nt_get_pilot_questions(text, text, integer)
  from public;
grant execute on function public.nt_get_pilot_questions(text, text, integer)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
