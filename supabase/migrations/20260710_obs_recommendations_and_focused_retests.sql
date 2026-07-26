-- OBS recommendation engine + focused retests.
--
-- Run this in the Supabase SQL editor.
-- It creates:
--   1. obs_learning_units: ordered OT learning units, with Genesis as the base.
--   2. obs_question_bank_with_units: question-bank rows mapped to learning units when a chapter can be inferred.
--   3. obs_get_user_recommendation(user_id): pyramid-aware recommendation RPC.
--   4. obs_get_next_focused_question(...): focused retest question RPC.

create table if not exists public.obs_learning_units (
  unit_key text primary key,
  section text not null,
  book_code text not null,
  label text not null,
  start_chapter integer not null,
  end_chapter integer not null,
  sequence_order integer not null unique,
  is_foundation boolean not null default false,
  baseline_display_score_required integer not null default 585,
  min_answers_required integer not null default 3,
  retest_question_target integer not null default 15,
  focus_text text not null,
  created_at timestamptz not null default now(),
  constraint obs_learning_units_chapter_ck check (start_chapter >= 1 and end_chapter >= start_chapter),
  constraint obs_learning_units_score_ck check (baseline_display_score_required between 200 and 800),
  constraint obs_learning_units_target_ck check (retest_question_target between 10 and 20)
);

insert into public.obs_learning_units
  (unit_key, section, book_code, label, start_chapter, end_chapter, sequence_order, is_foundation, focus_text)
values
  ('gen-1-11',   'Torah', 'GEN', 'Genesis 1-11',       1,  11,  10, true,  'Creation, fall, flood, Babel, and the universal problem that frames the covenant story.'),
  ('gen-12-50',  'Torah', 'GEN', 'Genesis 12-50',     12,  50,  20, true,  'Abraham, Isaac, Jacob, Joseph, covenant promises, and the family line of Israel.'),
  ('exo-1-20',   'Torah', 'EXO', 'Exodus 1-20',        1,  20,  30, true,  'Israel in Egypt, Moses, plagues, exodus, Sinai, and the Ten Commandments.'),
  ('exo-21-40',  'Torah', 'EXO', 'Exodus 21-40',      21,  40,  40, true,  'Covenant law, tabernacle, golden calf, priesthood, and God dwelling with Israel.'),
  ('lev-1-16',   'Torah', 'LEV', 'Leviticus 1-16',     1,  16,  50, true,  'Sacrifice, priesthood, purity, holiness, and the Day of Atonement.'),
  ('lev-17-27',  'Torah', 'LEV', 'Leviticus 17-27',   17,  27,  60, true,  'Holiness, worship, covenant obedience, feasts, sabbath years, and Jubilee.'),
  ('num-10-25',  'Torah', 'NUM', 'Numbers 10-25',     10,  25,  70, true,  'Wilderness journey, rebellion, intercession, Balaam, and covenant failure before the land.'),
  ('deu-5-30',   'Torah', 'DEU', 'Deuteronomy 5-30',   5,  30,  80, true,  'Covenant renewal, law, blessing and curse, and Moses'' final instruction.'),
  ('jos-1-12',   'Former Prophets', 'JOS', 'Joshua 1-12',       1, 12,  90, true, 'Crossing the Jordan, conquest narratives, covenant faithfulness, and entering the land.'),
  ('jdg-2-16',   'Former Prophets', 'JDG', 'Judges 2-16',       2, 16, 100, true, 'Israel''s cycle of decline, deliverance, and the major judges.'),
  ('rut-1-4',    'Former Prophets', 'RUT', 'Ruth 1-4',          1,  4, 110, true, 'Covenant loyalty, providence, redemption, and Ruth in David''s line.'),
  ('1sa-8-31',   'Former Prophets', '1SA', '1 Samuel 8-31',     8, 31, 120, true, 'Samuel, Saul, David''s rise, kingship, and the transition into monarchy.'),
  ('2sa-5-12',   'Former Prophets', '2SA', '2 Samuel 5-12',     5, 12, 130, true, 'David''s reign, Jerusalem, covenant promise, sin, and royal consequences.'),
  ('1ki-1-19',   'Former Prophets', '1KI', '1 Kings 1-19',      1, 19, 140, true, 'Solomon, the divided kingdom, temple, idolatry, Elijah, and covenant decline.'),
  ('2ki-17-25',  'Former Prophets', '2KI', '2 Kings 17-25',    17, 25, 150, true, 'Israel and Judah''s fall, exile, and the covenant meaning of the kingdoms'' collapse.'),

  ('isa-1-12',   'Latter Prophets', 'ISA', 'Isaiah 1-12',       1, 12, 210, false, 'Judgment, holiness, remnant hope, and the promised king.'),
  ('jer-1-31',   'Latter Prophets', 'JER', 'Jeremiah 1-31',     1, 31, 220, false, 'Covenant indictment, exile warnings, and new covenant hope.'),
  ('eze-1-37',   'Latter Prophets', 'EZE', 'Ezekiel 1-37',      1, 37, 230, false, 'Exile, God''s glory, judgment, restoration, and the valley of dry bones.'),
  ('dan-1-7',    'Writings',        'DAN', 'Daniel 1-7',        1,  7, 240, false, 'Exile faithfulness, kingdoms, visions, and God''s rule over history.'),
  ('psa-1-41',   'Writings',        'PSA', 'Psalms 1-41',       1, 41, 250, false, 'Wisdom, lament, kingship, trust, and worship in Book 1 of Psalms.'),
  ('pro-1-9',    'Writings',        'PRO', 'Proverbs 1-9',      1,  9, 260, false, 'Wisdom, fear of the LORD, instruction, folly, and moral formation.'),
  ('job-1-14',   'Writings',        'JOB', 'Job 1-14',          1, 14, 270, false, 'Suffering, righteousness, lament, and the opening dispute over God''s justice.')
