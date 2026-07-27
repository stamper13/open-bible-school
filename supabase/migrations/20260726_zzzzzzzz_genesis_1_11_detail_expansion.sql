-- Expand meaningful detail coverage for the Genesis 1-11 focused retest.

begin;

do $$
begin
  if to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Genesis detail expansion preflight failed; required contracts are missing.';
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
  '20260726_genesis_1_11_detail_expansion',
  index_info.schemaname,
  index_info.indexname,
  'index',
  index_info.indexdef || ';'
from pg_indexes index_info
where index_info.schemaname = 'public'
  and index_info.tablename = 'ot_generated_questions'
  and index_info.indexname =
    'ot_generated_questions_event_type_ux'
  and not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag =
        '20260726_genesis_1_11_detail_expansion'
      and backup.object_schema = index_info.schemaname
      and backup.object_name = index_info.indexname
      and backup.object_type = 'index'
  );

do $$
declare
  backup_count integer;
begin
  select count(*)::integer
  into backup_count
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_1_11_detail_expansion'
    and backup.object_schema = 'public'
    and backup.object_name =
      'ot_generated_questions_event_type_ux'
    and backup.object_type = 'index';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected one event/type unique-index backup, found %s.',
        backup_count
      );
  end if;
end
$$;

-- This legacy index enforced one question type per event. Question identity
-- and duplicate prevention now use dedupe_key and stem_family instead.
drop index if exists public.ot_generated_questions_event_type_ux;

