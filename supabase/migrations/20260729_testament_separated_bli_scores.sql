-- Separate OT and NT BLI reads while preserving the established 0-800 scale
-- for each testament. A combined score is the two display scores added
-- together (0-1600) and is unavailable until both testaments have evidence.

begin;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_testament_separated_bli_scores',
  'public',
  'obs_compute_bli_internal',
  'function',
  pg_get_functiondef(
    'public.obs_compute_bli_internal(uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_testament_separated_bli_scores'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_compute_bli_internal'
    and backup.object_type = 'function'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_testament_separated_bli_scores'
    and object_schema = 'public'
    and object_name = 'obs_compute_bli_internal'
    and object_type = 'function';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Testament score backup failed: obs_compute_bli_internal backups=%s/1.',
        backup_count
      );
  end if;
end
$$;

create temporary table obs_bli_before_separation
on commit drop
as
select
  learner.user_id,
  score.questions_answered
from (
  select distinct answer.user_id
  from public.assessment_answers answer
  where answer.user_id is not null
) learner
cross join lateral public.obs_compute_bli_internal(learner.user_id) score;

create or replace function public.obs_compute_bli_internal(p_user_id uuid)
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
as $function$
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
      ) as b
    from public.assessment_answers aa
    join public.ot_generated_questions oq
      on oq.id = aa.generated_question_id
    left join public.bible_events be
      on be.id = oq.event_id
    left join public.v_question_bank qb
      on qb.generated_question_id = oq.id
    join public.book_bli_weights bw
      on upper(bw.book_code) =
           upper(coalesce(be.book_code, qb.book_code))
    left join public.event_significance es
      on es.event_id = oq.event_id
    where aa.user_id = p_user_id
      and aa.scoring_eligible
      and oq.question_type not like 'quarantined%'
      and coalesce(be.book_code, qb.book_code) is not null
      and public.obs_book_testament(
            upper(coalesce(be.book_code, qb.book_code))
          ) = 'OT'
  ), totals as (
    select
      count(*)::integer as n,
      coalesce(sum(
        case
          when is_idk then 0
          when is_correct then
            w * least(
              reward_cap,
              greatest(reward_floor, 1.0 + k_reward * b)
            )
          else
            -1 * w
              * (guess_allowance / (1.0 - guess_allowance))
        end
      ), 0) as earned,
      coalesce(sum(w), 0) as possible
    from answer_rows
  )
  select n, earned, possible
  into v_questions_answered, v_total_earned, v_total_possible
  from totals;

  if v_total_possible > 0 then
    v_bli := round(
      (v_total_earned / v_total_possible) * 100,
      1
    );
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
      on upper(bw.book_code) =
           upper(coalesce(be.book_code, qb.book_code))
    left join public.event_significance es
      on es.event_id = oq.event_id
    where aa.user_id = p_user_id
      and aa.scoring_eligible
      and oq.question_type not like 'quarantined%'
      and coalesce(be.book_code, qb.book_code) is not null
      and public.obs_book_testament(
            upper(coalesce(be.book_code, qb.book_code))
          ) = 'OT'
  ), section_rows as (
    select
      public.obs_book_section(bk) as section,
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
        'correct',
          count(*) filter (where is_correct)::integer,
        'idk',
          count(*) filter (where is_idk)::integer,
        'total',
          count(*)::integer,
        'pct',
          round(
            count(*) filter (where is_correct)::numeric
              / nullif(count(*), 0) * 100,
            1
          ),
        'weighted_pct',
          round(
            sum(case when is_correct then w else 0 end)
              / nullif(sum(w), 0) * 100,
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
$function$;

comment on function public.obs_compute_bli_internal(uuid) is
  'Legacy OT BLI computation. NT answers are excluded; use obs_get_testament_bli_scores for testament-separated dashboard scores.';

create or replace function public.obs_get_testament_bli_scores(
  p_user_id uuid
)
returns table (
  ot_raw_bli numeric,
  ot_display_bli integer,
  ot_bli_level text,
  ot_questions_answered integer,
  ot_correct_answers integer,
  ot_idk_answers integer,
  ot_section_scores jsonb,
  nt_raw_bli numeric,
  nt_display_bli integer,
  nt_bli_level text,
  nt_questions_answered integer,
  nt_correct_answers integer,
  nt_idk_answers integer,
  nt_section_scores jsonb,
  combined_display_bli integer,
  combined_questions_answered integer,
  combined_available boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.obs_is_authorized_user(p_user_id) then
    raise exception using
      errcode = '42501',
      message = 'Not authorized';
  end if;

  return query
  with ot as (
    select *
    from public.obs_compute_scoped_bli(
      p_user_id,
      'OT',
      null
    )
  ), nt as (
    select *
    from public.obs_compute_scoped_bli(
      p_user_id,
      'NT',
      null
    )
  )
  select
    ot.raw_bli,
    ot.display_bli,
    ot.bli_level,
    ot.questions_answered,
    ot.correct_answers,
    ot.idk_answers,
    ot.section_scores,
    nt.raw_bli,
    nt.display_bli,
    nt.bli_level,
    nt.questions_answered,
    nt.correct_answers,
    nt.idk_answers,
    nt.section_scores,
    case
      when ot.questions_answered > 0
       and nt.questions_answered > 0
        then ot.display_bli + nt.display_bli
      else null
    end,
    ot.questions_answered + nt.questions_answered,
    ot.questions_answered > 0
      and nt.questions_answered > 0
  from ot
  cross join nt;
end;
$function$;

comment on function public.obs_get_testament_bli_scores(uuid) is
  'Returns separate OT and NT 0-800 BLI scores. The 0-1600 combined total is available only when both testaments have scored evidence.';

revoke all on function public.obs_get_testament_bli_scores(uuid)
  from public, anon;
grant execute on function public.obs_get_testament_bli_scores(uuid)
  to authenticated, service_role;

do $$
declare
  leaked_user record;
  mismatch_count integer;
begin
  select
    before.user_id,
    before.questions_answered as before_count,
    after_score.questions_answered as after_count,
    expected.ot_count,
    expected.nt_count
  into leaked_user
  from obs_bli_before_separation before
  cross join lateral
    public.obs_compute_bli_internal(before.user_id) after_score
  cross join lateral (
    select
      count(*) filter (
        where evidence.testament = 'OT'
      )::integer as ot_count,
      count(*) filter (
        where evidence.testament = 'NT'
      )::integer as nt_count
    from public.obs_answer_evidence evidence
    join public.assessment_answers answer
      on answer.id = evidence.answer_id
    where evidence.user_id = before.user_id
      and answer.scoring_eligible
      and evidence.question_type not like 'quarantined%'
  ) expected
  where after_score.questions_answered <> expected.ot_count
     or before.questions_answered
          <> expected.ot_count + expected.nt_count
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Testament score separation failed for user %s: before=%s after=%s expected_ot=%s expected_nt=%s.',
        leaked_user.user_id,
        leaked_user.before_count,
        leaked_user.after_count,
        leaked_user.ot_count,
        leaked_user.nt_count
      );
  end if;

  perform set_config(
    'request.jwt.claim.role',
    'service_role',
    true
  );

  select count(*)
  into mismatch_count
  from (
    select distinct answer.user_id
    from public.assessment_answers answer
    where answer.user_id is not null
  ) learner
  cross join lateral
    public.obs_get_testament_bli_scores(learner.user_id) scores
  where scores.combined_available <>
          (
            scores.ot_questions_answered > 0
            and scores.nt_questions_answered > 0
          )
     or (
       scores.combined_available
       and scores.combined_display_bli <>
             scores.ot_display_bli + scores.nt_display_bli
     )
     or (
       not scores.combined_available
       and scores.combined_display_bli is not null
     );

  if mismatch_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Combined BLI contract failed for %s learners.',
        mismatch_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
