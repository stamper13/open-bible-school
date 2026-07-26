-- Read-only shadow report for item-level IRT calibration.
--
-- Purpose:
--   1. Compare the current event-first calibration with proposed item-first
--      calibration without changing any stored ability or BLI value.
--   2. Keep OT and NT results separate so the two indexes can be evaluated
--      independently.
--   3. Audit whether distractor-distance and stem-family metadata are ready for
--      the router-v2 model.
--
-- Safe to run in the Supabase SQL editor. Every statement is read only and the
-- transaction is rolled back at the end.

begin transaction read only;

-- ---------------------------------------------------------------------------
-- Result 1: calibration coverage and disagreement
-- ---------------------------------------------------------------------------

with answered_items as (
  select
    aa.user_id,
    aa.generated_question_id,
    upper(coalesce(be.book_code, qb.book_code)) as book_code,
    be.irt_a::double precision as event_a,
    be.irt_b::double precision as event_b,
    case
      when (qb.payload->>'irt_a') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (qb.payload->>'irt_a')::double precision
    end as item_a,
    case
      when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (qb.payload->>'irt_b')::double precision
    end as item_b
  from public.assessment_answers aa
  join public.ot_generated_questions oq
    on oq.id = aa.generated_question_id
  left join public.bible_events be
    on be.id = oq.event_id
  left join public.v_question_bank qb
    on qb.generated_question_id = oq.id
  where aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
)
select
  case
    when book_code in (
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
      '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
      'LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP',
      'HAG','ZEC','MAL'
    ) then 'OT'
    when book_code in (
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
      '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
      '3JN','JUD','REV'
    ) then 'NT'
    else 'UNMAPPED'
  end as testament,
  count(*) as answered_items,
  count(distinct user_id) as users,
  count(*) filter (where item_b is not null) as answers_with_item_b,
  count(*) filter (where event_b is not null) as answers_with_event_b,
  count(*) filter (
    where item_b is not null
      and event_b is not null
      and abs(item_b - event_b) >= 0.10
  ) as answers_with_material_b_disagreement,
  round(avg(abs(item_b - event_b)) filter (
    where item_b is not null and event_b is not null
  )::numeric, 3) as mean_absolute_b_difference
from answered_items
group by testament
order by testament;

-- ---------------------------------------------------------------------------
-- Result 2: current BLI versus item-first BLI, split into OT and NT indexes
-- ---------------------------------------------------------------------------

with scored_answers as (
  select
    aa.user_id,
    case
      when upper(coalesce(be.book_code, qb.book_code)) in (
        'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
        '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
        'LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP',
        'HAG','ZEC','MAL'
      ) then 'OT'
      when upper(coalesce(be.book_code, qb.book_code)) in (
        'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
        '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
        '3JN','JUD','REV'
      ) then 'NT'
    end as testament,
    aa.is_correct,
    coalesce(aa.is_idk, false) as is_idk,
    bw.chronological_weight
      * case
          when coalesce(es.importance_tier, 2) = 1 then 1.0
          when coalesce(es.importance_tier, 2) = 2 then 0.6
          else 0.35
        end as weight,
    coalesce(
      be.irt_b,
      case
        when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (qb.payload->>'irt_b')::numeric
      end,
      0.0
    ) as current_b,
    coalesce(
      case
        when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (qb.payload->>'irt_b')::numeric
      end,
      be.irt_b,
      0.0
    ) as item_first_b
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
  where aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
), earned as (
  select
    *,
    case
      when is_idk then 0
      when is_correct then
        weight * least(1.25, greatest(0.70, 1.0 + 0.20 * current_b))
      else
        -1 * weight * (0.25 / (1.0 - 0.25))
    end as current_earned,
    case
      when is_idk then 0
      when is_correct then
        weight * least(1.25, greatest(0.70, 1.0 + 0.20 * item_first_b))
      else
        -1 * weight * (0.25 / (1.0 - 0.25))
    end as item_first_earned
  from scored_answers
  where testament is not null
), user_scores as (
  select
    user_id,
    testament,
    count(*)::integer as questions_answered,
    greatest(
      0,
      least(100, round(sum(current_earned) / nullif(sum(weight), 0) * 100, 1))
    ) as current_bli,
    greatest(
      0,
      least(100, round(sum(item_first_earned) / nullif(sum(weight), 0) * 100, 1))
    ) as item_first_bli
  from earned
  group by user_id, testament
)
select
  user_id,
  testament,
  questions_answered,
  current_bli,
  item_first_bli,
  round(item_first_bli - current_bli, 1) as bli_delta,
  round(200 + current_bli * 6, 0) as current_display_score,
  round(200 + item_first_bli * 6, 0) as item_first_display_score
from user_scores
order by abs(item_first_bli - current_bli) desc, testament, user_id;

-- ---------------------------------------------------------------------------
-- Result 3: current theta versus item-first theta for OT and NT
-- ---------------------------------------------------------------------------

