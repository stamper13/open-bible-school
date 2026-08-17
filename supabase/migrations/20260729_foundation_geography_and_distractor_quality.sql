-- Add independent foundation probes for every Minor Prophet, strengthen
-- foundational OT geography, repair three weak distractor sets, and install
-- a private distractor-quality audit view.

begin;

do $$
declare
  repair_rows integer;
begin
  if to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_effective_item_irt_b(jsonb,double precision)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Foundation/geography question prerequisites are missing.';
  end if;

  select count(*)
  into repair_rows
  from public.ot_generated_questions
  where id in (
    'de9bf7df-e1ff-47cd-acc1-7eb61e665a21'::uuid,
    '75c06208-9252-49bd-903d-aafc86cbcd7f'::uuid,
    '3edc4423-6d92-47be-9417-91493ad34766'::uuid
  );

  if repair_rows <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected 3 distractor-repair questions, found %s.',
        repair_rows
      );
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_foundation_geography_and_distractor_quality',
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
  'de9bf7df-e1ff-47cd-acc1-7eb61e665a21'::uuid,
  '75c06208-9252-49bd-903d-aafc86cbcd7f'::uuid,
  '3edc4423-6d92-47be-9417-91493ad34766'::uuid
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_foundation_geography_and_distractor_quality'
    and backup.object_schema = 'public'
    and backup.object_name = 'ot_generated_questions'
    and backup.object_type = 'data'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups
  where backup_tag =
          '20260729_foundation_geography_and_distractor_quality'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions'
    and object_type = 'data';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Question payload backup failed; found %s rows.',
        captured
      );
  end if;
end
$$;