on conflict (unit_key) do update set
  section = excluded.section,
  book_code = excluded.book_code,
  label = excluded.label,
  start_chapter = excluded.start_chapter,
  end_chapter = excluded.end_chapter,
  sequence_order = excluded.sequence_order,
  is_foundation = excluded.is_foundation,
  focus_text = excluded.focus_text;

create or replace function public.obs_book_ref_pattern(p_book_code text)
returns text
language sql
immutable
as $$
  select case upper(p_book_code)
    when 'GEN' then '(Gen|Genesis)'
    when 'EXO' then '(Exod|Exodus)'
    when 'LEV' then '(Lev|Leviticus)'
    when 'NUM' then '(Num|Numbers)'
    when 'DEU' then '(Deut|Deuteronomy)'
    when 'JOS' then '(Josh|Joshua)'
    when 'JDG' then '(Judg|Judges)'
    when 'RUT' then '(Ruth)'
    when '1SA' then '(1\\s*Sam|1\\s*Samuel)'
    when '2SA' then '(2\\s*Sam|2\\s*Samuel)'
    when '1KI' then '(1\\s*Kgs|1\\s*Kings)'
    when '2KI' then '(2\\s*Kgs|2\\s*Kings)'
    when 'ISA' then '(Isa|Isaiah)'
    when 'JER' then '(Jer|Jeremiah)'
    when 'EZE' then '(Ezek|Ezekiel)'
    when 'DAN' then '(Dan|Daniel)'
    when 'PSA' then '(Ps|Psalm|Psalms)'
    when 'PRO' then '(Prov|Proverbs)'
    when 'JOB' then '(Job)'
    else regexp_replace(upper(p_book_code), '([\\W])', '\\\1', 'g')
  end;
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
begin
  if p_book_code is null then
    return null;
  end if;

  ref_pattern := public.obs_book_ref_pattern(p_book_code);
  source_ref := coalesce(p_payload->>'source_ref', '');
  prompt_text := coalesce(p_payload->>'prompt', p_prompt, '');

  chapter_match := regexp_match(source_ref, ('\m' || ref_pattern || '\.?\s+([0-9]{1,3})(?::[0-9]{1,3})?'), 'i');
  if chapter_match is not null then
    return chapter_match[2]::integer;
  end if;

  dedupe_parts := string_to_array(coalesce(p_dedupe_key, ''), '|');
  book_pos := array_position(dedupe_parts, upper(p_book_code));
  if book_pos is not null and array_length(dedupe_parts, 1) >= book_pos + 1 and dedupe_parts[book_pos + 1] ~ '^[0-9]{1,3}$' then
    return dedupe_parts[book_pos + 1]::integer;
  end if;

  chapter_match := regexp_match(prompt_text, ('\m' || ref_pattern || '\.?\s+([0-9]{1,3})(?::[0-9]{1,3})?'), 'i');
  if chapter_match is not null then
    return chapter_match[2]::integer;
  end if;

  return null;
