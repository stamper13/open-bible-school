begin;

with repaired_payload as (
  select
    question.id,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'A',
        'text', 'Deliverance from judgment for the remnant the LORD calls in Zion and Jerusalem'
      ),
      jsonb_build_object(
        'id', 'B',
        'text', 'Appointment of all worshipers as priests because they keep the feast'
      ),
      jsonb_build_object(
        'id', 'C',
        'text', 'Automatic restoration of each returnee to an ancestral land share'
      ),
      jsonb_build_object(
        'id', 'D',
        'text', 'Protection from future locust swarms for everyone fasting in Zion'
      )
    ) as choices
  from public.ot_generated_questions question
  where question.question_type not like 'quarantined%'
    and upper(coalesce(question.payload->>'book_code', '')) = 'JOL'
    and (
      coalesce(question.payload->>'prompt', '') =
        'What does Joel promise concerning everyone who calls on the name of the LORD?'
      or exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(question.payload->'choices') = 'array'
              then question.payload->'choices'
            else '[]'::jsonb
          end
        ) choice
        where choice->>'text' ilike
          '%everyone who calls on the name of the LORD will be saved%'
      )
    )
)
update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            question.payload,
            '{prompt}',
            to_jsonb(
              'In Joel 2:32, what hope is attached to calling on the LORD in the day of the LORD?'::text
            ),
            true
          ),
          '{choices}',
          repaired_payload.choices,
          true
        ),
        '{correct_choice_id}',
        to_jsonb('A'::text),
        true
      ),
      '{correct_answer}',
      to_jsonb(
        'Deliverance from judgment for the remnant the LORD calls in Zion and Jerusalem'::text
      ),
      true
    ),
    '{explanation}',
    to_jsonb(
      'Joel 2:32 promises deliverance for those who call on the LORD, locating that hope with the survivors in Zion and Jerusalem whom the LORD calls.'::text
    ),
    true
  )
  || jsonb_build_object(
    'content_repair_batch', '20260812_joel_call_lord_answer_leak',
    'content_repair_reason', 'Removed answer-language leakage from the correct choice.'
  )
from repaired_payload
where question.id = repaired_payload.id;

notify pgrst, 'reload schema';

commit;