with seed (
  book_code,
  dedupe_key,
  prompt,
  correct_id,
  choice_a,
  choice_b,
  choice_c,
  choice_d,
  dimension_key,
  source_ref,
  explanation,
  question_family,
  importance_context,
  importance_conceptual,
  difficulty_estimate
) as (
  values
    (
      'HOS',
      'foundation_v1|HOS|northern_kingdom_audience',
      'Hosea''s prophetic ministry is directed chiefly to which kingdom?',
      'B',
      'The southern kingdom of Judah',
      'The northern kingdom of Israel',
      'The neighboring kingdom of Edom',
      'The restored community after the exile',
      'geography_nations',
      'Hos 1:1; 4:1',
      'Hosea addresses the northern kingdom of Israel, often calling it Ephraim.',
      'book_baseline',
      72,
      67,
      448
    ),
    (
      'JOL',
      'foundation_v1|JOL|opening_disaster',
      'What kind of disaster opens the book of Joel?',
      'C',
      'A foreign army captures Jerusalem',
      'A drought empties every well',
      'A locust plague devastates the land',
      'An earthquake destroys the temple',
      'events_timeline',
      'Joel 1:1-12',
      'Joel opens with a devastating locust plague that becomes a summons to repentance.',
      'book_baseline',
      76,
      66,
      438
    ),
    (
      'AMO',
      'foundation_v1|AMO|judah_to_israel',
      'Amos came from Judah but was sent to prophesy mainly against which kingdom?',
      'A',
      'The northern kingdom of Israel',
      'The southern kingdom of Judah',
      'The kingdom of Moab',
      'The kingdom of Edom',
      'geography_nations',
      'Amos 1:1; 7:10-15',
      'Amos came from Tekoa in Judah and delivered his central warnings to northern Israel.',
      'book_baseline',
      74,
      68,
      452
    ),
    (
      'OBA',
      'foundation_v1|OBA|target_nation',
      'Which neighboring nation is the primary target of Obadiah''s prophecy?',
      'D',
      'Ammon',
      'Moab',
      'Philistia',
      'Edom',
      'geography_nations',
      'Obad 1-4, 10-14',
      'Obadiah announces judgment on Edom for pride and violence against Judah.',
      'book_baseline',
      78,
      70,
      430
    ),
    (
      'JON',
      'foundation_v1|JON|mission_city',
      'To which major foreign city is Jonah sent to preach?',
      'B',
      'Babylon',
      'Nineveh',
      'Damascus',
      'Tyre',
      'geography_nations',
      'Jonah 1:1-2; 3:1-3',
      'The LORD sends Jonah to Nineveh, the great Assyrian city.',
      'book_baseline',
      79,
      70,
      425
    ),
    (
      'MIC',
      'foundation_v1|MIC|samaria_jerusalem',
      'Which two capitals frame Micah''s warnings to Israel and Judah?',
      'C',
      'Nineveh and Babylon',
      'Damascus and Tyre',
      'Samaria and Jerusalem',
      'Bethel and Dan',
      'geography_nations',
      'Mic 1:1, 5-9',
      'Micah addresses the sins and coming judgment of Samaria and Jerusalem.',
      'book_baseline',
      75,
      68,
      462
    ),
    (
      'NAM',
      'foundation_v1|NAM|imperial_capital',
      'Which imperial capital''s fall is announced in Nahum?',
      'A',
      'Nineveh',
      'Babylon',
      'Susa',
      'Damascus',
      'geography_nations',
      'Nah 1:1; 2:8; 3:7',
      'Nahum announces the fall of Nineveh, capital of the Assyrian Empire.',
      'book_baseline',
      76,
      67,
      440
    ),
    (
      'HAB',
      'foundation_v1|HAB|complaint_answer_form',
      'What pattern drives the movement of Habakkuk?',
      'D',
      'A sequence of symbolic marriages and named children',
      'A collection of royal court stories and dream interpretations',
      'A series of restoration speeches to returned exiles',
      'The prophet''s complaints, the LORD''s answers, and a concluding prayer',
      'theological_reasoning',
      'Hab 1:2-2:20; 3:1',
      'Habakkuk moves through complaints and divine answers before concluding in prayer.',
      'book_baseline',
      73,
      69,
      468
    ),
    (
      'ZEP',
      'foundation_v1|ZEP|josiah_reign',
      'During whose reign does Zephaniah locate his prophetic ministry?',
      'B',
      'Hezekiah',
      'Josiah',
      'Jehoiakim',
      'Manasseh',
      'events_timeline',
      'Zeph 1:1',
      'Zephaniah dates his ministry to the reign of Josiah king of Judah.',
      'book_baseline',
      66,
      58,
      470
    ),
    (
      'HAG',
      'foundation_v1|HAG|temple_work',
      'What unfinished work does Haggai urge the returned exiles to resume?',
      'C',
      'Rebuilding Jerusalem''s defensive wall',
      'Restoring the royal palace of David',
      'Rebuilding the temple of the LORD',
      'Reopening the northern shrines at Bethel and Dan',
      'events_timeline',
      'Hag 1:2-8, 14',
      'Haggai calls the returned community to resume rebuilding the temple.',
      'book_baseline',
      82,
      73,
      432
    ),
    (
      'ZEC',
      'foundation_v1|ZEC|jerusalem_temple_setting',
      'Zechariah addresses a returned community centered on which city and project?',
      'A',
      'Jerusalem and the rebuilding of the temple',
      'Samaria and the rebuilding of its walls',
      'Nineveh and the rebuilding of its palace',
      'Hebron and the restoration of the monarchy',
      'geography_nations',
      'Zech 1:12-17; 4:6-10; 8:3',
      'Zechariah encourages the returned community in Jerusalem during the temple''s rebuilding.',
      'book_baseline',
      80,
      72,
      458
    ),
    (
      'MAL',
      'foundation_v1|MAL|covenant_worship_failure',
      'Which failure repeatedly concerns Malachi?',
      'D',
      'Building a golden calf during the wilderness journey',
      'Establishing rival royal capitals after Solomon''s death',
      'Refusing to leave Babylon when Cyrus permits the return',
      'Offering corrupt sacrifices and acting faithlessly within the covenant',
      'law_commands',
      'Mal 1:6-14; 2:10-16; 3:6-12',
      'Malachi confronts corrupt worship and covenant faithlessness in the restored community.',
      'book_baseline',
      77,
      70,
      465
    ),
    (
      'GEN',
      'foundation_v1|GEN|abram_enters_canaan',
      'After leaving Haran, which land does Abram enter?',
      'C',
      'Egypt',
      'Edom',
      'Canaan',
      'Moab',
      'geography_nations',
      'Gen 12:4-7',
      'Abram travels from Haran into Canaan in response to the LORD''s call.',
      'geography_foundation',
      82,
      76,
      420
    ),
    (
      'EXO',
      'foundation_v1|EXO|depart_egypt',
      'From which land does Israel depart in the exodus?',
      'A',
      'Egypt',
      'Canaan',
      'Babylon',
      'Assyria',
      'geography_nations',
      'Exod 12:31-42',
      'The exodus is Israel''s departure from slavery in Egypt.',
      'geography_foundation',
      94,
      92,
      405
    ),
    (
      'NUM',
      'foundation_v1|NUM|journey_destination',
      'Toward which land is Israel traveling through the wilderness in Numbers?',
      'D',
      'Egypt',
      'Edom',
      'Babylon',
      'Canaan',
      'geography_nations',
      'Num 13:1-2; 14:26-35',
      'Israel journeys toward Canaan, though rebellion delays entry.',
      'geography_foundation',
      88,
      84,
      418
    ),
    (
      'DEU',
      'foundation_v1|DEU|plains_of_moab',
      'Where is Israel camped while Moses gives the speeches of Deuteronomy?',
      'B',
      'At Mount Carmel above the Jezreel Valley',
      'On the plains of Moab east of the Jordan',
      'Inside Jerusalem beside the temple',
      'Along the Philistine coastal plain',
      'geography_nations',
      'Deut 1:1-5; 34:1-8',
      'Moses addresses Israel on the plains of Moab before the people cross the Jordan.',
      'geography_foundation',
      84,
      78,
      454
    ),
    (
      'JOS',
      'foundation_v1|JOS|cross_jordan',
      'Which river does Israel cross when entering the promised land under Joshua?',
      'C',
      'The Nile',
      'The Euphrates',
      'The Jordan',
      'The Arnon',
      'geography_nations',
      'Josh 3:14-17',
      'Israel crosses the Jordan River on dry ground to enter the land.',
      'geography_foundation',
      90,
      86,
      415
    ),
    (
      'JDG',
      'foundation_v1|JDG|tribal_canaan_setting',
      'In what land do the tribal conflicts and deliverances of Judges chiefly occur?',
      'A',
      'Canaan',
      'Egypt',
      'Babylonia',
      'Persia',
      'geography_nations',
      'Judg 2:6-23',
      'Judges takes place among Israel''s tribal territories in Canaan.',
      'geography_foundation',
      79,
      72,
      435
    ),
    (
      'RUT',
      'foundation_v1|RUT|moab_to_bethlehem',
      'From which neighboring land does Ruth come to Bethlehem with Naomi?',
      'D',
      'Edom',
      'Ammon',
      'Aram',
      'Moab',
      'geography_nations',
      'Ruth 1:1-22',
      'Ruth is a Moabite who travels with Naomi from Moab to Bethlehem.',
      'geography_foundation',
      82,
      76,
      430
    ),
    (
      '1SA',
      'foundation_v1|1SA|shiloh_sanctuary',
      'At which place is the sanctuary located when 1 Samuel opens?',
      'B',
      'Jerusalem',
      'Shiloh',
      'Hebron',
      'Bethel',
      'geography_nations',
      '1 Sam 1:3, 9, 24',
      'Elkanah''s family goes to worship at the sanctuary in Shiloh.',
      'geography_foundation',
      72,
      65,
      468
    ),
    (
      '2SA',
      'foundation_v1|2SA|david_capital',
      'Which city does David capture and establish as his capital?',
      'C',
      'Samaria',
      'Shiloh',
      'Jerusalem',
      'Bethel',
      'geography_nations',
      '2 Sam 5:6-10',
      'David captures Jerusalem and makes it the political center of his kingdom.',
      'geography_foundation',
      89,
      84,
      425
    ),
    (
      '1KI',
      'foundation_v1|1KI|temple_city',
      'In which city does Solomon build the temple of the LORD?',
      'A',
      'Jerusalem',
      'Samaria',
      'Bethel',
      'Shechem',
      'geography_nations',
      '1 Kgs 6:1, 37-38; 8:1',
      'Solomon builds and dedicates the temple in Jerusalem.',
      'geography_foundation',
      92,
      88,
      410
    ),
    (
      '2KI',
      'foundation_v1|2KI|northern_capital',
      'Which capital of the northern kingdom is conquered by Assyria in 2 Kings?',
      'D',
      'Jerusalem',
      'Damascus',
      'Lachish',
      'Samaria',
      'geography_nations',
      '2 Kgs 17:5-6',
      'Assyria captures Samaria and exiles the northern kingdom.',
      'geography_foundation',
      86,
      82,
      445
    ),
    (
      'EZR',
      'foundation_v1|EZR|restored_temple_city',
      'To which city do the returning exiles travel to rebuild the temple?',
      'B',
      'Samaria',
      'Jerusalem',
      'Susa',
      'Babylon',
      'geography_nations',
      'Ezra 1:2-5; 3:1-3',
      'The returned exiles travel to Jerusalem to rebuild the temple.',
      'geography_foundation',
      85,
      80,
      428
    ),
    (
      'NEH',
      'foundation_v1|NEH|rebuilt_walls_city',
      'Which city''s walls does Nehemiah lead the returned community to rebuild?',
      'C',
      'Jericho',
      'Hebron',
      'Jerusalem',
      'Samaria',
      'geography_nations',
      'Neh 2:11-20; 6:15',
      'Nehemiah leads the rebuilding of Jerusalem''s walls.',
      'geography_foundation',
      84,
      78,
      420
    ),
    (
      'EZE',
      'foundation_v1|EZE|babylonian_exiles',
      'Ezekiel receives his opening visions among exiles living in which empire?',
      'A',
      'Babylon',
      'Assyria',
      'Persia',
      'Egypt',
      'geography_nations',
      'Ezek 1:1-3',
      'Ezekiel prophesies among Judean exiles in Babylon.',
      'geography_foundation',
      82,
      77,
      445
    )
),
inserted as (
  insert into public.ot_generated_questions (
    event_id,
    question_type,
    payload,
    dedupe_key
  )
  select
    null,
    'foundation_mcq_v1',
    jsonb_build_object(
      'prompt', seed.prompt,
      'choices', jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', seed.choice_a),
        jsonb_build_object('id', 'B', 'text', seed.choice_b),
        jsonb_build_object('id', 'C', 'text', seed.choice_c),
        jsonb_build_object('id', 'D', 'text', seed.choice_d)
      ),
      'correct_choice_id', seed.correct_id,
      'correct_answer', case seed.correct_id
        when 'A' then seed.choice_a
        when 'B' then seed.choice_b
        when 'C' then seed.choice_c
        else seed.choice_d
      end,
      'book_code', seed.book_code,
      'dimension_key', seed.dimension_key,
      'question_family', seed.question_family,
      'stem_family', seed.dedupe_key,
      'assessment_role', 'baseline',
      'baseline_eligible', true,
      'retest_stage', 'foundation',
      'difficulty_estimate', seed.difficulty_estimate,
      'irt_a', 1.0,
      'irt_b', -0.85,
      'importance_context', seed.importance_context,
      'importance_conceptual', seed.importance_conceptual,
      'routing_score', round(
        (
          seed.importance_context * 0.30
          + seed.importance_conceptual * 0.70
        )::numeric,
        0
      ),
      'exact_chapter_recall_required', false,
      'source_ref', seed.source_ref,
      'explanation', seed.explanation,
      'distractor_review', 'same_category_manual',
      'content_version', '20260729_foundation_geography_v1'
    ),
    seed.dedupe_key
  from seed
  on conflict (question_type, dedupe_key) do nothing
  returning id
)
select count(*) from inserted;