end;
$$;

create or replace view public.obs_question_bank_with_units as
select
  q.*,
  inferred.inferred_chapter,
  u.unit_key,
  u.label as unit_label,
  u.section as unit_section,
  u.sequence_order as unit_sequence_order
from public.v_question_bank q
left join public.bible_events e
  on e.id = q.event_id
cross join lateral (
  select coalesce(
    public.obs_infer_question_chapter(q.book_code, q.prompt, q.payload, q.dedupe_key),
    e.start_chapter
  ) as inferred_chapter
) inferred
left join public.obs_learning_units u
  on u.book_code = q.book_code
 and inferred.inferred_chapter between u.start_chapter and u.end_chapter;

create or replace function public.obs_display_score_from_raw(p_raw_pct numeric)
returns integer
language sql
immutable
as $$
  select greatest(200, least(800, round(coalesce(p_raw_pct, 0) * 6 + 200)::integer));
$$;

create or replace function public.obs_get_user_recommendation(p_user_id uuid)
returns table (
  unit_key text,
  label text,
  section text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  sequence_order integer,
  is_foundation boolean,
  answered integer,
  correct integer,
  raw_score numeric,
  display_score integer,
  baseline_display_score_required integer,
  retest_question_target integer,
  focus_text text,
  reason text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  unit_answer_rows as (
    select
      u.unit_key,
      u.label,
      u.section,
      u.book_code,
      u.start_chapter,
      u.end_chapter,
      u.sequence_order,
      u.is_foundation,
      u.baseline_display_score_required,
      u.min_answers_required,
      u.retest_question_target,
      u.focus_text,
      a.id as answer_id,
      coalesce(a.is_correct, false) as is_correct,
      greatest(1, coalesce(q.routing_score, q.importance_conceptual, q.importance_context, 50))::numeric as weight
    from public.obs_learning_units u
    join authorized on true
    left join public.obs_question_bank_with_units q
      on q.unit_key = u.unit_key
    left join public.assessment_answers a
      on a.generated_question_id = q.generated_question_id
     and a.user_id = p_user_id
     and coalesce(a.is_idk, false) = false
  ),
  unit_scores as (
    select
      unit_key,
      label,
      section,
      book_code,
      start_chapter,
      end_chapter,
      sequence_order,
      is_foundation,
      baseline_display_score_required,
      min_answers_required,
      retest_question_target,
      focus_text,
      count(answer_id)::integer as answered,
      count(answer_id) filter (where is_correct)::integer as correct,
      case
        when coalesce(sum(weight) filter (where answer_id is not null), 0) <= 0 then null
        else greatest(
          0,
          least(
            100,
            ((coalesce(sum(weight) filter (where answer_id is not null and is_correct), 0) / nullif(sum(weight) filter (where answer_id is not null), 0)) - 0.25) / 0.75 * 100
          )
        )
      end as raw_score
    from unit_answer_rows
    group by
      unit_key, label, section, book_code, start_chapter, end_chapter, sequence_order,
      is_foundation, baseline_display_score_required, min_answers_required,
      retest_question_target, focus_text
  ),
  scored as (
    select
      *,
      case when raw_score is null then null else public.obs_display_score_from_raw(raw_score) end as display_score
    from unit_scores
  ),
  foundation_gap as (
    select
      *,
      case
        when answered < min_answers_required then 'Foundational unit needs more evidence'
        else 'Foundational unit is below baseline'
      end as reason
    from scored
    where is_foundation = true
      and (answered < min_answers_required or coalesce(display_score, 200) < baseline_display_score_required)
    order by sequence_order
    limit 1
  ),
  later_gap as (
    select
      *,
      case
        when answered < min_answers_required then 'Later/Writings unit needs more evidence'
        else 'Lowest post-foundation score'
      end as reason
    from scored
    where is_foundation = false
      and (answered < min_answers_required or coalesce(display_score, 200) < baseline_display_score_required)
    order by
      case when answered < min_answers_required then 0 else 1 end,
      coalesce(display_score, 200),
      sequence_order
    limit 1
  )
  select
    unit_key, label, section, book_code, start_chapter, end_chapter, sequence_order,
    is_foundation, answered, correct, raw_score, display_score, baseline_display_score_required,
    retest_question_target, focus_text, reason
  from foundation_gap
  union all
  select
    unit_key, label, section, book_code, start_chapter, end_chapter, sequence_order,
    is_foundation, answered, correct, raw_score, display_score, baseline_display_score_required,
    retest_question_target, focus_text, reason
  from later_gap
  where not exists (select 1 from foundation_gap)
  limit 1;
$$;

create or replace function public.obs_get_next_focused_question(
  p_user_id uuid,
  p_attempt_id uuid,
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  target as (
    select *
    from public.obs_learning_units u
    join authorized on true
    where (p_unit_key is not null and u.unit_key = p_unit_key)
       or (
         p_unit_key is null
         and p_book_code is not null
         and u.book_code = upper(p_book_code)
         and u.start_chapter = p_start_chapter
         and u.end_chapter = p_end_chapter
       )
    order by u.sequence_order
    limit 1
  ),
  candidate_base as (
    select
      q.*,
      coalesce(t.label, q.unit_label, q.book_code || ' focused retest') as target_label,
      coalesce(t.section, q.unit_section, 'Old Testament') as target_section,
      exists (
        select 1
        from public.assessment_answers a
        where a.user_id = p_user_id
          and a.generated_question_id = q.generated_question_id
          and a.attempt_id = p_attempt_id
      ) as answered_in_attempt,
      exists (
        select 1
        from public.assessment_answers a
        where a.user_id = p_user_id
          and a.generated_question_id = q.generated_question_id
      ) as answered_before
    from public.obs_question_bank_with_units q
    join authorized on true
    left join target t on true
    where q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and (
        (p_unit_key is not null and q.unit_key = p_unit_key)
        or (
          p_unit_key is null
          and p_book_code is not null
          and q.book_code = upper(p_book_code)
          and q.inferred_chapter between p_start_chapter and p_end_chapter
        )
      )
  ),
  ranked as (
    select *
    from candidate_base
    order by
      answered_in_attempt asc,
      answered_before asc,
      (coalesce(routing_score, 50)::numeric / 100.0 + random() * 0.35) desc,
      created_at desc
    limit 1
  )
  select
    generated_question_id as out_generated_question_id,
    coalesce(payload->>'prompt', prompt) as prompt,
    question_type,
    payload->'choices' as choices,
    target_label as event_title,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end as importance_tier,
    target_section as section
  from ranked;
$$;

grant select on public.obs_learning_units to anon, authenticated;
grant select on public.obs_question_bank_with_units to anon, authenticated;
revoke all on function public.obs_get_user_recommendation(uuid) from public, anon;
revoke all on function public.obs_get_next_focused_question(uuid, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.obs_get_user_recommendation(uuid) to authenticated;
grant execute on function public.obs_get_next_focused_question(uuid, uuid, text, text, integer, integer) to authenticated;
