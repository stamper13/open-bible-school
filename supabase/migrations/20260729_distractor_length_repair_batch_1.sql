-- Repair the ten strongest answer-length giveaways found by the full-bank
-- distractor audit. Keep each option in the same semantic category and at a
-- comparable level of specificity.

begin;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_distractor_length_repair_batch_1',
  'public',
  'ot_generated_questions',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'id', question.id,
      'payload', question.payload
    )
    order by question.id
  )::text
from public.ot_generated_questions question
where question.id in (
  '39d0db3b-5f93-4dec-8bb6-c0a52a84834b'::uuid,
  '866d0509-ffc4-4e5b-9cdc-c69afd7c6bc9'::uuid,
  '7f10110e-8fae-4ccb-9afc-2928af5a767c'::uuid,
  '55a04b35-f1cf-468c-a36b-c68e7eaf9f8c'::uuid,
  'ccd65522-c9a9-4cf9-ac6a-b991ff030b1a'::uuid,
  'f7136597-4ec7-4fc9-b976-b0bffc9a6257'::uuid,
  '57857310-9013-4a0b-854f-cff22b2fd4f8'::uuid,
  'c19170b4-4087-49f3-bc4d-20a1a8917af4'::uuid,
  '0cb93a6f-a7da-4617-8d64-6521ecf12dab'::uuid,
  '07b97c0a-26ad-4d7e-82cc-78e10485cf69'::uuid
)
having count(*) = 10
   and not exists (
     select 1
     from public.obs_schema_backups backup
     where backup.backup_tag =
             '20260729_distractor_length_repair_batch_1'
       and backup.object_schema = 'public'
       and backup.object_name = 'ot_generated_questions'
       and backup.object_type = 'data'
   );

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_distractor_length_repair_batch_1'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions'
    and object_type = 'data';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Distractor repair backup failed; found %s rows.',
        backup_count
      );
  end if;
end
$$;

with repairs (
  id,
  correct_id,
  choice_a,
  choice_b,
  choice_c,
  choice_d
) as (
  values
    (
      '39d0db3b-5f93-4dec-8bb6-c0a52a84834b'::uuid,
      'A',
      'Baal is powerless because he is no god at all',
      'Baal is limited to the coastal lands',
      'Baal answers only through royal priests',
      'Baal is powerful but weaker than the LORD'
    ),
    (
      '866d0509-ffc4-4e5b-9cdc-c69afd7c6bc9'::uuid,
      'B',
      'Prophet and judge',
      'King and priest',
      'Shepherd and warrior',
      'Son and servant'
    ),
    (
      '7f10110e-8fae-4ccb-9afc-2928af5a767c'::uuid,
      'D',
      'Babylon has permanently replaced David''s dynasty',
      'Judah''s restoration is already complete',
      'The exile has canceled every royal promise',
      'The Davidic covenant is not extinct'
    ),
    (
      '55a04b35-f1cf-468c-a36b-c68e7eaf9f8c'::uuid,
      'C',
      'Whether any human can be righteous before God',
      'Whether God can forgive a sinner like Job',
      'Whether Job fears God for nothing',
      'Whether every instance of suffering is caused by sin'
    ),
    (
      'ccd65522-c9a9-4cf9-ac6a-b991ff030b1a'::uuid,
      'A',
      'Israel took the land from the Amorites',
      'Joshua allotted it directly from Ammon',
      'Abraham purchased it from the Ammonites',
      'Israel received it peacefully from Moab'
    ),
    (
      'f7136597-4ec7-4fc9-b976-b0bffc9a6257'::uuid,
      'D',
      'Fear not, for I have redeemed you',
      'Come to me, all who are weary',
      'Those who hope in the LORD will renew their strength',
      'Be still and know that I am God'
    ),
    (
      '57857310-9013-4a0b-854f-cff22b2fd4f8'::uuid,
      'A',
      'Fear God and keep his commandments',
      'Enjoy life because nothing has lasting meaning',
      'Seek wisdom so the wise escape death',
      'Build wealth so your legacy will endure'
    ),
    (
      'c19170b4-4087-49f3-bc4d-20a1a8917af4'::uuid,
      'D',
      'It makes Shechem Israel''s permanent sanctuary',
      'It ends disputes over tribal boundaries',
      'It repeats the Jordan crossing for a new generation',
      'It frames the conquest as a covenant response'
    ),
    (
      '0cb93a6f-a7da-4617-8d64-6521ecf12dab'::uuid,
      'D',
      'It identifies David as author of every psalm',
      'It gives the temple''s musical order',
      'It announces Israel''s historical chronology',
      'It frames the Psalter as instruction'
    ),
    (
      '07b97c0a-26ad-4d7e-82cc-78e10485cf69'::uuid,
      'D',
      'He replaced Passover with a feast for Baal',
      'He allied with Assyria and adopted its gods',
      'He expelled every Levite from Israel',
      'He set up golden calves at Bethel and Dan'
    )
)
update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        question.payload,
        '{choices}',
        jsonb_build_array(
          jsonb_build_object('id', 'A', 'text', repairs.choice_a),
          jsonb_build_object('id', 'B', 'text', repairs.choice_b),
          jsonb_build_object('id', 'C', 'text', repairs.choice_c),
          jsonb_build_object('id', 'D', 'text', repairs.choice_d)
        )
      ),
      '{correct_answer}',
      to_jsonb(
        case repairs.correct_id
          when 'A' then repairs.choice_a
          when 'B' then repairs.choice_b
          when 'C' then repairs.choice_c
          else repairs.choice_d
        end
      )
    ),
    '{distractor_review}',
    '"same_category_length_balanced"'::jsonb
  )