with answer_history as (
  select
    aa.user_id,
    case
      when upper(coalesce(be.book_code, qb.book_code)) in (
        'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI',
        '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER',
        'LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP',
        'HAG','ZEC','MAL'
      ) then 'OT'
      when upper(coalesce(be.book_code, qb.book_code)) in (
        'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL',
        '1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN',
        '3JN','JUD','REV'
      ) then 'NT'
    end as testament,
    aa.is_correct::integer as response,
    coalesce(
      be.irt_a,
      case
        when (qb.payload->>'irt_a') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (qb.payload->>'irt_a')::double precision
      end,
      1.0
    ) as current_a,
    coalesce(
      be.irt_b,
      case
        when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (qb.payload->>'irt_b')::double precision
      end,
      0.0
    ) as current_b,
    coalesce(
      case
        when (qb.payload->>'irt_a') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (qb.payload->>'irt_a')::double precision
      end,
      be.irt_a,
      1.0
    ) as item_first_a,
    coalesce(
      case
        when (qb.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (qb.payload->>'irt_b')::double precision
      end,
      be.irt_b,
      0.0
    ) as item_first_b
  from public.assessment_answers aa
  join public.ot_generated_questions oq
    on oq.id = aa.generated_question_id
  left join public.bible_events be
    on be.id = oq.event_id
  left join public.v_question_bank qb
    on qb.generated_question_id = oq.id
  where aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
), model_history as (
  select
    h.user_id,
    h.testament,
    h.response,
    model.model_name,
    model.a,
    model.b
  from answer_history h
  cross join lateral (
    values
      ('current'::text, h.current_a, h.current_b),
      ('item_first'::text, h.item_first_a, h.item_first_b)
  ) as model(model_name, a, b)
  where h.testament is not null
), grid as (
  select generate_series(-40, 40)::double precision * 0.1 as theta
), likelihood as (
  select
    h.user_id,
    h.testament,
    h.model_name,
    g.theta,
    -0.5 * g.theta * g.theta
      + sum(
          h.response * ln(
            least(
              1 - 1e-9,
              greatest(1e-9, 1.0 / (1.0 + exp(-h.a * (g.theta - h.b))))
            )
          )
          + (1 - h.response) * ln(
            1 - least(
              1 - 1e-9,
              greatest(1e-9, 1.0 / (1.0 + exp(-h.a * (g.theta - h.b))))
            )
          )
        ) as log_posterior
  from model_history h
  cross join grid g
  group by h.user_id, h.testament, h.model_name, g.theta
), weights as (
  select
    *,
    exp(log_posterior - max(log_posterior) over (
      partition by user_id, testament, model_name
    )) as weight
  from likelihood
), posterior as (
  select
    *,
    weight / sum(weight) over (
      partition by user_id, testament, model_name
    ) as probability
  from weights
), estimates as (
  select
    user_id,
    testament,
    model_name,
    sum(theta * probability) as theta
  from posterior
  group by user_id, testament, model_name
), compared as (
  select
    user_id,
    testament,
    max(theta) filter (where model_name = 'current') as current_theta,
    max(theta) filter (where model_name = 'item_first') as item_first_theta
  from estimates
  group by user_id, testament
)
select
  user_id,
  testament,
  round(current_theta::numeric, 3) as current_theta,
  round(item_first_theta::numeric, 3) as item_first_theta,
  round((item_first_theta - current_theta)::numeric, 3) as theta_delta
from compared
order by abs(item_first_theta - current_theta) desc, testament, user_id;

-- ---------------------------------------------------------------------------
-- Result 4: authoring readiness for distractor-distance routing
-- ---------------------------------------------------------------------------

select
  coalesce(nullif(q.payload->>'distractor_distance', ''), '<missing>') as distractor_distance,
  count(*) as active_questions,
  count(*) filter (
    where nullif(q.payload->>'stem_family', '') is not null
  ) as questions_with_stem_family,
  count(*) filter (
    where (q.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
  ) as questions_with_item_b,
  round(avg(
    case
      when (q.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (q.payload->>'irt_b')::numeric
    end
  ), 3) as mean_item_b,
  min(
    case
      when (q.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (q.payload->>'irt_b')::numeric
    end
  ) as min_item_b,
  max(
    case
      when (q.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (q.payload->>'irt_b')::numeric
    end
  ) as max_item_b
from public.v_question_bank q
group by coalesce(nullif(q.payload->>'distractor_distance', ''), '<missing>')
order by distractor_distance;

-- ---------------------------------------------------------------------------
-- Result 5: stem families whose variants could repeat in one assessment
-- ---------------------------------------------------------------------------

select
  q.payload->>'stem_family' as stem_family,
  count(*) as active_variants,
  array_agg(distinct q.payload->>'distractor_distance' order by q.payload->>'distractor_distance')
    as authored_distances,
  array_agg(distinct q.book_code order by q.book_code) as books
from public.v_question_bank q
where nullif(q.payload->>'stem_family', '') is not null
group by q.payload->>'stem_family'
having count(*) > 1
order by active_variants desc, stem_family;

rollback;
