-- Repair Torah focused-retest coverage outside Genesis.
--
-- This migration:
--   * teaches chapter inference to use explicit payload chapter/reference data;
--   * gives Exodus 21-40 a genuine foundation/core/detail progression;
--   * corrects four high-confidence dimension labels;
--   * quarantines five questions that test NT interpretation in the OT BLI;
--   * adds 21 MCQs and four ordering questions to the thinnest Torah units.

begin;

do $$
declare
  event_type_unique_indexes integer;
begin
  if to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_question_dimension_overrides') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
     or to_regprocedure(
       'public.obs_infer_question_chapter(text,text,jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Torah coverage preflight failed; required contracts are missing.';
  end if;

  select count(*)::integer
  into event_type_unique_indexes
  from pg_indexes index_info
  where index_info.schemaname = 'public'
    and index_info.tablename = 'ot_generated_questions'
    and index_info.indexdef ilike 'create unique index%'
    and index_info.indexdef ~ '\(event_id, question_type\)';

  if event_type_unique_indexes <> 0 then
    raise exception using
      errcode = 'P0001',
      message =
        'Torah coverage preflight failed; obsolete event/type uniqueness is active.';
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
  '20260726_torah_question_coverage',
  'public',
  'obs_infer_question_chapter',
  'function',
  pg_get_functiondef(
    'public.obs_infer_question_chapter(text,text,jsonb,text)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_infer_question_chapter'
    and backup.object_type = 'function'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_torah_question_coverage',
  'public',
  'ot_generated_questions_torah_curation',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'id', question.id,
      'question_type', question.question_type,
      'dedupe_key', question.dedupe_key,
      'payload', question.payload
    )
    order by question.id
  )::text
from public.ot_generated_questions question
where question.dedupe_key in (
  'batch1|EXO|tabernacle_purpose',
  'batch1|EXO|golden_calf_failure',
  'batch1|EXO|glory_fills_tabernacle',
  'batch2|EXO|covenant_blood',
  'batch2|EXO|covenant_renewal_glory',
  'batch12|EXO|book_covenant_after_decalogue',
  'batch12|EXO|consecrate_priests',
  'significance|NUM|94c21f4f-q3',
  'significance_mcq_v1|DEU|6|greatest_commandment',
  'significance_mcq_v1|DEU|21|cursed_tree',
  'significance_mcq_v1|LEV|1|blood_atonement',
  'significance_mcq_v1|LEV|19|be_holy',
  'significance_mcq_v1|NUM|21|serpent_john3'
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name = 'ot_generated_questions_torah_curation'
    and backup.object_type = 'data'
);

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_torah_question_coverage',
  'public',
  'obs_question_dimension_overrides_torah_curation',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'generated_question_id', question.id,
      'had_override', override.generated_question_id is not null,
      'dimension_key', override.dimension_key,
      'review_reason', override.review_reason,
      'updated_at', override.updated_at,
      'updated_by', override.updated_by
    )
    order by question.id
  )::text
from public.ot_generated_questions question
left join public.obs_question_dimension_overrides override
  on override.generated_question_id = question.id
where question.dedupe_key in (
  'batch10|LEV|lev_love_neighbor',
  'batch4|LEV|holiness_refrain',
  'primary_mcq_v2|NUM|3|levites_firstborn_redemption',
  'primary_mcq_v2|NUM|6|nazirite'
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name =
      'obs_question_dimension_overrides_torah_curation'
    and backup.object_type = 'data'
);

do $$
declare
  function_backups integer;
  data_backups integer;
  question_backup_rows integer;
  override_backup_rows integer;
begin
  select
    count(*) filter (where object_type = 'function')::integer,
    count(*) filter (where object_type = 'data')::integer
  into function_backups, data_backups
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public';

  select jsonb_array_length(backup.definition::jsonb)
  into question_backup_rows
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name = 'ot_generated_questions_torah_curation'
    and backup.object_type = 'data';

  select jsonb_array_length(backup.definition::jsonb)
  into override_backup_rows
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_torah_question_coverage'
    and backup.object_schema = 'public'
    and backup.object_name =
      'obs_question_dimension_overrides_torah_curation'
    and backup.object_type = 'data';

  if function_backups <> 1
     or data_backups <> 2
     or question_backup_rows <> 13
     or override_backup_rows <> 4
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Torah coverage backup failed: functions=%s/1 data=%s/2 questions=%s/13 overrides=%s/4.',
        function_backups,
        data_backups,
        coalesce(question_backup_rows, 0),
        coalesce(override_backup_rows, 0)
      );
  end if;
