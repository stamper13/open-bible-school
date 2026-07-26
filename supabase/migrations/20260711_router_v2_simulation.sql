-- Additive, non-serving router-v2 simulator.
-- Does not replace get_next_scoped_assessment_question or change scoring.

begin;

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
      t.book_code,
      t.dimension_key,
      t.target_active_questions::double precision
    from public.question_coverage_targets t
    cross join attempt a
    where public.question_matches_assessment_scope(t.book_code, a.testament, a.scope_key)
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
      be.irt_b::double precision as event_b,
      case
        when (q.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (q.payload->>'irt_b')::double precision
      end as authored_b,
      coalesce(
        case
          when (q.payload->>'irt_b') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (q.payload->>'irt_b')::double precision
        end,
        be.irt_b::double precision,
        0.0
      ) as effective_b,
      coalesce(
        case
          when (q.payload->>'irt_a') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (q.payload->>'irt_a')::double precision
        end,
        be.irt_a::double precision,
        1.0
      ) as effective_a,
      coalesce(
        p_theta_override,
        ua.theta - 0.5 * coalesce(ua.theta_se, 1.0),
        0.0
      ) as theta_used,
      coalesce(tp.target_share, 0.0) as target_share,
      coalesce(od.answered / nullif(ot.answered, 0), 0.0) as observed_share,
      coalesce(uh.times_answered, 0) as times_answered,
      least(
        1.0,
        greatest(
          0.0,
          (0.70 * coalesce(q.importance_conceptual, 0)
            + 0.30 * coalesce(q.importance_context, 0)) / 100.0
        )
      ) as importance_score
    from attempt a
    join public.obs_question_bank_with_dimensions q
      on public.question_matches_assessment_scope(q.book_code, a.testament, a.scope_key)
    left join public.bible_events be
      on be.id = q.event_id
    left join public.user_abilities ua
      on ua.user_id = p_user_id
     and ua.scope = case
       when a.scope_key in ('OT', 'NT') then public.canonical_assessment_scope(q.book_code)
       else a.scope_key
     end
    join eligible_targets book_target
      on book_target.book_code = q.book_code
     and book_target.dimension_key = q.dimension_key
     and book_target.target_active_questions > 0
    left join target_profiles tp
      on tp.dimension_key = q.dimension_key
    left join observed_by_dimension od
      on od.dimension_key = q.dimension_key
    cross join observed_total ot
    left join user_history uh
      on uh.generated_question_id = q.generated_question_id
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
      r.*,
      greatest(0.0, r.target_share - r.observed_share) as dimension_need,
      least(
        1.0,
        4.0 * power(r.effective_a, 2)
          * (1.0 / (1.0 + exp(-r.effective_a * (r.theta_used - r.effective_b))))
          * (1.0 - (1.0 / (1.0 + exp(-r.effective_a * (r.theta_used - r.effective_b)))))
      ) as information_score
    from raw_candidates r
  ),
  ranked as (
    select
      s.*,
      (
        0.40 * s.dimension_need
        + 0.35 * s.information_score
        + 0.20 * s.importance_score
        + 0.05 * (1.0 / (1.0 + s.times_answered))
      ) as total_score
    from scored s
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

comment on function public.obs_simulate_router_v2(uuid, uuid, double precision, integer) is
  'Read-only router-v2 candidate simulation. It does not serve questions or mutate attempts.';

revoke all on function public.obs_simulate_router_v2(uuid, uuid, double precision, integer) from public, anon, authenticated;
grant execute on function public.obs_simulate_router_v2(uuid, uuid, double precision, integer) to service_role;

notify pgrst, 'reload schema';

commit;
