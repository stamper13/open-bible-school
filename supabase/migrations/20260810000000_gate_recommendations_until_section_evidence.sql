-- Gate ordinary OT recommendations behind the section evidence floor.
--
-- The dashboard may still route users to the least-sampled section through
-- obs_get_bli_section_followup_v1. This wrapper prevents the ordinary
-- point-estimate recommendation RPC from returning a learning-unit weakness
-- until every canonical OT section has at least 15 eligible answers.

begin;

do $$
begin
  if to_regprocedure('public.obs_get_user_recommendation_v2_ungated(uuid)') is null then
    if to_regprocedure('public.obs_get_user_recommendation_v2(uuid)') is null then
      raise exception 'Missing public.obs_get_user_recommendation_v2(uuid)';
    end if;

    alter function public.obs_get_user_recommendation_v2(uuid)
      rename to obs_get_user_recommendation_v2_ungated;
  end if;
end;
$$;

create or replace function public.obs_get_user_recommendation_v2(
  p_user_id uuid
)
returns table (
  unit_key text,
  label text,
  section text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  sequence_order integer,
  is_foundation boolean,
  answered integer,
  correct integer,
  raw_score numeric,
  display_score integer,
  baseline_display_score_required integer,
  retest_question_target integer,
  focus_text text,
  reason text,
  recommendation_kind text,
  dimension_key text,
  dimension_label text,
  dimension_short_label text,
  dimension_answered integer,
  dimension_correct integer,
  dimension_display_score integer,
  dimension_available_questions integer,
  dimension_focus_text text
)
language sql
stable
security definer
set search_path = public
as $function$
  with authorized as (
    select 1
    where public.obs_is_authorized_user(p_user_id)
  ), canonical_ot_sections as (
    select *
    from (values
      ('Torah', 1),
      ('Former Prophets', 2),
      ('Latter Prophets', 3),
      ('Writings', 4)
    ) section(section_name, canonical_order)
  ), eligible_section_answers as (
    select
      evidence.section as section_name,
      count(*)::integer as answered
    from public.obs_answer_evidence evidence
    join authorized on true
    join public.assessment_answers answer
      on answer.id = evidence.answer_id
     and answer.scoring_eligible
    where evidence.user_id = p_user_id
      and evidence.testament = 'OT'
      and evidence.question_type not like 'quarantined%'
    group by evidence.section
  ), section_evidence_gate as (
    select 1
    from authorized
    where not exists (
      select 1
      from canonical_ot_sections section
      left join eligible_section_answers answer_count
        on answer_count.section_name = section.section_name
      where coalesce(answer_count.answered, 0) < 15
    )
  )
  select recommendation.*
  from section_evidence_gate
  cross join lateral public.obs_get_user_recommendation_v2_ungated(
    p_user_id
  ) recommendation;
$function$;

revoke all on function public.obs_get_user_recommendation_v2_ungated(uuid)
  from public, anon, authenticated;
revoke all on function public.obs_get_user_recommendation_v2(uuid)
  from public, anon;
grant execute on function public.obs_get_user_recommendation_v2(uuid)
  to authenticated, service_role;

comment on function public.obs_get_user_recommendation_v2(uuid) is
  'Returns the ordinary OT learning-unit recommendation only after every canonical OT section has at least 15 eligible answers. Before then, clients should use obs_get_bli_section_followup_v1 for evidence-first routing.';

comment on function public.obs_get_user_recommendation_v2_ungated(uuid) is
  'Internal implementation preserved by 20260810000000_gate_recommendations_until_section_evidence. Do not grant to client roles; call obs_get_user_recommendation_v2 instead.';

notify pgrst, 'reload schema';

commit;