end
$$;

create or replace function public.obs_infer_question_chapter(
  p_book_code text,
  p_prompt text,
  p_payload jsonb,
  p_dedupe_key text
)
returns integer
language plpgsql
stable
as $$
declare
  chapter_match text[];
  dedupe_parts text[];
  book_pos integer;
  ref_pattern text;
  source_ref text;
  prompt_text text;
  explicit_chapter text;
begin
  if p_book_code is null then
    return null;
  end if;

  explicit_chapter := coalesce(
    p_payload->>'chapter',
    p_payload->>'start_chapter',
    ''
  );

  if explicit_chapter ~ '^[0-9]{1,3}$' then
    return explicit_chapter::integer;
  end if;

  ref_pattern := public.obs_book_ref_pattern(p_book_code);
  source_ref := coalesce(
    p_payload->>'source_ref',
    p_payload->>'source_reference',
    p_payload->>'reference',
    p_payload->>'passage_reference',
    ''
  );
  prompt_text := coalesce(p_payload->>'prompt', p_prompt, '');

  chapter_match := regexp_match(
    source_ref,
    ('\m' || ref_pattern || '\.?\s+([0-9]{1,3})(?::[0-9]{1,3})?'),
    'i'
  );
  if chapter_match is not null then
    return chapter_match[2]::integer;
  end if;

  dedupe_parts := string_to_array(coalesce(p_dedupe_key, ''), '|');
  book_pos := array_position(dedupe_parts, upper(p_book_code));
  if book_pos is not null
     and array_length(dedupe_parts, 1) >= book_pos + 1
     and dedupe_parts[book_pos + 1] ~ '^[0-9]{1,3}$'
  then
    return dedupe_parts[book_pos + 1]::integer;
  end if;

  chapter_match := regexp_match(
    prompt_text,
    ('\m' || ref_pattern || '\.?\s+([0-9]{1,3})(?::[0-9]{1,3})?'),
    'i'
  );
  if chapter_match is not null then
    return chapter_match[2]::integer;
  end if;

  return null;
end;
$$;

-- Turn the existing second half of Exodus into a real progression.
update public.ot_generated_questions question
set payload =
  question.payload
  || jsonb_strip_nulls(
    jsonb_build_object(
      'chapter', curated.chapter,
      'retest_stage', curated.retest_stage
    )
  )
from (
  values
    ('batch1|EXO|tabernacle_purpose', 25, 'foundation'),
    ('batch1|EXO|golden_calf_failure', 32, 'foundation'),
    ('batch1|EXO|glory_fills_tabernacle', 40, 'core'),
    ('batch2|EXO|covenant_blood', 24, 'core'),
    ('batch2|EXO|covenant_renewal_glory', 33, 'core'),
    ('batch12|EXO|book_covenant_after_decalogue', 21, 'core'),
    ('batch12|EXO|consecrate_priests', 29, 'core'),
    ('significance|NUM|94c21f4f-q3', 14, 'detail')
) curated(dedupe_key, chapter, retest_stage)
where question.dedupe_key = curated.dedupe_key
  and question.question_type not like 'quarantined%';

insert into public.obs_question_dimension_overrides (
  generated_question_id,
  dimension_key,
  review_reason,
  updated_at,
  updated_by
)
select
  question.id,
  'law_commands',
  '20260726 Torah review: this item tests an explicit command or assigned ritual duty.',
  now(),
  null
from public.ot_generated_questions question
where question.dedupe_key in (
  'batch10|LEV|lev_love_neighbor',
  'batch4|LEV|holiness_refrain',
  'primary_mcq_v2|NUM|3|levites_firstborn_redemption',
  'primary_mcq_v2|NUM|6|nazirite'
)
on conflict (generated_question_id) do update set
  dimension_key = excluded.dimension_key,
  review_reason = excluded.review_reason,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

