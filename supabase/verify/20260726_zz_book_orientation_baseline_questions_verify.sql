-- Fail-loud verification for baseline Old Testament book-orientation items.

do $$
declare
  active_count integer;
  book_count integer;
  invalid_payload_count integer;
  invalid_taxonomy_count integer;
  invalid_difficulty_count integer;
  blocked_count integer;
begin
  select
    count(*),
    count(distinct question.payload->>'book_code')
  into active_count, book_count
  from public.ot_generated_questions question
  where question.question_type = 'book_orientation_mcq_v1'
    and question.payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions';

  select count(*)
  into invalid_payload_count
  from public.ot_generated_questions question
  where question.question_type = 'book_orientation_mcq_v1'
    and question.payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions'
    and (
      jsonb_typeof(question.payload->'choices') is distinct from 'array'
      or jsonb_array_length(question.payload->'choices') <> 4
      or not exists (
        select 1
        from jsonb_array_elements(question.payload->'choices') choice
        where choice->>'id' = question.payload->>'correct_choice_id'
          and choice->>'text' = question.payload->>'correct_answer'
      )
      or question.payload->>'question_layer' <> '1'
      or question.payload->>'question_family' <> 'book_orientation'
      or question.payload->>'knowledge_granularity' <> 'book_overview'
      or question.payload->>'retrieval_target' <> 'book_identity'
      or question.payload->>'exact_chapter_recall_required' <> 'false'
      or question.payload->>'baseline_eligible' <> 'true'
      or nullif(question.payload->>'stem_family', '') is null
    );

  select count(*)
  into invalid_taxonomy_count
  from public.ot_generated_questions question
  left join public.obs_biblical_books book
    on book.book_code = question.payload->>'book_code'
   and book.testament = 'OT'
  left join public.obs_bli_dimensions dimension
    on dimension.dimension_key = question.payload->>'dimension_key'
  where question.question_type = 'book_orientation_mcq_v1'
    and question.payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions'
    and (
      book.book_code is null
      or dimension.dimension_key is null
      or dimension.dimension_key = 'structure_cross_ref'
    );

  select count(*)
  into invalid_difficulty_count
  from public.ot_generated_questions question
  where question.question_type = 'book_orientation_mcq_v1'
    and question.payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions'
    and (
      (question.payload->>'irt_b')::numeric not between -1.60 and -0.70
      or (question.payload->>'importance_conceptual')::numeric < 65
    );

  select count(*)
  into blocked_count
  from public.obs_admin_question_bank_audit audit
  where audit.question_type = 'book_orientation_mcq_v1'
    and audit.payload->>'source_batch' =
      '20260726_book_orientation_baseline_questions'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
    );

  if active_count <> 39
     or book_count <> 39
     or invalid_payload_count <> 0
     or invalid_taxonomy_count <> 0
     or invalid_difficulty_count <> 0
     or blocked_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Book-orientation VERIFY FAILED: active=%s/39 books=%s/39 payload=%s taxonomy=%s difficulty=%s blocked=%s.',
        active_count,
        book_count,
        invalid_payload_count,
        invalid_taxonomy_count,
        invalid_difficulty_count,
        blocked_count
      );
  end if;
end
$$;

select
  question.payload->>'book_code' as book_code,
  question.payload->>'dimension_key' as dimension_key,
  question.payload->>'prompt' as prompt,
  question.payload->>'correct_answer' as correct_answer,
  question.payload->>'difficulty_estimate' as difficulty_estimate
from public.ot_generated_questions question
where question.question_type = 'book_orientation_mcq_v1'
  and question.payload->>'source_batch' =
    '20260726_book_orientation_baseline_questions'
order by question.payload->>'book_code';
