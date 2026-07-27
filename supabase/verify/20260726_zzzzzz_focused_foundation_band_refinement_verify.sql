-- Fail-loud verification for the refined focused foundation band.

do $$
declare
  lev_foundation integer;
  lev_core integer;
  lev_detail integer;
begin
  select
    count(*) filter (where stage = 1)::integer,
    count(*) filter (where stage = 2)::integer,
    count(*) filter (where stage = 3)::integer
  into lev_foundation, lev_core, lev_detail
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

  if lev_foundation < 2 or lev_core < 1 or lev_detail < 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused foundation refinement VERIFY FAILED: Leviticus stages=%s/%s/%s.',
        lev_foundation,
        lev_core,
        lev_detail
      );
  end if;

  raise notice
    'PASS: Leviticus 1-16 supports repeated foundation checks and later progression; stages=%/%/%.',
    lev_foundation,
    lev_core,
    lev_detail;
end
$$;

select
  public.obs_focused_stage_label(classified.stage) as stage,
  count(*)::integer as available_questions
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
) classified
group by classified.stage
order by classified.stage;