-- These items require NT interpretation and therefore do not measure the OT
-- knowledge construct on their own.
update public.ot_generated_questions question
set
  question_type = case
    when question.question_type like 'quarantined%'
      then question.question_type
    else 'quarantined_' || question.question_type
  end,
  dedupe_key =
    'quarantined|'
    || question.id::text
    || '|'
    || question.dedupe_key,
  payload = question.payload || jsonb_build_object(
    'quarantine_reason',
    'Cross-testament interpretation is outside the OT-only BLI construct.'
  )
where question.dedupe_key in (
  'significance_mcq_v1|DEU|6|greatest_commandment',
  'significance_mcq_v1|DEU|21|cursed_tree',
  'significance_mcq_v1|LEV|1|blood_atonement',
  'significance_mcq_v1|LEV|19|be_holy',
  'significance_mcq_v1|NUM|21|serpent_john3'
)
  and question.question_type not like 'quarantined%';

with seed (
  book_code,
  chapter,
  dedupe_key,
  prompt,
  reference,
  explanation,
  choice_a,
  choice_b,
  choice_c,
  choice_d,
  correct_choice_id,
  dimension_key,
  retest_stage,
  importance_conceptual,
  importance_context,
  difficulty_estimate,
  irt_b
) as (
  values
    (
      'LEV', 2, 'torah_gap|LEV|2|grain_offering_materials',
      'Which offering in Leviticus is presented primarily from fine flour, oil, and frankincense rather than from an animal?',
      'Leviticus 2:1-3',
      'The grain offering is made from fine flour with oil and frankincense, and a memorial portion is burned on the altar.',
      'The burnt offering',
      'The grain offering',
      'The guilt offering',
      'The peace offering',
      'B', 'law_commands', 'detail', 66, 72, 610, 0.90
    ),
    (
      'LEV', 4, 'torah_gap|LEV|4|unintentional_violation',
      'What kind of violation does Leviticus 4 repeatedly address with the purification offering often called the sin offering?',
      'Leviticus 4:1-3, 13-14, 22-23, 27-28',
      'Leviticus 4 repeatedly describes someone sinning unintentionally against one of the Lord''s commands.',
      'Unintentional violation of a command',
      'Refusal to celebrate the Jubilee',
      'Deliberate worship of another god',
      'Failure to defeat a foreign army',
      'A', 'law_commands', 'detail', 76, 80, 630, 1.00
    ),
    (
      'LEV', 6, 'torah_gap|LEV|6|altar_fire_continual',
      'What must the priests do with the fire on the altar according to Leviticus 6?',
      'Leviticus 6:12-13',
      'The fire on the altar is to be kept burning continually and must not go out.',
      'Extinguish it after every morning offering',
      'Move it outside the camp each Sabbath',
      'Keep it burning continually',
      'Use it only on the Day of Atonement',
      'C', 'law_commands', 'detail', 65, 70, 620, 0.95
    ),
    (
      'LEV', 10, 'torah_gap|LEV|10|priestly_distinctions',
      'After the judgment of Nadab and Abihu, what distinction are the priests specifically charged to teach Israel?',
      'Leviticus 10:8-11',
      'The priests must distinguish holy from common and unclean from clean, and teach the Lord''s statutes.',
      'The distinction between northern and southern tribes',
      'The distinction between kings and judges',
      'The distinction between holy and common, and clean and unclean',
      'The distinction between Hebrew and foreign languages',
      'C', 'law_commands', 'detail', 86, 86, 650, 1.10
    ),
    (
      'LEV', 11, 'torah_gap|LEV|11|clean_land_animals',
      'What two traits must a land animal have to be classified as clean for Israel in Leviticus 11?',
      'Leviticus 11:2-8',
      'A clean land animal must both have a divided hoof and chew the cud.',
      'It must have horns and live in a herd',
      'It must divide the hoof and chew the cud',
      'It must be domesticated and eat grass',
      'It must be male and more than one year old',
      'B', 'law_commands', 'detail', 72, 78, 640, 1.05
    ),
    (
      'LEV', 16, 'torah_gap|LEV|16|aaron_first_atonement',
      'Before making atonement for the people on the Day of Atonement, for whom must Aaron first make atonement?',
      'Leviticus 16:6, 11',
      'Aaron first offers the bull for himself and his household before making atonement for the people.',
      'For Pharaoh and Egypt',
      'For himself and his household',
      'For the tribal leaders only',
      'For Moses and Joshua',
      'B', 'theological_reasoning', 'detail', 88, 90, 660, 1.15
    ),
    (
      'LEV', 17, 'torah_gap|LEV|17|holiness_code_overview',
      'Which summary best describes the main movement of Leviticus 17-27?',
      'Leviticus 17-27',
      'The closing part of Leviticus applies holiness to worship, community life, priests, sacred time, land, and covenant obedience.',
      'A second account of Israel leaving Egypt',
      'Instructions for holy worship, community life, sacred time, and covenant obedience',
      'A census and military organization of every tribe',
      'Speeches preparing Israel to cross the Jordan',
      'B', 'theological_reasoning', 'foundation', 86, 88, 430, -0.70
    ),
    (
      'LEV', 17, 'torah_gap|LEV|17|blood_life_atonement',
      'Why does Leviticus 17 forbid Israel from eating blood?',
      'Leviticus 17:10-12',
      'The life of the flesh is in the blood, and God has given it on the altar to make atonement.',
      'Blood belonged exclusively to Israel''s kings',
      'Blood could be stored only inside the ark',
      'The life of the flesh is in the blood, which God gave for atonement',
      'Blood was reserved as a drink for the priests',
      'C', 'theological_reasoning', 'detail', 94, 92, 650, 1.10
    ),
    (
      'LEV', 19, 'torah_gap|LEV|19|gleaning_for_vulnerable',
      'When Israel harvested fields and vineyards, what portion was to be left for the poor and the resident foreigner?',
      'Leviticus 19:9-10',
      'The edges and gleanings were not to be gathered completely but left for the poor and the resident foreigner.',
      'Only the first sheaf from every field',
      'The edges and remaining gleanings',
      'Exactly half of every harvest',
      'Only fruit that fell on the Sabbath',
      'B', 'law_commands', 'detail', 82, 84, 620, 0.95
    ),
    (
      'LEV', 19, 'torah_gap|LEV|19|honest_measures',
      'What does Leviticus 19 require in commercial measurements?',
      'Leviticus 19:35-36',
      'Israel must use honest scales, weights, and measures rather than cheating in trade.',
      'Different weights for Israelites and foreigners',
      'No buying or selling outside Jerusalem',
      'Honest scales, weights, and measures',
      'Payment for every purchase in silver only',
      'C', 'law_commands', 'detail', 72, 76, 610, 0.90
    ),
    (
      'LEV', 25, 'torah_gap|LEV|25|sabbath_year_jubilee',
      'How does the Jubilee differ from the regular sabbath year in Leviticus 25?',
      'Leviticus 25:1-17',
      'The land rests every seventh year, while Jubilee follows seven cycles of years and also proclaims release and return of property.',
      'Jubilee occurs every seventh year and has no land provisions',
      'The sabbath year applies only to priests, while Jubilee applies only to kings',
      'Jubilee follows seven sabbath-year cycles and adds release and return',
      'The sabbath year cancels worship, while Jubilee restores sacrifices',
      'C', 'law_commands', 'detail', 86, 88, 670, 1.25
    ),
    (
      'LEV', 26, 'torah_gap|LEV|26|confession_covenant_memory',
      'After describing covenant judgment, what hope does Leviticus 26 hold out if the people confess their iniquity?',
      'Leviticus 26:40-45',
      'God promises to remember his covenants and not utterly reject or destroy his people.',
      'God will erase the covenant with Abraham',
      'God will remember his covenants and not utterly reject them',
      'Israel will no longer need priests or sacrifices',
      'The nations will become responsible for Israel''s law',
      'B', 'promise_prophecy', 'detail', 90, 90, 660, 1.15
    ),
    (
      'NUM', 11, 'torah_gap|NUM|11|seventy_elders_spirit',
      'How does God provide help when Moses says the burden of leading the people is too heavy?',
      'Numbers 11:16-17, 24-25',
      'God places some of the Spirit resting on Moses upon seventy elders so that they can share the burden.',
      'He appoints seventy elders and places the Spirit on them',
      'He gives military authority to Korah',
      'He sends Moses back to Midian',
      'He makes Aaron the sole judge over Israel',
      'A', 'events_timeline', 'detail', 86, 88, 640, 1.05
    ),
    (
      'NUM', 12, 'torah_gap|NUM|12|miriam_discipline',
      'What happens to Miriam after she and Aaron speak against Moses in Numbers 12?',
      'Numbers 12:1-15',
      'Miriam becomes diseased and is shut outside the camp for seven days before the journey resumes.',
      'She is appointed to lead the seventy elders',
      'She becomes diseased and remains outside the camp for seven days',
      'She returns immediately to Egypt',
      'She is swallowed by the earth with Korah',
      'B', 'events_timeline', 'detail', 74, 80, 620, 0.95
    ),
    (
      'NUM', 19, 'torah_gap|NUM|19|red_heifer_water',
      'What is made from the ashes of the red heifer in Numbers 19?',
      'Numbers 19:1-13',
      'The ashes are combined with fresh water to prepare water used for purification from corpse impurity.',
      'Oil used to anoint a new high priest',
      'Incense burned inside the Most Holy Place',
      'Water used for purification from corpse impurity',
      'Ink used to record the census',
      'C', 'law_commands', 'detail', 68, 76, 650, 1.10
    ),
    (
      'NUM', 22, 'torah_gap|NUM|22|donkey_sees_angel',
      'What does Balaam''s donkey perceive before Balaam himself sees it?',
      'Numbers 22:22-35',
      'The donkey sees the angel of the Lord standing in the road with a drawn sword.',
      'The star coming out of Jacob',
      'The ark crossing the Jordan',
      'The angel of the Lord with a drawn sword',
      'The bronze serpent on a pole',
      'C', 'events_timeline', 'detail', 72, 80, 610, 0.90
    ),
    (
      'NUM', 24, 'torah_gap|NUM|24|star_scepter_oracle',
      'What royal images appear in Balaam''s oracle about a future ruler from Israel?',
      'Numbers 24:15-19',
      'Balaam speaks of a star coming from Jacob and a scepter rising from Israel.',
      'A ladder and a gate',
      'A star and a scepter',
      'A crown and a chariot',
      'A vine and a lampstand',
      'B', 'promise_prophecy', 'detail', 90, 88, 660, 1.15
    ),
    (
      'DEU', 8, 'torah_gap|DEU|8|manna_dependence',
      'According to Deuteronomy 8, what was Israel meant to learn from being humbled and fed with manna?',
      'Deuteronomy 8:2-3',
      'Israel was to learn that people do not live by bread alone but by every word from the Lord.',
      'That military strength guarantees possession of the land',
      'That people live by every word that comes from the Lord',
      'That manna would continue after settlement in Canaan',
      'That only priests may gather food in the wilderness',
      'B', 'theological_reasoning', 'detail', 94, 92, 650, 1.10
    ),
    (
      'DEU', 10, 'torah_gap|DEU|10|circumcise_heart',
      'What inward response does Moses demand when he tells Israel to circumcise their hearts?',
      'Deuteronomy 10:12-16',
      'Israel must no longer be stubborn but fear, love, serve, and obey the Lord.',
      'They must stop being stubborn and give wholehearted loyalty to the Lord',
      'They must choose a new tribal ancestry',
      'They must replace the covenant tablets',
      'They must avoid all contact with resident foreigners',
      'A', 'theological_reasoning', 'detail', 90, 90, 660, 1.15
    ),
    (
      'DEU', 24, 'torah_gap|DEU|24|harvest_for_vulnerable',
      'Who is meant to receive the forgotten sheaf and remaining olives and grapes in Deuteronomy 24?',
      'Deuteronomy 24:19-22',
      'These harvest remnants are left for the resident foreigner, the fatherless, and the widow.',
      'The king, the army, and foreign envoys',
      'Only the landowner''s extended family',
      'The resident foreigner, the fatherless, and the widow',
      'Only priests serving at the central sanctuary',
      'C', 'law_commands', 'detail', 82, 84, 620, 0.95
    ),
    (
      'DEU', 29, 'torah_gap|DEU|29|secret_revealed_things',
      'How does Deuteronomy 29 distinguish between secret things and revealed things?',
      'Deuteronomy 29:29',
      'Secret things belong to the Lord, while revealed things belong to Israel and their children so they may obey the law.',
      'Secret things belong to priests, while revealed things belong to kings',
      'Secret things belong to the Lord, while revealed things are given for covenant obedience',
      'Secret things concern worship, while revealed things concern warfare',
      'Secret things are forbidden, while revealed things may be ignored',
      'B', 'theological_reasoning', 'detail', 76, 82, 650, 1.10
    )
),
prepared as (
  select
    seed.*,
    case seed.correct_choice_id
      when 'A' then seed.choice_a
      when 'B' then seed.choice_b
      when 'C' then seed.choice_c
      when 'D' then seed.choice_d
    end as correct_answer,
    (
      select event.id
      from public.bible_events event
      where event.book_code = seed.book_code
        and event.start_chapter <= seed.chapter
        and event.end_chapter >= seed.chapter
      order by
        (event.end_chapter - event.start_chapter),
        event.start_chapter
      limit 1
    ) as event_id
  from seed
)
insert into public.ot_generated_questions (
  event_id,
  question_type,
  payload,
  dedupe_key
)
select
  prepared.event_id,
  'torah_coverage_mcq_v1',
  jsonb_build_object(
    'prompt', prepared.prompt,
    'book_code', prepared.book_code,
    'chapter', prepared.chapter,
    'reference', prepared.reference,
    'explanation', prepared.explanation,
    'choices', jsonb_build_array(
      jsonb_build_object('id', 'A', 'text', prepared.choice_a),
      jsonb_build_object('id', 'B', 'text', prepared.choice_b),
      jsonb_build_object('id', 'C', 'text', prepared.choice_c),
      jsonb_build_object('id', 'D', 'text', prepared.choice_d)
    ),
    'correct_choice_id', prepared.correct_choice_id,
    'correct_answer', prepared.correct_answer,
    'dimension_key', prepared.dimension_key,
    'question_layer', case
      when prepared.retest_stage = 'foundation' then '1'
      else '3'
    end,
    'question_format', 'multiple_choice',
    'question_family', 'torah_coverage',
    'knowledge_granularity', case
      when prepared.retest_stage = 'foundation' then 'unit_overview'
      else 'passage_detail'
    end,
    'retrieval_target', 'textual_knowledge',
    'exact_chapter_recall_required', false,
    'baseline_eligible', prepared.retest_stage = 'foundation',
    'source_batch', '20260726_torah_question_coverage',
    'stem_family', prepared.dedupe_key,
    'retest_stage', prepared.retest_stage,
    'importance_conceptual', prepared.importance_conceptual,
    'importance_context', prepared.importance_context,
    'difficulty_estimate', prepared.difficulty_estimate,
    'irt_a', 1.0,
    'irt_b', prepared.irt_b
  ),
  prepared.dedupe_key
