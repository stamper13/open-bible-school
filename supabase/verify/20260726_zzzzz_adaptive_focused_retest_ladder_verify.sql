-- Fail-loud verification for the focused retest ladder.

do $$
declare
  lev_orientation_stage integer;
  easy_only numeric;
  broad_similar_accuracy numeric;
  selector_definition text;
  recommendation_definition text;
  lev_foundation_count integer;
  lev_core_count integer;
  lev_detail_count integer;
begin
  select public.obs_focused_item_stage(
    question.question_type,
    question.payload,
    public.obs_effective_item_irt_b(
      question.payload,
      event.irt_b::double precision
    )
  )
  into lev_orientation_stage
  from public.v_question_bank question
  left join public.bible_events event
    on event.id = question.event_id
  where question.book_code = 'LEV'
    and question.question_type = 'book_orientation_mcq_v1'
  limit 1;

  select public.obs_focused_mastery_raw(
    1.0,
    null,
    null,
    true,
    true,
    true
  )
  into easy_only;

  select public.obs_focused_mastery_raw(
    0.80,
    0.70,
    0.55,
    true,
    true,
    true
  )
  into broad_similar_accuracy;

  select
    count(*) filter (where stage = 1)::integer,
    count(*) filter (where stage = 2)::integer,
    count(*) filter (where stage = 3)::integer
  into
    lev_foundation_count,
    lev_core_count,
    lev_detail_count
  from (
    select public.obs_focused_item_stage(
      question.question_type,
      question.payload,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      )
    ) as stage
    from public.obs_question_bank_with_units question
    left join public.bible_events event
      on event.id = question.event_id
    where question.book_code = 'LEV'
      and (
        question.unit_key = 'lev-1-16'
        or question.question_type = 'book_orientation_mcq_v1'
      )
  ) classified;

  select pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  )
  into selector_definition;

  select pg_get_functiondef(
    'public.obs_get_user_recommendation_v2(uuid)'::regprocedure
  )
  into recommendation_definition;

  if lev_orientation_stage <> 1
     or easy_only <> 40.00
     or broad_similar_accuracy <= easy_only
     or lev_foundation_count < 2
     or lev_core_count < 1
     or lev_detail_count < 1
     or selector_definition not like '%stage_1_answered%'
     or selector_definition not like '%stage_2_answered%'
     or selector_definition like '%random() * 0.35%'
     or recommendation_definition not like
       '%obs_get_unit_mastery_score%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused ladder VERIFY FAILED: lev_orientation=%s stages=%s/%s/%s easy_only=%s broad=%s adaptive=%s mastery_recommendation=%s.',
        lev_orientation_stage,
        lev_foundation_count,
        lev_core_count,
        lev_detail_count,
        easy_only,
        broad_similar_accuracy,
        selector_definition like '%stage_1_answered%',
        recommendation_definition like
          '%obs_get_unit_mastery_score%'
      );
  end if;

  raise notice
    'PASS: focused retests use all three stages; easy-only mastery=% versus broad similar-accuracy mastery=%; Leviticus 1-16 has stage counts %/%/%.',
    easy_only,
    broad_similar_accuracy,
    lev_foundation_count,
    lev_core_count,
    lev_detail_count;
end
$$;

select
  public.obs_focused_stage_label(classified.stage) as stage,
  count(*)::integer as available_questions,
  min(classified.prompt) as sample_question
from (
  select
    public.obs_focused_item_stage(
      question.question_type,
      question.payload,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      )
    ) as stage,
    coalesce(question.payload->>'prompt', question.prompt) as prompt
  from public.obs_question_bank_with_units question
  left join public.bible_events event
    on event.id = question.event_id
  where question.book_code = 'LEV'
    and (
      question.unit_key = 'lev-1-16'
      or question.question_type = 'book_orientation_mcq_v1'
    )
) classified
group by classified.stage
order by classified.stage;
