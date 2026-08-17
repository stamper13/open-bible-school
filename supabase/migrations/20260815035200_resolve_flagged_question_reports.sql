-- Resolve the current flagged-question queue.
--
-- Salvageable content issues are repaired in place. Items that repeatedly
-- caused submit failures or test Hebrew-division taxonomy too directly are
-- quarantined so the router will not serve them while they await deeper review.

begin;

-- Repair: Numbers 19 red-heifer item had weak, obviously unrelated distractors.
update public.ot_generated_questions question
set payload = jsonb_build_object(
    'prompt', 'What is made from the ashes of the red heifer in Numbers 19?',
    'book_code', 'NUM',
    'chapter', 19,
    'reference', 'Numbers 19:1-13',
    'explanation', 'The ashes are mixed with fresh water to prepare water for purification from corpse impurity.',
    'choices', jsonb_build_array(
      jsonb_build_object(
        'id', 'A',
        'text', 'Oil for ordaining priests who serve at the tabernacle',
        'meta', jsonb_build_object(
          'distractor', jsonb_build_object(
            'plausibility', 'high',
            'relation', 'same_law_category',
            'misconception_code', 'num19_red_heifer_priestly_oil'
          )
        )
      ),
      jsonb_build_object(
        'id', 'B',
        'text', 'Incense for the annual entrance into the Most Holy Place',
        'meta', jsonb_build_object(
          'distractor', jsonb_build_object(
            'plausibility', 'high',
            'relation', 'same_law_category',
            'misconception_code', 'num19_red_heifer_atonement_incense'
          )
        )
      ),
      jsonb_build_object('id', 'C', 'text', 'Water for purification from corpse impurity'),
      jsonb_build_object(
        'id', 'D',
        'text', 'Ashes placed on the altar after the daily burnt offering',
        'meta', jsonb_build_object(
          'distractor', jsonb_build_object(
            'plausibility', 'medium',
            'relation', 'same_law_category',
            'misconception_code', 'num19_red_heifer_altar_ashes'
          )
        )
      )
    ),
    'correct_choice_id', 'C',
    'correct_answer', 'Water for purification from corpse impurity',
    'dimension_key', 'law_commands',
    'question_layer', '3',
    'question_format', 'multiple_choice',
    'question_family', 'torah_coverage',
    'knowledge_granularity', 'passage_detail',
    'retrieval_target', 'textual_knowledge',
    'exact_chapter_recall_required', false,
    'baseline_eligible', false,
    'source_batch', '20260726_torah_question_coverage',
    'stem_family', 'torah_gap|NUM|19|red_heifer_water',
    'retest_stage', 'detail',
    'importance_conceptual', 68,
    'importance_context', 76,
    'difficulty_estimate', 650,
    'irt_a', 1.0,
    'irt_b', 1.1,
    'distractor_contract_version', 1,
    'distractor_quality_reviewed', true,
    'length_tell_reviewed', true
  ),
  dedupe_key = 'torah_gap|NUM|19|red_heifer_water'
where question.id = 'd0eaca60-076a-4c34-9ea3-239b117f20d8'::uuid;

-- Repair: Ezekiel 34 good-shepherd item had cartoonish distractors.
update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              question.payload,
              '{choices}',
              jsonb_build_array(
                jsonb_build_object('id', 'A', 'text', 'He will shepherd his flock himself and set up his servant David over them'),
                jsonb_build_object(
                  'id', 'B',
                  'text', 'He will raise faithful priests to guard the temple and teach purity laws',
                  'meta', jsonb_build_object('distractor', jsonb_build_object('plausibility', 'high', 'relation', 'same_theme', 'misconception_code', 'ezk34_priestly_reform'))
                ),
                jsonb_build_object(
                  'id', 'C',
                  'text', 'He will appoint foreign rulers to discipline Israel until the exile ends',
                  'meta', jsonb_build_object('distractor', jsonb_build_object('plausibility', 'high', 'relation', 'same_theme', 'misconception_code', 'ezk34_foreign_rulers'))
                ),
                jsonb_build_object(
                  'id', 'D',
                  'text', 'He will gather the flock under Moses and renew the wilderness covenant',
                  'meta', jsonb_build_object('distractor', jsonb_build_object('plausibility', 'medium', 'relation', 'same_theme', 'misconception_code', 'ezk34_mosaic_wilderness'))
                )
              )
            ),
            '{correct_answer}',
            to_jsonb('He will shepherd his flock himself and set up his servant David over them'::text)
          ),
          '{explanation}',
          to_jsonb('Ezekiel 34 promises that the LORD himself will shepherd his people and set Davidic rule over them after condemning Israel''s failed shepherds.'::text)
        ),
        '{distractor_contract_version}',
        '1'::jsonb
      ),
      '{distractor_quality_reviewed}',
      'true'::jsonb
    ),
    '{length_tell_reviewed}',
    'true'::jsonb
  )