from prepared
where (
    prepared.event_id is not null
    or prepared.dedupe_key = 'torah_gap|NUM|19|red_heifer_water'
  )
  and not exists (
    select 1
    from public.ot_generated_questions existing
    where existing.dedupe_key = prepared.dedupe_key
      and existing.question_type not like 'quarantined%'
  );

with sequence_seed (
  book_code,
  chapter,
  dedupe_key,
  prompt,
  reference,
  explanation,
  choices,
  correct_order,
  dimension_key,
  importance_conceptual,
  importance_context,
  difficulty_estimate,
  irt_b
) as (
  values
    (
      'LEV', 16, 'sequence|LEV|offerings_to_atonement',
      'Place these major movements in the first half of Leviticus in order.',
      'Leviticus 1-16',
      'Leviticus introduces the offerings, ordains Aaron and his sons, records the judgment of Nadab and Abihu, and then gives the Day of Atonement instructions.',
      jsonb_build_array(
        jsonb_build_object('id', 'nadab', 'text', 'Nadab and Abihu are judged'),
        jsonb_build_object('id', 'offerings', 'text', 'The principal offerings are introduced'),
        jsonb_build_object('id', 'atonement', 'text', 'Instructions are given for the Day of Atonement'),
        jsonb_build_object('id', 'ordination', 'text', 'Aaron and his sons are ordained')
      ),
      jsonb_build_array('offerings', 'ordination', 'nadab', 'atonement'),
      'events_timeline', 84, 86, 660, 1.15
    ),
    (
      'LEV', 23, 'sequence|LEV|appointed_festival_seasons',
      'Place these appointed festival seasons in their annual order.',
      'Leviticus 23',
      'Passover and Unleavened Bread come first, followed by Weeks, then Trumpets and the Day of Atonement, and finally Booths.',
      jsonb_build_array(
        jsonb_build_object('id', 'booths', 'text', 'The Festival of Booths'),
        jsonb_build_object('id', 'weeks', 'text', 'The Festival of Weeks'),
        jsonb_build_object('id', 'passover', 'text', 'Passover and Unleavened Bread'),
        jsonb_build_object('id', 'seventh_month', 'text', 'Trumpets and the Day of Atonement')
      ),
      jsonb_build_array('passover', 'weeks', 'seventh_month', 'booths'),
      'events_timeline', 74, 82, 680, 1.30
    ),
    (
      'NUM', 24, 'sequence|NUM|wilderness_rebellion_arc',
      'Place these major events from Israel''s wilderness journey in Numbers in order.',
      'Numbers 10-24',
      'Israel leaves Sinai, rejects the land after the spies return, experiences Korah''s rebellion, and later receives blessing through Balaam''s oracles.',
      jsonb_build_array(
        jsonb_build_object('id', 'korah', 'text', 'Korah leads a rebellion'),
        jsonb_build_object('id', 'sinai', 'text', 'Israel departs from Sinai'),
        jsonb_build_object('id', 'balaam', 'text', 'Balaam speaks blessings over Israel'),
        jsonb_build_object('id', 'spies', 'text', 'The spies return and Israel refuses to enter the land')
      ),
      jsonb_build_array('sinai', 'spies', 'korah', 'balaam'),
      'events_timeline', 92, 92, 660, 1.15
    ),
    (
      'DEU', 30, 'sequence|DEU|covenant_speech_movements',
      'Place these major movements in Moses'' covenant speeches in order.',
      'Deuteronomy 5-30',
      'Moses restates the Ten Commandments, gives the Shema, expounds covenant laws, and closes with blessings, curses, and the call to choose life.',
      jsonb_build_array(
        jsonb_build_object('id', 'laws', 'text', 'Covenant laws for life in the land are expounded'),
        jsonb_build_object('id', 'choice', 'text', 'Blessings and curses lead to the call to choose life'),
        jsonb_build_object('id', 'decalogue', 'text', 'The Ten Commandments are restated'),
        jsonb_build_object('id', 'shema', 'text', 'Israel hears the Shema and the command to love the Lord')
      ),
      jsonb_build_array('decalogue', 'shema', 'laws', 'choice'),
      'events_timeline', 90, 90, 670, 1.25
    )
),
prepared as (
  select
    seed.*,
    (
      select event.id
      from public.bible_events event
      where event.book_code = seed.book_code
        and event.start_chapter <= seed.chapter
        and event.end_chapter >= seed.chapter
      order by
        (event.end_chapter - event.start_chapter),
        event.start_chapter
      limit 1
    ) as event_id
  from sequence_seed seed
)
insert into public.ot_generated_questions (
  event_id,
  question_type,
  payload,
  dedupe_key
)
select
  prepared.event_id,
  'sequence_order_v1',
  jsonb_build_object(
    'prompt', prepared.prompt,
    'book_code', prepared.book_code,
    'chapter', prepared.chapter,
    'reference', prepared.reference,
    'explanation', prepared.explanation,
    'choices', prepared.choices,
    'correct_order', prepared.correct_order,
    'correct_choice_id', prepared.correct_order->>0,
    'correct_answer', (
      select string_agg(
        choice->>'text',
        ' -> '
        order by ordered.ordinality
      )
      from jsonb_array_elements_text(prepared.correct_order)
        with ordinality ordered(item_id, ordinality)
      join lateral (
        select item
        from jsonb_array_elements(prepared.choices) item
        where item->>'id' = ordered.item_id
        limit 1
      ) matched(choice) on true
    ),
    'dimension_key', prepared.dimension_key,
    'question_layer', '3',
    'question_format', 'sequence_order',
    'question_family', 'torah_textual_sequence',
    'knowledge_granularity', 'unit_synthesis',
    'retrieval_target', 'event_sequence',
    'exact_chapter_recall_required', false,
    'baseline_eligible', false,
    'source_batch', '20260726_torah_question_coverage',
    'stem_family', prepared.dedupe_key,
    'retest_stage', 'detail',
    'importance_conceptual', prepared.importance_conceptual,
    'importance_context', prepared.importance_context,
    'difficulty_estimate', prepared.difficulty_estimate,
    'irt_a', 1.0,
    'irt_b', prepared.irt_b
  ),
  prepared.dedupe_key
