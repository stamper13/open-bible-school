begin;

with book_lookup (book_code, book_name, testament, section_key, section_label) as (
  values
    ('GEN', 'Genesis', 'OT', 'TORAH', 'Torah/Pentateuch'),
    ('EXO', 'Exodus', 'OT', 'TORAH', 'Torah/Pentateuch'),
    ('LEV', 'Leviticus', 'OT', 'TORAH', 'Torah/Pentateuch'),
    ('NUM', 'Numbers', 'OT', 'TORAH', 'Torah/Pentateuch'),
    ('DEU', 'Deuteronomy', 'OT', 'TORAH', 'Torah/Pentateuch'),
    ('JOS', 'Joshua', 'OT', 'FORMER', 'Former Prophets'),
    ('JDG', 'Judges', 'OT', 'FORMER', 'Former Prophets'),
    ('RUT', 'Ruth', 'OT', 'FORMER', 'Former Prophets'),
    ('1SA', '1 Samuel', 'OT', 'FORMER', 'Former Prophets'),
    ('2SA', '2 Samuel', 'OT', 'FORMER', 'Former Prophets'),
    ('1KI', '1 Kings', 'OT', 'FORMER', 'Former Prophets'),
    ('2KI', '2 Kings', 'OT', 'FORMER', 'Former Prophets'),
    ('1CH', '1 Chronicles', 'OT', 'WRITINGS', 'Writings'),
    ('2CH', '2 Chronicles', 'OT', 'WRITINGS', 'Writings'),
    ('EZR', 'Ezra', 'OT', 'WRITINGS', 'Writings'),
    ('NEH', 'Nehemiah', 'OT', 'WRITINGS', 'Writings'),
    ('EST', 'Esther', 'OT', 'WRITINGS', 'Writings'),
    ('JOB', 'Job', 'OT', 'WRITINGS', 'Writings'),
    ('PSA', 'Psalms', 'OT', 'WRITINGS', 'Writings'),
    ('PRO', 'Proverbs', 'OT', 'WRITINGS', 'Writings'),
    ('ECC', 'Ecclesiastes', 'OT', 'WRITINGS', 'Writings'),
    ('SNG', 'Song of Songs', 'OT', 'WRITINGS', 'Writings'),
    ('ISA', 'Isaiah', 'OT', 'LATTER', 'Latter Prophets'),
    ('JER', 'Jeremiah', 'OT', 'LATTER', 'Latter Prophets'),
    ('LAM', 'Lamentations', 'OT', 'LATTER', 'Latter Prophets'),
    ('EZE', 'Ezekiel', 'OT', 'LATTER', 'Latter Prophets'),
    ('DAN', 'Daniel', 'OT', 'LATTER', 'Latter Prophets'),
    ('HOS', 'Hosea', 'OT', 'LATTER', 'Latter Prophets'),
    ('JOL', 'Joel', 'OT', 'LATTER', 'Latter Prophets'),
    ('AMO', 'Amos', 'OT', 'LATTER', 'Latter Prophets'),
    ('OBA', 'Obadiah', 'OT', 'LATTER', 'Latter Prophets'),
    ('JON', 'Jonah', 'OT', 'LATTER', 'Latter Prophets'),
    ('MIC', 'Micah', 'OT', 'LATTER', 'Latter Prophets'),
    ('NAM', 'Nahum', 'OT', 'LATTER', 'Latter Prophets'),
    ('HAB', 'Habakkuk', 'OT', 'LATTER', 'Latter Prophets'),
    ('ZEP', 'Zephaniah', 'OT', 'LATTER', 'Latter Prophets'),
    ('HAG', 'Haggai', 'OT', 'LATTER', 'Latter Prophets'),
    ('ZEC', 'Zechariah', 'OT', 'LATTER', 'Latter Prophets'),
    ('MAL', 'Malachi', 'OT', 'LATTER', 'Latter Prophets'),
    ('MAT', 'Matthew', 'NT', 'GOSPELS_ACTS', 'Gospels & Acts'),
    ('MRK', 'Mark', 'NT', 'GOSPELS_ACTS', 'Gospels & Acts'),
    ('LUK', 'Luke', 'NT', 'GOSPELS_ACTS', 'Gospels & Acts'),
    ('JHN', 'John', 'NT', 'GOSPELS_ACTS', 'Gospels & Acts'),
    ('ACT', 'Acts', 'NT', 'GOSPELS_ACTS', 'Gospels & Acts'),
    ('ROM', 'Romans', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('1CO', '1 Corinthians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('2CO', '2 Corinthians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('GAL', 'Galatians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('EPH', 'Ephesians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('PHP', 'Philippians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('COL', 'Colossians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('1TH', '1 Thessalonians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('2TH', '2 Thessalonians', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('1TI', '1 Timothy', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('2TI', '2 Timothy', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('TIT', 'Titus', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('PHM', 'Philemon', 'NT', 'PAULINE', 'Pauline Epistles'),
    ('HEB', 'Hebrews', 'NT', 'GENERAL', 'General Epistles'),
    ('JAS', 'James', 'NT', 'GENERAL', 'General Epistles'),
    ('1PE', '1 Peter', 'NT', 'GENERAL', 'General Epistles'),
    ('2PE', '2 Peter', 'NT', 'GENERAL', 'General Epistles'),
    ('1JN', '1 John', 'NT', 'GENERAL', 'General Epistles'),
    ('2JN', '2 John', 'NT', 'GENERAL', 'General Epistles'),
    ('3JN', '3 John', 'NT', 'GENERAL', 'General Epistles'),
    ('JUD', 'Jude', 'NT', 'GENERAL', 'General Epistles'),
    ('REV', 'Revelation', 'NT', 'APOCALYPSE', 'Apocalypse')
),
screen_labels as (
  select
    screen.id as screen_question_id,
    screen.dedupe_key as screen_dedupe_key,
    screen.payload,
    assignment.key as book_name,
    assignment.value as section_key,
    book.book_code,
    book.testament,
    book.section_label,
    screen.dedupe_key || '|label|' || lower(regexp_replace(assignment.key, '[^A-Za-z0-9]+', '_', 'g')) as label_dedupe_key
  from public.ot_generated_questions screen
  cross join lateral jsonb_each_text(screen.payload->'correct_assignments') assignment(key, value)
  join book_lookup book
    on book.book_name = assignment.key
   and book.section_key = assignment.value
  where screen.payload->>'source_batch' = '20260812_book_section_sort_questions'
    and screen.payload->>'interaction_type' = 'section_sort_drag_drop'
),
new_child_questions as (
  select
    gen_random_uuid() as id,
    label.*
  from screen_labels label
  where not exists (
    select 1
    from public.ot_generated_questions existing
    where existing.dedupe_key = label.label_dedupe_key
      and existing.question_type not like 'quarantined%'
  )
),
inserted_child_questions as (
  insert into public.ot_generated_questions (
    id,
    event_id,
    question_type,
    payload,
    dedupe_key
  )
  select
    child.id,
    null,
    case
      when child.testament = 'NT' then 'nt_book_section_sort_label_v1'
      else 'book_section_sort_label_v1'
    end,
    jsonb_build_object(
      'question_id', child.id,
      'parent_section_sort_question_id', child.screen_question_id,
      'question_format', 'section_sort_label',
      'source_batch', '20260812_section_sort_per_label_scoring',
      'testament', child.testament,
      'book_code', child.book_code,
      'book_name', child.book_name,
      'section_key', child.section_key,
      'prompt', 'Place ' || child.book_name || ' into its correct section.',
      'choices', jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', child.section_label),
        jsonb_build_object('id', 'B', 'text', 'A different section'),
        jsonb_build_object('id', 'C', 'text', 'I am not sure'),
        jsonb_build_object('id', 'D', 'text', 'Not categorized')
      ),
      'correct_choice_id', 'A',
      'correct_answer', child.section_label,
      'dimension', 'structure_cross_ref',
      'dimension_key', 'structure_cross_ref',
      'question_family', 'book_orientation',
      'stem_family', child.label_dedupe_key,
      'knowledge_granularity', 'canon_section',
      'retrieval_target', 'book_categorization',
      'parent_interaction', 'section_sort_drag_drop',
      'importance_conceptual', 86,
      'importance_context', 70,
      'difficulty_estimate', 520,
      'irt_a', 0.85,
      'irt_b', 0.05
    ),
    child.label_dedupe_key
  from new_child_questions child
  returning id
),
label_question_map as (
  select
    label.screen_question_id,
    label.book_name,
    question.id as label_question_id
  from screen_labels label
  join public.ot_generated_questions question
    on question.dedupe_key = label.label_dedupe_key
   and question.question_type not like 'quarantined%'
),
screen_maps as (
  select
    screen_question_id,
    jsonb_object_agg(book_name, label_question_id::text order by book_name) as label_question_ids
  from label_question_map
  group by screen_question_id
)
update public.ot_generated_questions screen
set payload = jsonb_set(
  jsonb_set(
    screen.payload,
    '{label_question_ids}',
    screen_maps.label_question_ids,
    true
  ),
  '{scoring_model}',
  to_jsonb('per_label_child_items'::text),
  true
)
from screen_maps
where screen.id = screen_maps.screen_question_id;

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
  '20260812_section_sort_per_label_scoring',
  'Child item for one book label inside a section-sort drag/drop screen.',
  '20260812_section_sort_per_label_scoring',
  now(),
  now()
from public.ot_generated_questions question
where question.question_type = 'nt_book_section_sort_label_v1'
  and question.payload->>'source_batch' = '20260812_section_sort_per_label_scoring'
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

create or replace function public.obs_submit_section_sort_answers(
  p_attempt_id uuid,
  p_screen_question_id uuid,
  p_assignments jsonb
)
returns table (
  is_correct boolean,
  is_idk boolean,
  correct_choice_id text,
  answered_count integer,
  correct_count integer,
  target_question_count integer,
  target_reached boolean,
  remaining_count integer,
  scored_item_count integer,
  scored_correct_count integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_screen public.ot_generated_questions%rowtype;
  v_target_count integer;
  v_assignment record;
  v_label text;
  v_selected_section text;
  v_correct_section text;
  v_label_question_id uuid;
  v_label_question public.ot_generated_questions%rowtype;
  v_book_code text;
  v_nt_division text;
  v_selected_choice_id text;
  v_is_correct boolean;
  v_is_idk boolean;
  v_inserted boolean;
  v_answered integer;
  v_correct integer;
  v_scored integer := 0;
  v_scored_correct integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception using errcode = '22023', message = 'Assignments must be a JSON array';
  end if;

  select *
  into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Attempt not found or not authorized';
  end if;

  select *
  into v_screen
  from public.ot_generated_questions question
  where question.id = p_screen_question_id
    and question.payload->>'interaction_type' = 'section_sort_drag_drop'
    and question.payload ? 'correct_assignments'
    and question.payload ? 'label_question_ids';

  if not found then
    raise exception using errcode = '22023', message = 'Section-sort screen is not configured for per-label scoring';
  end if;

  if upper(coalesce(v_screen.payload->>'testament', 'OT')) <> upper(coalesce(v_attempt.testament, 'OT')) then
    raise exception using errcode = '22023', message = 'Section-sort screen does not belong to this testament';
  end if;

  for v_assignment in
    select *
    from jsonb_array_elements(p_assignments) item
  loop
    v_label := nullif(btrim(v_assignment.value->>'text'), '');
    v_selected_section := upper(nullif(btrim(v_assignment.value->>'section_key'), ''));

    if v_label is null then
      raise exception using errcode = '22023', message = 'Assignment is missing a book label';
    end if;

    v_correct_section := v_screen.payload->'correct_assignments'->>v_label;
    v_label_question_id := nullif(v_screen.payload->'label_question_ids'->>v_label, '')::uuid;

    if v_correct_section is null or v_label_question_id is null then
      raise exception using
        errcode = '22023',
        message = format('Book label is not part of this section-sort screen: %s', v_label);
    end if;

    select *
    into v_label_question
    from public.ot_generated_questions question
    where question.id = v_label_question_id
      and question.question_type in (
        'book_section_sort_label_v1',
        'nt_book_section_sort_label_v1'
      )
      and question.question_type not like 'quarantined%';

    if not found then
      raise exception using errcode = '22023', message = 'Section-sort child question is missing or inactive';
    end if;

    v_book_code := upper(coalesce(v_label_question.payload->>'book_code', ''));

    if upper(coalesce(v_attempt.testament, 'OT')) = 'NT' then
      select book.nt_division
      into v_nt_division
      from public.scripture_books book
      where book.book_code = v_book_code;

      if not public.obs_nt_question_matches_scope(
        v_book_code,
        v_nt_division,
        v_attempt.scope_key
      ) then
        raise exception using errcode = '22023', message = 'Child question does not belong to this NT assessment scope';
      end if;
    elsif not public.question_matches_assessment_scope(
      v_book_code,
      v_attempt.testament,
      v_attempt.scope_key
    ) then
      raise exception using errcode = '22023', message = 'Child question does not belong to this OT assessment scope';
    end if;

    v_is_idk := v_selected_section = '__IDK__';
    v_is_correct := not v_is_idk and v_selected_section = upper(v_correct_section);
    v_selected_choice_id := case
      when v_is_idk then '__IDK__'
      when v_is_correct then 'A'
      else 'B'
    end;

    v_inserted := false;
    insert into public.assessment_answers (
      attempt_id,
      user_id,
      question_id,
      generated_question_id,
      selected_choice_id,
      is_correct,
      is_idk,
      answered_at
    ) values (
      p_attempt_id,
      v_user_id,
      v_label_question_id,
      v_label_question_id,
      v_selected_choice_id,
      v_is_correct,
      v_is_idk,
      now()
    )
    on conflict (attempt_id, question_id) do nothing
    returning true into v_inserted;

    v_scored := v_scored + 1;
    if v_is_correct then
      v_scored_correct := v_scored_correct + 1;
    end if;

    if coalesce(v_inserted, false) then
      if upper(coalesce(v_attempt.testament, 'OT')) = 'NT' then
        perform public.update_theta_internal(
          v_user_id,
          public.obs_nt_scope_key(v_nt_division, null),
          v_label_question.event_id,
          v_is_correct
        );
        perform public.update_theta_internal(
          v_user_id,
          'NT',
          v_label_question.event_id,
          v_is_correct
        );
      else
        perform public.update_theta_internal(
          v_user_id,
          public.canonical_assessment_scope(v_book_code),
          v_label_question.event_id,
          v_is_correct
        );
        perform public.update_theta_internal(
          v_user_id,
          'OT',
          v_label_question.event_id,
          v_is_correct
        );
      end if;
    end if;
  end loop;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  v_target_count := greatest(
    1,
    coalesce(
      v_attempt.target_question_count,
      v_attempt.question_target,
      v_attempt.total_count,
      20
    )
  );

  update public.assessment_attempts attempt
  set
    answered_count = v_answered,
    correct_count = v_correct,
    is_complete = v_answered >= v_target_count,
    completed_at = case
      when v_answered >= v_target_count then coalesce(attempt.completed_at, now())
      else attempt.completed_at
    end
  where attempt.id = p_attempt_id;

  return query
  select
    v_scored > 0 and v_scored_correct = v_scored,
    v_scored > 0 and v_scored_correct = 0 and exists (
      select 1
      from jsonb_array_elements(p_assignments) item
      where upper(coalesce(item.value->>'section_key', '')) = '__IDK__'
    ),
    'A'::text,
    v_answered,
    v_correct,
    v_target_count,
    v_answered >= v_target_count,
    greatest(v_target_count - v_answered, 0),
    v_scored,
    v_scored_correct;
end;
$function$;

revoke all on function public.obs_submit_section_sort_answers(
  uuid, uuid, jsonb
) from public, anon;
grant execute on function public.obs_submit_section_sort_answers(
  uuid, uuid, jsonb
) to authenticated, service_role;

comment on function public.obs_submit_section_sort_answers(
  uuid, uuid, jsonb
) is
  'Persists one first-write-wins scored answer per book label in a section-sort drag/drop screen.';

notify pgrst, 'reload schema';

commit;
