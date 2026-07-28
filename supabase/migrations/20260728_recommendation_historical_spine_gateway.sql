-- Require a baseline historical spine before recommending Latter Prophets.
--
-- The recommendation engine already selects every weak `is_foundation` unit
-- before considering later units. This migration completes that gateway:
--   Torah -> Former Prophets -> Chronicles -> Ezra-Nehemiah -> Latter Prophets.
--
-- Stable 1 Kings and 2 Kings unit keys are retained because assessment context
-- rows may already reference them, while their ranges expand to the full books.

begin;

do $$
declare
  existing_kings integer;
  sequence_conflicts integer;
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regprocedure(
       'public.obs_get_user_recommendation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_get_unit_mastery_score(uuid,text,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Historical-spine recommendation prerequisites are missing; nothing changed.';
  end if;

  select count(*)::integer
  into existing_kings
  from public.obs_learning_units
  where unit_key in ('1ki-1-19', '2ki-17-25');

  select count(*)::integer
  into sequence_conflicts
  from public.obs_learning_units
  where sequence_order in (160, 170, 180, 190)
    and unit_key not in (
      '1ch-1-29',
      '2ch-1-36',
      'ezr-1-10',
      'neh-1-13'
    );

  if existing_kings <> 2 or sequence_conflicts <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Historical-spine preflight failed: Kings units=%s (expected 2), sequence conflicts=%s.',
        existing_kings,
        sequence_conflicts
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
  '20260728_recommendation_historical_spine_gateway',
  'public',
  'obs_learning_units_historical_spine',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'unit_key', target.unit_key,
      'had_row', unit.unit_key is not null,
      'row', to_jsonb(unit)
    )
    order by target.sort_order
  )::text
from (
  values
    ('1ki-1-19', 1),
    ('2ki-17-25', 2),
    ('1ch-1-29', 3),
    ('2ch-1-36', 4),
    ('ezr-1-10', 5),
    ('neh-1-13', 6)
) as target(unit_key, sort_order)
left join public.obs_learning_units unit
  on unit.unit_key = target.unit_key
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260728_recommendation_historical_spine_gateway'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_learning_units_historical_spine'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
  backed_up_units integer;
begin
  select
    count(*)::integer,
    max(jsonb_array_length(definition::jsonb))
  into backup_count, backed_up_units
  from public.obs_schema_backups
  where backup_tag =
      '20260728_recommendation_historical_spine_gateway'
    and object_schema = 'public'
    and object_name = 'obs_learning_units_historical_spine'
    and object_type = 'data';

  if backup_count <> 1 or backed_up_units <> 6 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Historical-spine backup assertion failed: backups=%s, units=%s.',
        backup_count,
        backed_up_units
      );
  end if;
end
$$;

insert into public.obs_learning_units (
  unit_key,
  section,
  book_code,
  label,
  start_chapter,
  end_chapter,
  sequence_order,
  is_foundation,
  baseline_display_score_required,
  min_answers_required,
  retest_question_target,
  focus_text
)
values
  (
    '1ki-1-19',
    'Former Prophets',
    '1KI',
    '1 Kings',
    1,
    22,
    140,
    true,
    513,
    3,
    15,
    'Solomon and the temple, the kingdom''s division, Elijah, Ahab, and the covenant failures that frame the prophets.'
  ),
  (
    '2ki-17-25',
    'Former Prophets',
    '2KI',
    '2 Kings',
    1,
    25,
    150,
    true,
    513,
    3,
    15,
    'Elisha, dynastic upheaval, Assyria, the fall of Israel and Judah, exile, and the historical setting of the prophets.'
  ),
  (
    '1ch-1-29',
    'Writings',
    '1CH',
    '1 Chronicles',
    1,
    29,
    160,
    true,
    513,
    3,
    15,
    'Israel''s lineages, David''s reign, temple preparation, worship, and the Davidic foundation recalled after exile.'
  ),
  (
    '2ch-1-36',
    'Writings',
    '2CH',
    '2 Chronicles',
    1,
    36,
    170,
    true,
    513,
    3,
    15,
    'Solomon, Judah''s kings, reform and apostasy, exile, and return: the historical frame for prophetic warning and restoration.'
  ),
  (
    'ezr-1-10',
    'Writings',
    'EZR',
    'Ezra',
    1,
    10,
    180,
    true,
    513,
    3,
    15,
    'Return from Babylon, rebuilding the temple, covenant renewal, and restored worship.'
  ),
  (
    'neh-1-13',
    'Writings',
    'NEH',
    'Nehemiah',
    1,
    13,
    190,
    true,
    513,
    3,
    15,
    'Jerusalem''s walls, opposition, communal reform, covenant renewal, and post-exilic restoration.'
  )
on conflict (unit_key) do update set
  section = excluded.section,
  book_code = excluded.book_code,
  label = excluded.label,
  start_chapter = excluded.start_chapter,
  end_chapter = excluded.end_chapter,
  sequence_order = excluded.sequence_order,
  is_foundation = excluded.is_foundation,
  baseline_display_score_required =
    excluded.baseline_display_score_required,
  min_answers_required = excluded.min_answers_required,
  retest_question_target = excluded.retest_question_target,
  focus_text = excluded.focus_text;

notify pgrst, 'reload schema';

commit;