update public.ot_generated_questions
set payload =
  jsonb_set(
    jsonb_set(
      payload,
      '{choices}',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'A',
          'text', 'Edom corrupted justice by taking bribes from the poor'
        ),
        jsonb_build_object(
          'id', 'B',
          'text', 'Edom profaned the temple by installing foreign idols'
        ),
        jsonb_build_object(
          'id', 'C',
          'text', 'Edom trusted its mountain strongholds and gloated over Judah''s fall'
        ),
        jsonb_build_object(
          'id', 'D',
          'text', 'Edom broke the Sabbath by trading at Jerusalem''s gates'
        )
      )
    ),
    '{distractor_review}',
    '"same_category_manual"'::jsonb
  )
where id = 'de9bf7df-e1ff-47cd-acc1-7eb61e665a21'::uuid;

update public.ot_generated_questions
set payload =
  jsonb_set(
    jsonb_set(
      payload,
      '{choices}',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'A',
          'text', 'Daniel, Shadrach, and Meshach'
        ),
        jsonb_build_object(
          'id', 'B',
          'text', 'Shadrach, Meshach, and Abednego'
        ),
        jsonb_build_object(
          'id', 'C',
          'text', 'Shadrach, Daniel, and Abednego'
        ),
        jsonb_build_object(
          'id', 'D',
          'text', 'Meshach, Abednego, and Daniel'
        )
      )
    ),
    '{distractor_review}',
    '"same_category_manual"'::jsonb
  )
