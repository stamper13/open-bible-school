begin;

with section_sort_seed (
  id,
  dedupe_key,
  testament,
  representative_book_code,
  section_key,
  prompt,
  labels,
  correct_assignments
) as (
  values
    (
      'd2e24aa6-12f8-4bc4-9c61-b6c66f8f28b2'::uuid,
      'book_section_sort|OT|torah_foundation_a',
      'OT',
      'GEN',
      'TORAH',
      'Drag each Old Testament book into its correct section.',
      array['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Psalms', 'Isaiah'],
      '{"Genesis":"TORAH","Exodus":"TORAH","Leviticus":"TORAH","Numbers":"TORAH","Deuteronomy":"TORAH","Joshua":"FORMER","Psalms":"WRITINGS","Isaiah":"LATTER"}'::jsonb
    ),
    (
      'a8593cf2-dc94-41a5-a5f9-b33c0042197b'::uuid,
      'book_section_sort|OT|torah_foundation_b',
      'OT',
      'DEU',
      'TORAH',
      'Drag each Old Testament book into its correct section.',
      array['Numbers', 'Deuteronomy', 'Leviticus', 'Genesis', 'Ruth', 'Lamentations', 'Proverbs', '1 Kings'],
      '{"Numbers":"TORAH","Deuteronomy":"TORAH","Leviticus":"TORAH","Genesis":"TORAH","Ruth":"FORMER","Lamentations":"LATTER","Proverbs":"WRITINGS","1 Kings":"FORMER"}'::jsonb
    ),
    (
      'd8ace3a4-218d-4e61-8678-ee7b9f4a70fc'::uuid,
      'book_section_sort|OT|former_foundation_a',
      'OT',
      'JOS',
      'FORMER',
      'Drag each Old Testament book into its correct section.',
      array['Joshua', 'Judges', 'Ruth', '1 Samuel', 'Genesis', 'Isaiah', 'Psalms', 'Job'],
      '{"Joshua":"FORMER","Judges":"FORMER","Ruth":"FORMER","1 Samuel":"FORMER","Genesis":"TORAH","Isaiah":"LATTER","Psalms":"WRITINGS","Job":"WRITINGS"}'::jsonb
    ),
    (
      '4f7057b3-8d84-424f-a878-2f0916df5fd2'::uuid,
      'book_section_sort|OT|former_foundation_b',
      'OT',
      '2SA',
      'FORMER',
      'Drag each Old Testament book into its correct section.',
      array['2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', 'Jeremiah', 'Deuteronomy', 'Proverbs', 'Ezra'],
      '{"2 Samuel":"FORMER","1 Kings":"FORMER","2 Kings":"FORMER","1 Chronicles":"WRITINGS","Jeremiah":"LATTER","Deuteronomy":"TORAH","Proverbs":"WRITINGS","Ezra":"WRITINGS"}'::jsonb
    ),
    (
      '6c4ff3d0-0d5f-44bc-930b-4b2ad76faba9'::uuid,
      'book_section_sort|OT|latter_foundation_a',
      'OT',
      'ISA',
      'LATTER',
      'Drag each Old Testament book into its correct section.',
      array['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Genesis', 'Joshua', 'Psalms'],
      '{"Isaiah":"LATTER","Jeremiah":"LATTER","Lamentations":"LATTER","Ezekiel":"LATTER","Daniel":"LATTER","Genesis":"TORAH","Joshua":"FORMER","Psalms":"WRITINGS"}'::jsonb
    ),
    (
      '35f6e37c-7460-45f7-a19e-0e198721848f'::uuid,
      'book_section_sort|OT|latter_foundation_b',
      'OT',
      'HOS',
      'LATTER',
      'Drag each Old Testament book into its correct section.',
      array['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Ruth', 'Ezra'],
      '{"Hosea":"LATTER","Joel":"LATTER","Amos":"LATTER","Obadiah":"LATTER","Jonah":"LATTER","Micah":"LATTER","Ruth":"FORMER","Ezra":"WRITINGS"}'::jsonb
    ),
    (
      '8bdca309-0426-4ad3-9620-88f9620ba97e'::uuid,
      'book_section_sort|OT|latter_foundation_c',
      'OT',
      'NAM',
      'LATTER',
      'Drag each Old Testament book into its correct section.',
      array['Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Nehemiah', '2 Kings'],
      '{"Nahum":"LATTER","Habakkuk":"LATTER","Zephaniah":"LATTER","Haggai":"LATTER","Zechariah":"LATTER","Malachi":"LATTER","Nehemiah":"WRITINGS","2 Kings":"FORMER"}'::jsonb
    ),
    (
      '42d3fad5-637a-4d9e-b6db-6cffdfd8a1ac'::uuid,
      'book_section_sort|OT|writings_foundation_a',
      'OT',
      '1CH',
      'WRITINGS',
      'Drag each Old Testament book into its correct section.',
      array['1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', '1 Kings', 'Isaiah', 'Joshua', 'Numbers'],
      '{"1 Chronicles":"WRITINGS","2 Chronicles":"WRITINGS","Ezra":"WRITINGS","Nehemiah":"WRITINGS","1 Kings":"FORMER","Isaiah":"LATTER","Joshua":"FORMER","Numbers":"TORAH"}'::jsonb
    ),
    (
      '77fa5ee9-499d-4a7d-a75d-001fa975f8b9'::uuid,
      'book_section_sort|OT|writings_foundation_b',
      'OT',
      'EST',
      'WRITINGS',
      'Drag each Old Testament book into its correct section.',
      array['Esther', 'Job', 'Psalms', 'Proverbs', 'Lamentations', 'Ruth', 'Exodus', 'Amos'],
      '{"Esther":"WRITINGS","Job":"WRITINGS","Psalms":"WRITINGS","Proverbs":"WRITINGS","Lamentations":"LATTER","Ruth":"FORMER","Exodus":"TORAH","Amos":"LATTER"}'::jsonb
    ),
    (
      '0e3aace9-189e-4332-bb49-6435f23ba8a0'::uuid,
      'book_section_sort|OT|writings_foundation_c',
      'OT',
      'ECC',
      'WRITINGS',
      'Drag each Old Testament book into its correct section.',
      array['Ecclesiastes', 'Song of Songs', 'Jeremiah', 'Deuteronomy', 'Judges', 'Hosea', 'Ezekiel', '2 Samuel'],
      '{"Ecclesiastes":"WRITINGS","Song of Songs":"WRITINGS","Jeremiah":"LATTER","Deuteronomy":"TORAH","Judges":"FORMER","Hosea":"LATTER","Ezekiel":"LATTER","2 Samuel":"FORMER"}'::jsonb
    ),
    (
      'f36759b8-c8ea-4415-ae18-369ce3c637ce'::uuid,
      'book_section_sort|NT|gospels_acts_foundation',
      'NT',
      'MAT',
      'GOSPELS_ACTS',
      'Drag each New Testament book into its correct division.',
      array['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Hebrews', 'Revelation'],
      '{"Matthew":"GOSPELS_ACTS","Mark":"GOSPELS_ACTS","Luke":"GOSPELS_ACTS","John":"GOSPELS_ACTS","Acts":"GOSPELS_ACTS","Romans":"PAULINE","Hebrews":"GENERAL","Revelation":"APOCALYPSE"}'::jsonb
    ),
    (
      '960c4a8d-cb10-4eed-a31b-eee9d3187f4c'::uuid,
      'book_section_sort|NT|pauline_foundation_a',
      'NT',
      'ROM',
      'PAULINE',
      'Drag each New Testament book into its correct division.',
      array['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Hebrews', 'James', 'Matthew'],
      '{"Romans":"PAULINE","1 Corinthians":"PAULINE","2 Corinthians":"PAULINE","Galatians":"PAULINE","Ephesians":"PAULINE","Hebrews":"GENERAL","James":"GENERAL","Matthew":"GOSPELS_ACTS"}'::jsonb
    ),
    (
      'f698974b-5469-49e5-b6e1-860e34735cb3'::uuid,
      'book_section_sort|NT|pauline_foundation_b',
      'NT',
      'PHP',
      'PAULINE',
      'Drag each New Testament book into its correct division.',
      array['Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Peter', 'Jude', 'Acts', 'Revelation'],
      '{"Philippians":"PAULINE","Colossians":"PAULINE","1 Thessalonians":"PAULINE","2 Thessalonians":"PAULINE","1 Peter":"GENERAL","Jude":"GENERAL","Acts":"GOSPELS_ACTS","Revelation":"APOCALYPSE"}'::jsonb
    ),
    (
      'dc7e49de-8569-47e4-88f2-4a84ec81bcb6'::uuid,
      'book_section_sort|NT|pauline_foundation_c',
      'NT',
      '1TI',
      'PAULINE',
      'Drag each New Testament book into its correct division.',
      array['1 Timothy', '2 Timothy', 'Titus', 'Philemon', '2 John', 'John', 'Mark', 'Hebrews'],
      '{"1 Timothy":"PAULINE","2 Timothy":"PAULINE","Titus":"PAULINE","Philemon":"PAULINE","2 John":"GENERAL","John":"GOSPELS_ACTS","Mark":"GOSPELS_ACTS","Hebrews":"GENERAL"}'::jsonb
    ),
    (
      '03c1e2fb-39e8-46d9-8520-99ce1481695c'::uuid,
      'book_section_sort|NT|general_foundation_a',
      'NT',
      'HEB',
      'GENERAL',
      'Drag each New Testament book into its correct division.',
      array['Hebrews', 'James', '1 Peter', '2 Peter', 'Romans', 'Luke', 'Revelation', 'Galatians'],
      '{"Hebrews":"GENERAL","James":"GENERAL","1 Peter":"GENERAL","2 Peter":"GENERAL","Romans":"PAULINE","Luke":"GOSPELS_ACTS","Revelation":"APOCALYPSE","Galatians":"PAULINE"}'::jsonb
    ),
    (
      '4cd488b6-eaa2-4927-bbac-02156abdd773'::uuid,
      'book_section_sort|NT|general_foundation_b',
      'NT',
      '1JN',
      'GENERAL',
      'Drag each New Testament book into its correct division.',
      array['1 John', '2 John', '3 John', 'Jude', 'Philemon', 'Acts', 'Mark', 'Colossians'],
      '{"1 John":"GENERAL","2 John":"GENERAL","3 John":"GENERAL","Jude":"GENERAL","Philemon":"PAULINE","Acts":"GOSPELS_ACTS","Mark":"GOSPELS_ACTS","Colossians":"PAULINE"}'::jsonb
    ),
    (
      '0bf7b573-e3d1-4ee0-90e1-f9dd43cc542c'::uuid,
      'book_section_sort|NT|apocalypse_foundation',
      'NT',
      'REV',
      'APOCALYPSE',
      'Drag each New Testament book into its correct division.',
      array['Revelation', 'John', 'Jude', 'Romans', 'Acts', 'Hebrews', '1 Thessalonians', 'Matthew'],
      '{"Revelation":"APOCALYPSE","John":"GOSPELS_ACTS","Jude":"GENERAL","Romans":"PAULINE","Acts":"GOSPELS_ACTS","Hebrews":"GENERAL","1 Thessalonians":"PAULINE","Matthew":"GOSPELS_ACTS"}'::jsonb
    )
),
prepared as (
  select
    seed.*,
    array_to_string(seed.labels, ', ') as correct_label_text,
    case seed.testament
      when 'OT' then jsonb_build_array(
        jsonb_build_object('id', 'TORAH', 'label', 'Torah/Pentateuch'),
        jsonb_build_object('id', 'FORMER', 'label', 'Former Prophets'),
        jsonb_build_object('id', 'LATTER', 'label', 'Latter Prophets'),
        jsonb_build_object('id', 'WRITINGS', 'label', 'Writings')
      )
      else jsonb_build_array(
        jsonb_build_object('id', 'GOSPELS_ACTS', 'label', 'Gospels & Acts'),
        jsonb_build_object('id', 'PAULINE', 'label', 'Pauline Epistles'),
        jsonb_build_object('id', 'GENERAL', 'label', 'General Epistles'),
        jsonb_build_object('id', 'APOCALYPSE', 'label', 'Apocalypse')
      )
    end as drop_zones,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',
          upper(regexp_replace(label, '[^A-Za-z0-9]+', '_', 'g')),
          'text',
          label
        )
        order by ordinality
      )
      from unnest(seed.labels) with ordinality as label_item(label, ordinality)
    ) as drag_labels
  from section_sort_seed seed
),
inserted_questions as (
  insert into public.ot_generated_questions (
    id,
    event_id,
    question_type,
    payload,
    dedupe_key
  )
  select
    prepared.id,
    null,
    case
      when prepared.testament = 'NT' then 'nt_book_section_sort_v1'
      else 'book_section_sort_v1'
    end,
    jsonb_build_object(
      'question_id', prepared.id,
      'question_format', 'drag_drop_section_sort',
      'interaction_type', 'section_sort_drag_drop',
      'answer_encoding', 'section_sort_assignments_v1',
      'source_batch', '20260812_book_section_sort_questions',
      'testament', prepared.testament,
      'book_code', prepared.representative_book_code,
      'section_key', prepared.section_key,
      'prompt', prepared.prompt,
      'choices', jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', prepared.correct_label_text),
        jsonb_build_object('id', 'B', 'text', 'One or more books are in the wrong section.'),
        jsonb_build_object('id', 'C', 'text', 'Several books are in the wrong section.'),
        jsonb_build_object('id', 'D', 'text', 'I am not sure.')
      ),
      'correct_choice_id', 'A',
      'correct_answer', 'Every label is placed in its correct division.',
      'drag_labels', prepared.drag_labels,
      'drop_zones', prepared.drop_zones,
      'correct_assignments', prepared.correct_assignments,
      'dimension', 'structure_cross_ref',
      'dimension_key', 'structure_cross_ref',
      'question_family', 'book_orientation',
      'stem_family', prepared.dedupe_key,
      'knowledge_granularity', 'canon_section',
      'retrieval_target', 'book_categorization',
      'scoring_model', 'per_label_child_items',
      'scoring_note', 'The drag/drop screen is an interaction shell; the frontend submits one scored child item for each book label.',
      'importance_conceptual', 86,
      'importance_context', 70,
      'difficulty_estimate', 575,
      'irt_a', 1.1,
      'irt_b', 0.35
    ),
    prepared.dedupe_key
  from prepared
  where not exists (
    select 1
    from public.ot_generated_questions existing
    where existing.dedupe_key = prepared.dedupe_key
      and existing.question_type not like 'quarantined%'
  )
  returning id
)
insert into public.obs_nt_expository_item_reviews (
  generated_question_id,
  review_status,
  expository_target,
  text_dependence,
  orthodoxy_guessability,
  book_discrimination,
  confessional_sensitivity,
  routing_priority,
  scoring_weight,
  review_basis,
  review_notes,
  reviewed_by,
  reviewed_at,
  updated_at
)
select
  question.id,
  'approved',
  'book_structure',
  3,
  1,
  3,
  'low',
  3,
  1.0,
  '20260812_book_section_sort_questions',
  'Assesses canonical New Testament book-division categorization with all-or-nothing scoring.',
  '20260812_book_section_sort_questions',
  now(),
  now()
from section_sort_seed seed
join public.ot_generated_questions question
  on question.dedupe_key = seed.dedupe_key
where seed.testament = 'NT'
on conflict (generated_question_id) do update
set
  review_status = excluded.review_status,
  expository_target = excluded.expository_target,
  text_dependence = excluded.text_dependence,
  orthodoxy_guessability = excluded.orthodoxy_guessability,
  book_discrimination = excluded.book_discrimination,
  confessional_sensitivity = excluded.confessional_sensitivity,
  routing_priority = excluded.routing_priority,
  scoring_weight = excluded.scoring_weight,
  review_basis = excluded.review_basis,
  review_notes = excluded.review_notes,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_at = excluded.updated_at;

notify pgrst, 'reload schema';

commit;
