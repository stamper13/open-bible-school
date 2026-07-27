-- Fail-loud verification for Genesis 1-11 detail expansion.

do $$
declare
  active_count integer;
  mcq_count integer;
  sequence_count integer;
  detail_families integer;
  bad_metadata integer;
  event_type_unique_indexes integer;
begin
  select
    count(*)::integer,
    count(*) filter (
      where question.question_type = 'genesis_detail_mcq_v1'
    )::integer,
    count(*) filter (
      where question.question_type = 'sequence_order_v1'
    )::integer
  into active_count, mcq_count, sequence_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
    '20260726_genesis_1_11_detail_expansion'
    and question.question_type not like 'quarantined%';

  select count(distinct coalesce(
    nullif(question.payload->>'stem_family', ''),
    question.generated_question_id::text
  ))::integer
  into detail_families
  from public.obs_question_bank_with_units question
  left join public.bible_events event
    on event.id = question.event_id
  where question.unit_key = 'gen-1-11'
    and public.obs_focused_item_stage(
      question.question_type,
      question.payload,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      )
    ) = 3;

  select count(*)::integer
  into bad_metadata
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' =
      '20260726_genesis_1_11_detail_expansion'
    and (
      audit.book_code <> 'GEN'
      or audit.dimension_key is null
      or cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
      or audit.payload->>'retest_stage' <> 'detail'
    );

  select count(*)::integer
  into event_type_unique_indexes
  from pg_indexes index_info
  where index_info.schemaname = 'public'
    and index_info.tablename = 'ot_generated_questions'
    and index_info.indexdef ilike 'create unique index%'
    and index_info.indexdef ~
      '\(event_id, question_type\)';

  if active_count <> 11
     or mcq_count <> 10
     or sequence_count <> 1
     or detail_families < 16
     or bad_metadata <> 0
     or event_type_unique_indexes <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Genesis detail VERIFY FAILED: active=%s mcq=%s sequence=%s detail_families=%s bad_metadata=%s event_type_unique_indexes=%s.',
        active_count,
        mcq_count,
        sequence_count,
        detail_families,
        bad_metadata,
        event_type_unique_indexes
      );
  end if;

  raise notice
    'PASS: 10 Genesis detail MCQs and 1 detail ordering question are active; Genesis 1-11 now has % detail families.',
    detail_families;
end
$$;

select
  question.question_type,
  question.payload->>'reference' as reference,
  question.payload->>'prompt' as prompt,
  question.payload->>'dimension_key' as dimension_key,
  question.payload->>'difficulty_estimate' as difficulty_estimate
from public.ot_generated_questions question
where question.payload->>'source_batch' =
  '20260726_genesis_1_11_detail_expansion'
  and question.question_type not like 'quarantined%'
order by
  (question.payload->>'chapter')::integer,
  question.payload->>'prompt';