where id = '75c06208-9252-49bd-903d-aafc86cbcd7f'::uuid;

update public.ot_generated_questions
set payload =
  jsonb_set(
    jsonb_set(
      payload,
      '{choices}',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'A',
          'text', 'From visions interpreted for foreign kings to Daniel''s personal memoirs'
        ),
        jsonb_build_object(
          'id', 'B',
          'text', 'From Babylonian court stories to a history of the Persian kings'
        ),
        jsonb_build_object(
          'id', 'C',
          'text', 'From stories about faithful exiles to prophecies only about Jerusalem''s fall'
        ),
        jsonb_build_object(
          'id', 'D',
          'text', 'From court narratives to apocalyptic visions'
        )
      )
    ),
    '{distractor_review}',
    '"same_category_manual"'::jsonb
  )
where id = '3edc4423-6d92-47be-9417-91493ad34766'::uuid;

create or replace view public.obs_question_distractor_quality_audit
with (security_invoker = true)
as
with questions as (
  select
    question.generated_question_id,
    question.book_code,
    question.dimension_key,
    question.question_type,
    question.prompt,
    question.payload->>'correct_choice_id' as correct_choice_id,
    question.payload->'choices' as choices
  from public.obs_question_bank_with_dimensions question
  where jsonb_typeof(question.payload->'choices') = 'array'
),
options as (
  select
    question.*,
    choice->>'id' as choice_id,
    btrim(choice->>'text') as choice_text,
    length(btrim(choice->>'text')) as choice_length,
    btrim(choice->>'text') ~ '^[0-9]+([ .,:;-]|$)'
      as begins_numeric
  from questions question
  cross join lateral jsonb_array_elements(question.choices) choice
),
stats as (
  select
    generated_question_id,
    book_code,
    dimension_key,
    question_type,
    prompt,
    correct_choice_id,
    count(*)::integer as option_count,
    count(distinct lower(choice_text))::integer
      as distinct_option_count,
    count(*) filter (
      where choice_id = correct_choice_id
    )::integer as correct_choice_matches,
    max(choice_length) filter (
      where choice_id = correct_choice_id
    )::integer as correct_choice_length,
    avg(choice_length) filter (
      where choice_id <> correct_choice_id
    ) as distractor_average_length,
    bool_or(begins_numeric) filter (
      where choice_id = correct_choice_id
    ) as correct_begins_numeric,
    bool_or(begins_numeric) filter (
      where choice_id <> correct_choice_id
    ) as any_distractor_begins_numeric,
    bool_and(begins_numeric) filter (
      where choice_id <> correct_choice_id
    ) as all_distractors_begin_numeric,
    bool_or(
      lower(choice_text) in (
        'all of the above',
        'none of the above'
      )
    ) as has_meta_choice
  from options
  group by
    generated_question_id,
    book_code,
    dimension_key,
    question_type,
    prompt,
    correct_choice_id
)
select
  stats.*,
  stats.option_count <> 4 as option_count_flag,
  stats.distinct_option_count <> stats.option_count
    as duplicate_choice_flag,
  stats.correct_choice_matches <> 1 as answer_key_flag,
  (
    stats.correct_choice_length
      >= stats.distractor_average_length * 1.8
    and stats.correct_choice_length
      - stats.distractor_average_length >= 12
  ) as correct_answer_long_flag,
  (
    stats.correct_choice_length * 1.8
      <= stats.distractor_average_length
    and stats.distractor_average_length
      - stats.correct_choice_length >= 12
  ) as correct_answer_short_flag,
  (
    (
      stats.correct_begins_numeric
      and not stats.all_distractors_begin_numeric
    )
    or (
      not stats.correct_begins_numeric
      and stats.any_distractor_begins_numeric
    )
  ) as numeric_type_mismatch_flag,
  stats.has_meta_choice as meta_choice_flag,
  (
    stats.option_count <> 4
    or stats.distinct_option_count <> stats.option_count
    or stats.correct_choice_matches <> 1
    or (
      stats.correct_choice_length
        >= stats.distractor_average_length * 1.8
      and stats.correct_choice_length
        - stats.distractor_average_length >= 12
    )
    or (
      stats.correct_choice_length * 1.8
        <= stats.distractor_average_length
      and stats.distractor_average_length
        - stats.correct_choice_length >= 12
    )
    or (
      (
        stats.correct_begins_numeric
        and not stats.all_distractors_begin_numeric
      )
      or (
        not stats.correct_begins_numeric
        and stats.any_distractor_begins_numeric
      )
    )
    or stats.has_meta_choice
  ) as requires_review