with seed (
  dedupe_key,
  chapter,
  prompt,
  reference,
  explanation,
  choice_a,
  choice_b,
  choice_c,
  choice_d,
  correct_choice_id,
  dimension_key,
  importance_conceptual,
  importance_context,
  difficulty_estimate,
  irt_b
) as (
  values
    (
      'gen_detail|GEN|4|cain_mark_purpose',
      4,
      'After Cain fears that whoever finds him will kill him, why does the Lord place a mark on Cain?',
      'Genesis 4:13-15',
      'The mark protects Cain from being killed by anyone who finds him, even while his sentence of wandering remains.',
      'To identify him as the builder of the first city',
      'To prevent anyone who finds him from killing him',
      'To transfer his punishment to Seth',
      'To end his exile from the ground',
      'B',
      'theological_reasoning',
      82,
      80,
      620,
      0.95
    ),
    (
      'gen_detail|GEN|4|lamech_vengeance_boast',
      4,
      'What does Lamech boast to Adah and Zillah about violence and vengeance?',
      'Genesis 4:23-24',
      'Lamech boasts that he killed a man for wounding him and magnifies Cain''s sevenfold vengeance to seventy-sevenfold.',
      'He renounced vengeance and sought peace with Cain''s family',
      'He killed a man for wounding him and claimed seventy-sevenfold vengeance',
      'He avenged Abel by killing Cain',
      'He would build an ark to escape judgment',
      'B',
      'theological_reasoning',
      70,
      72,
      650,
      1.15
    ),
    (
      'gen_detail|GEN|6|earth_corruption_violence',
      6,
      'Immediately before the flood, how does Genesis describe the earth in God''s sight?',
      'Genesis 6:11-13',
      'The earth is described as corrupt and filled with violence, providing the stated setting for the flood judgment.',
      'Barren and unable to produce food',
      'Divided into rival languages',
      'Corrupt and filled with violence',
      'Ruled entirely by the descendants of Seth',
      'C',
      'theological_reasoning',
      92,
      90,
      600,
      0.85
    ),
    (
      'gen_detail|GEN|8|dove_olive_leaf',
      8,
      'What did the dove bring back to Noah as evidence that the floodwaters were receding?',
      'Genesis 8:10-11',
      'The dove returned with a freshly plucked olive leaf, showing Noah that the waters had subsided from the earth.',
      'A cluster of grapes',
      'A freshly plucked olive leaf',
      'A branch from a cedar tree',
      'A piece of dry ground',
      'B',
      'events_timeline',
      68,
      74,
      610,
      0.90
    ),
    (
      'gen_detail|GEN|9|food_blood_restriction',
      9,
      'After permitting Noah and his family to eat living creatures, what restriction does God add?',
      'Genesis 9:3-4',
      'Animal food is permitted, but flesh with its life, identified with its blood, is prohibited.',
      'They may eat only animals previously used for sacrifice',
      'They must not eat flesh with its lifeblood still in it',
      'They may eat meat only during annual festivals',
      'They must continue eating only plants',
      'B',
      'law_commands',
      88,
      86,
      630,
      1.00
    ),
    (
      'gen_detail|GEN|9|human_lifeblood_image',
      9,
      'What reason does Genesis 9 give for holding a killer accountable for shedding human blood?',
      'Genesis 9:5-6',
      'The command is grounded in humanity being made in the image of God.',
      'Human beings alone were placed inside Eden',
      'Noah had authority over every future nation',
      'God made humanity in his own image',
      'Cain had already founded the first city',
      'C',
      'theological_reasoning',
      94,
      90,
      650,
      1.10
    ),
    (
      'gen_detail|GEN|11|babel_stated_motive',
      11,
      'What two goals do the builders at Babel state for constructing their city and tower?',
      'Genesis 11:3-4',
      'They seek to make a name for themselves and prevent their community from being scattered over the earth.',
      'To worship at the mountain where the ark rested and preserve Noah''s altar',
      'To make a name for themselves and avoid being scattered',
      'To protect Abram from the kings of the east',
      'To replace farming with permanent trade routes',
      'B',
      'theological_reasoning',
      90,
      88,
      620,
      0.95
    ),
    (
      'gen_detail|GEN|11|terah_settles_haran',
      11,
      'After leaving Ur while intending to go toward Canaan, where does Terah''s household settle?',
      'Genesis 11:31-32',
      'Terah travels with Abram, Sarai, and Lot as far as Haran, where the household settles.',
      'Haran',
      'Bethel',
      'Shechem',
      'Hebron',
      'A',
      'geography_nations',
      68,
      76,
      660,
      1.20
    ),
    (
      'gen_detail|GEN|10|ham_father_canaan',
      10,
      'Which son of Noah is specifically identified as the father of Canaan?',
      'Genesis 9:18; 10:6',
      'Ham is identified as the father of Canaan in the transition from the flood narrative into the Table of Nations.',
      'Shem',
      'Ham',
      'Japheth',
      'Arpachshad',
      'B',
      'characters_lineage',
      76,
      80,
      640,
      1.05
    ),
    (
      'gen_detail|GEN|5|seth_line_to_noah',
      5,
      'Through which son of Adam does Genesis 5 trace the genealogy that leads to Noah?',
      'Genesis 5:3-32',
      'Genesis 5 traces the line from Adam through Seth and his descendants to Noah and his sons.',
      'Cain',
      'Abel',
      'Seth',
      'Enoch, the son of Cain',
      'C',
      'characters_lineage',
      82,
      82,
      620,
      0.95
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
      where event.book_code = 'GEN'
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
  'genesis_detail_mcq_v1',
  jsonb_build_object(
    'prompt', prepared.prompt,
    'book_code', 'GEN',
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
    'question_layer', '3',
    'question_format', 'multiple_choice',
    'question_family', 'genesis_textual_detail',
    'knowledge_granularity', 'passage_detail',
    'retrieval_target', 'textual_relationship',
    'exact_chapter_recall_required', false,
    'baseline_eligible', false,
    'source_batch', '20260726_genesis_1_11_detail_expansion',
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

with sequence_seed as (
  select
    'sequence|GEN|noah_bird_tests'::text as dedupe_key,
    8 as chapter,
    'Place Noah''s tests with the birds in the order they occur after the flood.'::text
      as prompt,
    'Genesis 8:6-12'::text as reference,
    'Noah first releases a raven. He then releases a dove that returns for lack of a resting place, later returns with an olive leaf, and finally does not return.'::text
      as explanation,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'dove_olive',
        'text', 'The dove returns with a freshly plucked olive leaf'
      ),
      jsonb_build_object(
        'id', 'raven',
        'text', 'Noah releases a raven'
      ),
      jsonb_build_object(
        'id', 'dove_no_return',
        'text', 'The dove does not return to Noah'
      ),
      jsonb_build_object(
        'id', 'dove_no_rest',
        'text', 'The dove returns because it finds no resting place'
      )
    ) as choices,
    jsonb_build_array(
      'raven',
      'dove_no_rest',
      'dove_olive',
      'dove_no_return'
    ) as correct_order
),
prepared as (
  select
    seed.*,
    (
      select event.id
      from public.bible_events event
      where event.book_code = 'GEN'
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
    'book_code', 'GEN',
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
    'dimension_key', 'events_timeline',
    'question_layer', '3',
    'question_format', 'sequence_order',
    'question_family', 'genesis_textual_sequence',
    'knowledge_granularity', 'passage_detail',
    'retrieval_target', 'event_sequence',
    'exact_chapter_recall_required', false,
    'baseline_eligible', false,
    'source_batch', '20260726_genesis_1_11_detail_expansion',
    'stem_family', prepared.dedupe_key,
    'retest_stage', 'detail',
    'importance_conceptual', 74,
    'importance_context', 80,
    'difficulty_estimate', 670,
    'irt_a', 1.0,
    'irt_b', 1.25
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
  detail_family_count integer;
  blocked_count integer;
begin
  select count(*)::integer
  into inserted_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
    '20260726_genesis_1_11_detail_expansion'
    and question.question_type not like 'quarantined%';

  select count(distinct coalesce(
    nullif(question.payload->>'stem_family', ''),
    question.generated_question_id::text
  ))::integer
  into detail_family_count
  from public.obs_question_bank_with_units question
  left join public.bible_events event
    on event.id = question.event_id
  where (
      question.unit_key = 'gen-1-11'
      or (
        question.book_code = 'GEN'
        and question.question_type = 'book_orientation_mcq_v1'
      )
    )
    and public.obs_focused_item_stage(
      question.question_type,
      question.payload,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      )
    ) = 3;

  select count(*)::integer
  into blocked_count
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' =
      '20260726_genesis_1_11_detail_expansion'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
    );

  if inserted_count <> 11
     or detail_family_count < 16
     or blocked_count <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Genesis detail expansion failed: inserted=%s/11 detail_families=%s/16 blockers=%s.',
        inserted_count,
        detail_family_count,
        blocked_count
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
