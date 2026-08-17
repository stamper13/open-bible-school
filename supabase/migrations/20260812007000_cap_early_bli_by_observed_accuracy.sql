-- Prevent early BLI snapshots from reporting perfect mastery when the observed
-- scoring-eligible evidence is clearly not perfect. Difficulty weighting can
-- still move the score above raw accuracy, but it cannot swamp misses/skips on
-- a small baseline sample.

create or replace function public.obs_compute_scoped_bli(
  p_user_id uuid,
  p_testament text,
  p_as_of timestamptz default null
)
returns table (
  raw_bli numeric,
  display_bli integer,
  bli_level text,
  questions_answered integer,
  correct_answers integer,
  idk_answers integer,
  section_scores jsonb,
  total_weighted_possible numeric,
  total_weighted_earned numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
      and upper(p_testament) in ('OT', 'NT')
  ),
  rows as (
    select
      evidence.*,
      evidence.chronological_weight
        * case evidence.importance_tier
            when 1 then 1.0
            when 2 then 0.6
            else 0.35
          end as item_weight
    from public.obs_answer_evidence evidence
    join authorized on true
    where evidence.user_id = p_user_id
      and exists (
        select 1
        from public.assessment_answers eligible_answer
        where eligible_answer.id = evidence.answer_id
          and eligible_answer.scoring_eligible
      )
      and evidence.testament = upper(p_testament)
      and (p_as_of is null or evidence.answered_at <= p_as_of)
      and evidence.question_type not like 'quarantined%'
  ),
  aggregate_score as (
    select
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      coalesce(sum(item_weight), 0)::numeric as possible,
      coalesce(sum(
        case
          when is_idk then 0
          when is_correct then
            item_weight * least(
              1.25,
              greatest(0.70, 1.0 + 0.20 * effective_irt_b)
            )
          else -1 * item_weight * (0.25 / 0.75)
        end
      ), 0)::numeric as earned
    from rows
  ),
  normalized as (
    select
      greatest(
        0,
        least(
          100,
          weighted_raw_score,
          observed_accuracy + case
            when answered < 30 then 8
            when answered < 60 then 10
            when answered < 120 then 12
            else 15
          end,
          case
            when correct = answered and answered > 0 then 100
            else 99
          end
        )
      ) as raw_score,
      answered,
      correct,
      idk,
      possible,
      earned
    from (
      select
        answered,
        correct,
        idk,
        possible,
        earned,
        round(
          (
            case
              when possible > 0 then earned / possible * 100
              else 0
            end
          )::numeric,
          2
        ) as weighted_raw_score,
        round(
          (
            case
              when answered > 0 then correct::numeric / answered * 100
              else 0
            end
          )::numeric,
          2
        ) as observed_accuracy
      from aggregate_score
    ) scored
  ),
  section_aggregates as (
    select
      section,
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      coalesce(sum(item_weight), 0)::numeric as possible,
      coalesce(sum(
        case
          when is_idk then 0
          when is_correct then
            item_weight * least(
              1.25,
              greatest(0.70, 1.0 + 0.20 * effective_irt_b)
            )
          else -1 * item_weight * (0.25 / 0.75)
        end
      ), 0)::numeric as earned,
      round(
        count(*) filter (where is_correct)::numeric
          / nullif(count(*), 0) * 100,
        1
      ) as accuracy
    from rows
    group by section
  ),
  section_computed as (
    select
      section,
      answered,
      correct,
      idk,
      accuracy,
      possible,
      earned,
      greatest(0::numeric, least(100::numeric, round(
        (case when possible > 0 then earned / possible * 100 else 0 end)::numeric,
        1
      ))) as weighted_raw_pct,
      round(
        (
          case
            when answered > 0 then correct::numeric / answered * 100
            else 0
          end
        )::numeric,
        1
      ) as observed_accuracy
    from section_aggregates
  ),
  section_capped as (
    select
      section,
      answered,
      correct,
      idk,
      accuracy,
      possible,
      earned,
      greatest(
        0::numeric,
        least(
          100::numeric,
          weighted_raw_pct,
          observed_accuracy + case
            when answered < 8 then 8
            when answered < 20 then 10
            else 12
          end,
          case
            when correct = answered and answered > 0 then 100
            else 99
          end
        )
      ) as raw_pct
    from section_computed
  ),
  sections as (
    select coalesce(
      jsonb_object_agg(
        section,
        jsonb_build_object(
          'scoring_version', 'bli_weighted_v2_accuracy_capped',
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy_pct', accuracy,
          'raw_bli_pct', raw_pct,
          'display_bli', public.obs_display_score_from_raw(raw_pct),
          'weighted_possible', possible,
          'weighted_earned', earned,
          'bli_level', public.obs_display_bli_level(
            public.obs_display_score_from_raw(raw_pct)
          ),
          'accuracy', accuracy,
          'weighted_pct', raw_pct,
          '_legacy_aliases', jsonb_build_object(
            'accuracy', 'accuracy_pct',
            'weighted_pct', 'raw_bli_pct'
          )
        )
      ),
      '{}'::jsonb
    ) as scores
    from section_capped
  )
  select
    normalized.raw_score,
    public.obs_display_score_from_raw(normalized.raw_score),
    public.obs_display_bli_level(
      public.obs_display_score_from_raw(normalized.raw_score)
    ),
    normalized.answered,
    normalized.correct,
    normalized.idk,
    sections.scores,
    normalized.possible,
    normalized.earned
  from normalized
  cross join sections;
$$;

revoke all on function public.obs_compute_scoped_bli(uuid, text, timestamptz)
  from public, anon;
grant execute on function public.obs_compute_scoped_bli(uuid, text, timestamptz)
  to authenticated, service_role;

comment on function public.obs_compute_scoped_bli(uuid, text, timestamptz) is
  'Computes cumulative scoped BLI with difficulty weighting capped by observed scoring-eligible accuracy on early samples.';

with recalculated as (
  select
    snapshot.id,
    score.raw_bli,
    score.display_bli,
    score.bli_level,
    score.questions_answered,
    score.correct_answers,
    score.idk_answers,
    score.section_scores
  from public.obs_assessment_snapshots snapshot
  cross join lateral public.obs_compute_scoped_bli(
    snapshot.user_id,
    snapshot.testament,
    snapshot.captured_at
  ) score
)
update public.obs_assessment_snapshots snapshot
set raw_bli = recalculated.raw_bli,
    display_bli = recalculated.display_bli,
    bli_level = recalculated.bli_level,
    questions_answered = recalculated.questions_answered,
    correct_answers = recalculated.correct_answers,
    idk_answers = recalculated.idk_answers,
    section_scores = recalculated.section_scores
from recalculated
where snapshot.id = recalculated.id;

delete from public.obs_assessment_snapshots snapshot
using public.assessment_attempts attempt
where attempt.id = snapshot.attempt_id
  and coalesce(attempt.is_complete, false)
  and coalesce(attempt.answered_count, 0) >= 10
  and snapshot.questions_answered < attempt.answered_count * 0.75;

notify pgrst, 'reload schema';