where question.id = 'd3e60c5c-c55c-49ad-a7f5-35e542ed19bd'::uuid;

-- Repair: Daniel section-setting item had distractors that were too easy.
update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        question.payload,
        '{choices}',
        jsonb_build_array(
          jsonb_build_object('id', 'A', 'text', 'Faithful Jews live under foreign empires, and visions portray God''s rule over kingdoms.'),
          jsonb_build_object(
            'id', 'B',
            'text', 'A priestly prophet among exiles sees temple visions and the return of God''s glory.',
            'meta', jsonb_build_object('distractor', jsonb_build_object('plausibility', 'high', 'relation', 'same_generation', 'misconception_code', 'daniel_setting_ezekiel_exile'))
          ),
          jsonb_build_object(
            'id', 'C',
            'text', 'Returned exiles rebuild temple, wall, and covenant life under Persian rule.',
            'meta', jsonb_build_object('distractor', jsonb_build_object('plausibility', 'high', 'relation', 'near_chronology', 'misconception_code', 'daniel_setting_return_books'))
          ),
          jsonb_build_object(
            'id', 'D',
            'text', 'Jews in Persia face destruction and are delivered through a royal court reversal.',
            'meta', jsonb_build_object('distractor', jsonb_build_object('plausibility', 'medium', 'relation', 'same_generation', 'misconception_code', 'daniel_setting_esther_diaspora'))
          )
        )
      ),
      '{correct_answer}',
      to_jsonb('Faithful Jews live under foreign empires, and visions portray God''s rule over kingdoms.'::text)
    ),
    '{length_tell_reviewed}',
    'true'::jsonb
  )
where question.id = '7e8d1614-fd73-4a31-9004-f6bc62f8f8ba'::uuid;

-- Repair: broad prophetic-settings item should not read like a drag-order item.
update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        question.payload,
        '{prompt}',
        to_jsonb('Which broad timeline best fits the settings of these prophetic books?'::text)
      ),
      '{explanation}',
      to_jsonb('Some prophets address Assyrian-era crises, others the Babylonian exile, and Haggai/Zechariah the return-era temple work.'::text)
    ),
    '{length_tell_reviewed}',
    'true'::jsonb
  )
where question.id = 'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid;

-- Quarantine pure Hebrew-division taxonomy items and repeated timeout/system
-- report targets. They can be rewritten later, but should not be served now.
update public.ot_generated_questions question
set question_type = case
    when question.question_type like 'quarantined%' then question.question_type
    else 'quarantined_' || question.question_type
  end,
  payload = jsonb_set(
    question.payload,
    '{quarantine_reason}',
    to_jsonb('Resolved from question_reports queue: pure taxonomy or repeated submit failure.'::text)
  )
where question.id in (
  '6314bb62-6baf-4f93-a828-23b26763d819'::uuid,
  '388de17d-1953-4332-9842-0e20f848cbaf'::uuid,
  '9d62a0e0-216a-47bd-85aa-c653bfb7c2b5'::uuid,
  'de00daf0-633e-4c06-9318-692138cfbbd2'::uuid,
  'a5c614ac-acee-4cb2-8005-c9e8c05ebf61'::uuid,
  '6a47db8e-542a-43b5-a8f1-41bc1e10e728'::uuid,
  '5b7dc568-111e-41d4-8747-8b9874e80ef6'::uuid,
  'b497722a-76cc-40e9-857c-7521dfe55bfe'::uuid,
  'fe8b3804-c2b4-4cc5-891a-b7536f4e7e3d'::uuid,
  'cf7a6722-2a0b-41cb-a883-e238371a2378'::uuid,
  '1ae9fc83-26c3-4f9a-95c1-7b750da34755'::uuid
);

-- Mark the queue handled. The auto-skip reports are covered by the frontend
-- order-response fix and/or quarantine above.
update public.question_reports
set status = 'resolved',
    resolved_at = now()
where coalesce(status, 'open') not in ('resolved', 'dismissed');

do $$
declare
  v_open integer;
  v_bad_verdict integer;
begin
  select count(*)
  into v_open
  from public.question_reports
  where coalesce(status, 'open') not in ('resolved', 'dismissed');

  if v_open <> 0 then
    raise exception 'Expected 0 open question reports, found %', v_open;
  end if;

  select count(*)
  into v_bad_verdict
  from public.ot_generated_questions question
  where question.id in (
      'd0eaca60-076a-4c34-9ea3-239b117f20d8'::uuid,
      'd3e60c5c-c55c-49ad-a7f5-35e542ed19bd'::uuid,
      '7e8d1614-fd73-4a31-9004-f6bc62f8f8ba'::uuid,
      'ce3375be-cd72-4a29-996e-33260b064ccb'::uuid
    )
    and public.obs_distractor_quality_verdict(question.payload, question.question_type) <> 'pass';

  if v_bad_verdict <> 0 then
    raise exception 'Repaired questions did not pass distractor-quality verdict.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
