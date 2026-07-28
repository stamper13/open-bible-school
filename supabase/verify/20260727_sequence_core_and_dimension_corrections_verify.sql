-- Fail-loud verification for sequence routing bands and dimension corrections.

do $$
declare
  broad_count integer;
  broad_stage_2_count integer;
  detail_count integer;
  detail_stage_3_count integer;
  corrected_dimension_count integer;
  cross_testament_prompt_count integer;
  selector_definition text;
begin
  select
    count(*)::integer,
    count(*) filter (
      where public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) = 2
    )::integer
  into broad_count, broad_stage_2_count
  from public.obs_question_bank_with_dimensions question
  left join public.bible_events event
    on event.id = question.event_id
  where question.question_type = 'sequence_order_v1'
    and question.payload->>'question_family' = 'broad_event_sequence';

  select
    count(*)::integer,
    count(*) filter (
      where public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) = 3
    )::integer
  into detail_count, detail_stage_3_count
  from public.obs_question_bank_with_dimensions question
  left join public.bible_events event
    on event.id = question.event_id
  where question.question_type = 'sequence_order_v1'
    and question.payload->>'retest_stage' = 'detail';

  select count(*)::integer
  into corrected_dimension_count
  from public.obs_question_bank_with_dimensions question
  where (
      question.payload->>'prompt' in (
        'Whose voices dominate the poetry of Song of Songs?',
        'What contrast structures Psalm 1?'
      )
      and question.dimension_key = 'theological_reasoning'
    )
    or (
      question.payload->>'prompt' =
        'What pattern of ministry makes Elijah a defining prophetic figure in Israel?'
      and question.dimension_key = 'characters_lineage'
    );

  select count(*)::integer
  into cross_testament_prompt_count
  from public.ot_generated_questions question
  where question.question_type not like 'quarantined%'
    and question.payload->>'prompt' ilike
      'What pattern of ministry makes Elijah%both the OT and NT?';

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into selector_definition;

  if broad_count <> 6
     or broad_stage_2_count <> 6
     or detail_count < 5
     or detail_stage_3_count <> detail_count
     or corrected_dimension_count <> 3
     or cross_testament_prompt_count <> 0
     or selector_definition not like '%sequence_answered%'
     or selector_definition not like '%answered_total >= 4%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Sequence/dimension verification failed: broad=%s stage2=%s detail=%s stage3=%s corrected=%s cross_testament=%s router_sequence=%s.',
        broad_count,
        broad_stage_2_count,
        detail_count,
        detail_stage_3_count,
        corrected_dimension_count,
        cross_testament_prompt_count,
        selector_definition like '%sequence_answered%'
      );
  end if;

  raise notice
    'PASS: six broad sequence items route at core, % detail sequences remain hard, three dimensions are corrected, and Elijah is OT-only.',
    detail_count;
end
$$;

select
  question.book_code,
  question.payload->>'prompt' as prompt,
  question.payload->>'retest_stage' as retest_stage,
  public.obs_focused_item_stage(
    question.question_type,
    question.payload,
    public.obs_effective_item_irt_b(
      question.payload,
      event.irt_b::double precision
    )
  ) as router_stage
from public.obs_question_bank_with_dimensions question
left join public.bible_events event
  on event.id = question.event_id
where question.question_type = 'sequence_order_v1'
order by router_stage, question.book_code, prompt;
