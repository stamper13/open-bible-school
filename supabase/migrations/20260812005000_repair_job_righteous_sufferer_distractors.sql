begin;

with repaired_payload as (
  select
    question.id,
    jsonb_build_array(
      jsonb_build_object('id', 'A', 'text', 'Job'),
      jsonb_build_object('id', 'B', 'text', 'Eliphaz'),
      jsonb_build_object('id', 'C', 'text', 'Bildad'),
      jsonb_build_object('id', 'D', 'text', 'Zophar')
    ) as choices
  from public.ot_generated_questions question
  where question.question_type not like 'quarantined%'
    and upper(coalesce(question.payload->>'book_code', '')) = 'JOB'
    and coalesce(question.payload->>'prompt', '') =
      'Who is the righteous sufferer at the center of the book of Job?'
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(question.payload->'choices') = 'array'
            then question.payload->'choices'
          else '[]'::jsonb
        end
      ) choice
      where choice->>'text' in ('Jonah', 'Ahab', 'Boaz')
    )
)
update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          question.payload,
          '{choices}',
          repaired_payload.choices,
          true
        ),
        '{correct_choice_id}',
        to_jsonb('A'::text),
        true
      ),
      '{correct_answer}',
      to_jsonb('Job'::text),
      true
    ),
    '{explanation}',
    to_jsonb(
      'Job is the central righteous sufferer in the book; Eliphaz, Bildad, and Zophar are Job''s friends and disputants.'::text
    ),
    true
  )
  || jsonb_build_object(
    'distractor_distance', 'same_book',
    'distractor_review', 'same_book_characters_manual',
    'content_repair_batch', '20260812_job_righteous_sufferer_distractors',
    'content_repair_reason', 'Replaced cross-book character distractors with Job-internal character distractors.'
  )
from repaired_payload
where question.id = repaired_payload.id;

notify pgrst, 'reload schema';

commit;
