-- Fail-loud verification for Genesis 1-11 retest curation.

do $$
declare
  foundation_stems integer;
  core_stems integer;
  detail_stems integer;
  bad_outline_dimensions integer;
  duplicate_family_groups integer;
  selector_definition text;
  wrapper_definition text;
begin
  select
    count(distinct stem_family) filter (where stage = 1)::integer,
    count(distinct stem_family) filter (where stage = 2)::integer,
    count(distinct stem_family) filter (where stage = 3)::integer
  into foundation_stems, core_stems, detail_stems
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
      coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      ) as stem_family
    from public.obs_question_bank_with_units question
    left join public.bible_events event
      on event.id = question.event_id
    where question.unit_key = 'gen-1-11'
       or (
         question.book_code = 'GEN'
         and question.question_type = 'book_orientation_mcq_v1'
       )
  ) classified;

  select count(*)::integer
  into bad_outline_dimensions
  from public.obs_question_bank_with_units question
  where question.question_type = 'genesis_outline_v1_mcq'
    and question.dimension_key = 'structure_cross_ref';

  select count(*)::integer
  into duplicate_family_groups
  from (
    select question.payload->>'stem_family'
    from public.ot_generated_questions question
    where question.id in (
      '86a2b9a7-99dd-489c-8dc4-7d345cdcf1e3'::uuid,
      '62278155-4684-46fa-8402-e984bcf5e274'::uuid,
      'f2d5635f-d68f-447d-b83b-a7cdd50f3694'::uuid,
      'be63586b-e619-4d74-81d5-f979a4d5d223'::uuid,
      'ccc6e75a-265a-4826-8c07-d15dbd0a056c'::uuid,
      '6a26e1f8-9529-4b93-a007-4cd945161ca0'::uuid,
      '00b2a46a-acfc-461a-abb2-b3ed8840413a'::uuid,
      'aba95fa9-4d31-4607-a0b6-eb02bf48214a'::uuid,
      'bcdb6a3e-7606-4514-8fc9-036229f59279'::uuid,
      '027fd525-e789-41c6-8c24-c6bccfe4f2e3'::uuid
    )
    group by question.payload->>'stem_family'
    having count(*) = 2
  ) families;

  select pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  )
  into selector_definition;

  select pg_get_functiondef(
    'public.obs_get_next_ot_assessment_question(uuid)'::regprocedure
  )
  into wrapper_definition;

  if foundation_stems < 8
     or core_stems < 6
     or detail_stems < 5
     or bad_outline_dimensions <> 0
     or duplicate_family_groups <> 5
     or selector_definition not like
       '%desired.difficulty_stage <> 3%'
     or selector_definition not like
       '%candidate.effective_irt_b%'
     or wrapper_definition not like
       '%focused_assessment_stage_exhaustion%'
     or wrapper_definition not like
       '%target_question_count = answered_total%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Genesis retest VERIFY FAILED: stages=%s/%s/%s bad_outline_dimensions=%s duplicate_families=%s hard_only=%s early_complete=%s.',
        foundation_stems,
        core_stems,
        detail_stems,
        bad_outline_dimensions,
        duplicate_family_groups,
        selector_definition like
          '%desired.difficulty_stage <> 3%',
        wrapper_definition like
          '%focused_assessment_stage_exhaustion%'
      );
  end if;

  raise notice
    'PASS: Genesis 1-11 has %/%/% distinct foundation/core/detail stems, no outline item is Cross Ref, and exhausted detail stages complete instead of falling back.',
    foundation_stems,
    core_stems,
    detail_stems;
end
$$;

select
  public.obs_focused_stage_label(classified.stage) as stage,
  count(distinct classified.stem_family)::integer
    as distinct_question_families,
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
    coalesce(
      nullif(question.payload->>'stem_family', ''),
      question.generated_question_id::text
    ) as stem_family,
    coalesce(question.payload->>'prompt', question.prompt) as prompt
  from public.obs_question_bank_with_units question
  left join public.bible_events event
    on event.id = question.event_id
  where question.unit_key = 'gen-1-11'
     or (
       question.book_code = 'GEN'
       and question.question_type = 'book_orientation_mcq_v1'
     )
) classified
group by classified.stage
order by classified.stage;
