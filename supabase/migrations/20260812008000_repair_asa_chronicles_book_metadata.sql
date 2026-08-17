-- The Asa reform question is anchored to 2 Chronicles 14-15, but its generated
-- question payload was labeled 1KI. That made reviews and routing place it in
-- Former Prophets instead of Writings.

update public.ot_generated_questions question
set payload = jsonb_set(
    jsonb_set(
      coalesce(question.payload, '{}'::jsonb),
      '{book_code}',
      to_jsonb('2CH'::text),
      true
    ),
    '{knowledge_granularity}',
    to_jsonb('passage_detail'::text),
    true
  )
where question.id = '1ae9fc83-26c3-4f9a-95c1-7b750da34755'::uuid
  and question.dedupe_key = 'tier2_primary_anchor:2CH:14:1:asa_reforms'
  and question.payload->>'book_code' = '1KI';

notify pgrst, 'reload schema';