from stats;

revoke all on table public.obs_question_distractor_quality_audit
  from public, anon, authenticated;
grant select on table public.obs_question_distractor_quality_audit
  to service_role;

do $$
declare
  seeded_count integer;
  stage_one_count integer;
  geography_count integer;
  repaired_count integer;
  structurally_flagged integer;
  correct_position_min integer;
  correct_position_max integer;
begin
  select
    count(*),
    count(*) filter (
      where public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          null::double precision
        )
      ) = 1
    ),
    count(*) filter (
      where question.payload->>'dimension_key'
        = 'geography_nations'
    )
  into seeded_count, stage_one_count, geography_count
  from public.ot_generated_questions question
  where question.question_type = 'foundation_mcq_v1'
    and question.dedupe_key like 'foundation_v1|%';

  select count(*)
  into repaired_count
  from public.ot_generated_questions
  where id in (
    'de9bf7df-e1ff-47cd-acc1-7eb61e665a21'::uuid,
    '75c06208-9252-49bd-903d-aafc86cbcd7f'::uuid,
    '3edc4423-6d92-47be-9417-91493ad34766'::uuid
  )
    and payload->>'distractor_review' = 'same_category_manual';

  select count(*)
  into structurally_flagged
  from public.obs_question_distractor_quality_audit audit
  join public.ot_generated_questions question
    on question.id = audit.generated_question_id
  where question.question_type = 'foundation_mcq_v1'
    and question.dedupe_key like 'foundation_v1|%'
    and (
      audit.option_count_flag
      or audit.duplicate_choice_flag
      or audit.answer_key_flag
      or audit.correct_answer_long_flag
      or audit.correct_answer_short_flag
      or audit.numeric_type_mismatch_flag
      or audit.meta_choice_flag
    );

  select min(position_count), max(position_count)
  into correct_position_min, correct_position_max
  from (
    select
      payload->>'correct_choice_id' as choice_id,
      count(*)::integer as position_count
    from public.ot_generated_questions
    where question_type = 'foundation_mcq_v1'
      and dedupe_key like 'foundation_v1|%'
    group by payload->>'correct_choice_id'
  ) positions;

  if seeded_count <> 26
     or stage_one_count <> 26
     or geography_count <> 21
     or repaired_count <> 3
     or structurally_flagged <> 0
     or correct_position_max - correct_position_min > 1
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Question quality verification failed: seeded=%s stage1=%s geography=%s repaired=%s flagged=%s positions=%s-%s.',
        seeded_count,
        stage_one_count,
        geography_count,
        repaired_count,
        structurally_flagged,
        correct_position_min,
        correct_position_max
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