from repairs
where question.id = repairs.id
  and question.payload->>'correct_choice_id' = repairs.correct_id;

do $$
declare
  repaired_count integer;
  remaining_length_flags integer;
begin
  select count(*)
  into repaired_count
  from public.ot_generated_questions
  where id in (
    '39d0db3b-5f93-4dec-8bb6-c0a52a84834b'::uuid,
    '866d0509-ffc4-4e5b-9cdc-c69afd7c6bc9'::uuid,
    '7f10110e-8fae-4ccb-9afc-2928af5a767c'::uuid,
    '55a04b35-f1cf-468c-a36b-c68e7eaf9f8c'::uuid,
    'ccd65522-c9a9-4cf9-ac6a-b991ff030b1a'::uuid,
    'f7136597-4ec7-4fc9-b976-b0bffc9a6257'::uuid,
    '57857310-9013-4a0b-854f-cff22b2fd4f8'::uuid,
    'c19170b4-4087-49f3-bc4d-20a1a8917af4'::uuid,
    '0cb93a6f-a7da-4617-8d64-6521ecf12dab'::uuid,
    '07b97c0a-26ad-4d7e-82cc-78e10485cf69'::uuid
  )
    and payload->>'distractor_review'
      = 'same_category_length_balanced';

  select count(*)
  into remaining_length_flags
  from public.obs_question_distractor_quality_audit
  where generated_question_id in (
    '39d0db3b-5f93-4dec-8bb6-c0a52a84834b'::uuid,
    '866d0509-ffc4-4e5b-9cdc-c69afd7c6bc9'::uuid,
    '7f10110e-8fae-4ccb-9afc-2928af5a767c'::uuid,
    '55a04b35-f1cf-468c-a36b-c68e7eaf9f8c'::uuid,
    'ccd65522-c9a9-4cf9-ac6a-b991ff030b1a'::uuid,
    'f7136597-4ec7-4fc9-b976-b0bffc9a6257'::uuid,
    '57857310-9013-4a0b-854f-cff22b2fd4f8'::uuid,
    'c19170b4-4087-49f3-bc4d-20a1a8917af4'::uuid,
    '0cb93a6f-a7da-4617-8d64-6521ecf12dab'::uuid,
    '07b97c0a-26ad-4d7e-82cc-78e10485cf69'::uuid
  )
    and (
      correct_answer_long_flag
      or correct_answer_short_flag
    );

  if repaired_count <> 10 or remaining_length_flags <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Distractor length repair failed: repaired=%s remaining_flags=%s.',
        repaired_count,
        remaining_length_flags
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