from prepared
where prepared.event_id is not null
  and not exists (
    select 1
    from public.ot_generated_questions existing
    where existing.dedupe_key = prepared.dedupe_key
      and existing.question_type not like 'quarantined%'
  );

do $$
declare
  inserted_count integer;
  mcq_count integer;
  sequence_count integer;
  quarantined_count integer;
  bad_metadata integer;
  still_unmapped_explicit_chapters integer;
  thin_units integer;
begin
  select
    count(*)::integer,
    count(*) filter (
      where question.question_type = 'torah_coverage_mcq_v1'
    )::integer,
    count(*) filter (
      where question.question_type = 'sequence_order_v1'
    )::integer
  into inserted_count, mcq_count, sequence_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
      '20260726_torah_question_coverage'
    and question.question_type not like 'quarantined%';

  select count(*)::integer
  into quarantined_count
  from public.ot_generated_questions question
  where question.payload->>'quarantine_reason' =
    'Cross-testament interpretation is outside the OT-only BLI construct.'
    and question.question_type like 'quarantined%';

  select count(*)::integer
  into bad_metadata
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' =
      '20260726_torah_question_coverage'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
      or audit.payload->>'retest_stage' not in ('foundation', 'detail')
    );

  select count(*)::integer
  into still_unmapped_explicit_chapters
  from public.obs_admin_question_bank_audit audit
  where audit.book_code in ('EXO', 'LEV', 'NUM', 'DEU')
    and audit.payload->>'chapter' ~ '^[0-9]{1,3}$'
    and audit.inferred_chapter is null;

  with stage_counts as (
    select
      question.unit_key,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      )) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 1
      ) as foundation_families,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      )) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 2
      ) as core_families,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      )) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 3
      ) as detail_families
    from public.obs_question_bank_with_units question
    left join public.bible_events event
      on event.id = question.event_id
    where question.unit_key in (
      'exo-1-20',
      'exo-21-40',
      'lev-1-16',
      'lev-17-27',
      'num-10-25',
      'deu-5-30'
    )
    group by question.unit_key
  )
  select count(*)::integer
  into thin_units
  from stage_counts
  where foundation_families < 2
     or core_families < 4
     or detail_families < 9;

  if inserted_count <> 25
     or mcq_count <> 21
     or sequence_count <> 4
     or quarantined_count <> 5
     or bad_metadata <> 0
     or still_unmapped_explicit_chapters <> 0
     or thin_units <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Torah coverage failed: inserted=%s/25 mcq=%s/21 sequence=%s/4 quarantined=%s/5 bad_metadata=%s unmapped_explicit=%s thin_units=%s.',
        inserted_count,
        mcq_count,
        sequence_count,
        quarantined_count,
        bad_metadata,
        still_unmapped_explicit_chapters,
        thin_units
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
