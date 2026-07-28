-- Make broad chronology sequences available as core assessment items and
-- correct three dimension/prompt issues observed in live assessment review.

begin;

do $$
declare
  broad_sequence_count integer;
  song_count integer;
  psalm_count integer;
  elijah_count integer;
begin
  if to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_question_dimension_overrides') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Sequence/dimension correction prerequisites are missing; nothing changed.';
  end if;

  select count(*)::integer
  into broad_sequence_count
  from public.ot_generated_questions question
  where question.question_type = 'sequence_order_v1'
    and question.dedupe_key in (
      'sequence|GEN|abraham_early_life',
      'sequence|GEN|jacob_major_events',
      'sequence|EXO|exodus_to_sinai',
      'sequence|JOS|entry_into_canaan',
      'sequence|1SA|saul_to_david',
      'sequence|1KI|solomon_to_division'
    );

  select
    count(*) filter (
      where question.payload->>'prompt' =
        'Whose voices dominate the poetry of Song of Songs?'
    )::integer,
    count(*) filter (
      where question.payload->>'prompt' =
        'What contrast structures Psalm 1?'
    )::integer,
    count(*) filter (
      where question.payload->>'prompt' ilike
        'What pattern of ministry makes Elijah%both the OT and NT?'
    )::integer
  into song_count, psalm_count, elijah_count
  from public.ot_generated_questions question
  where question.question_type not like 'quarantined%';

  if broad_sequence_count <> 6
     or song_count <> 1
     or psalm_count <> 1
     or elijah_count <> 1
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected sequence/song/psalm/Elijah matches 6/1/1/1; found %s/%s/%s/%s.',
        broad_sequence_count,
        song_count,
        psalm_count,
        elijah_count
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
  '20260727_sequence_core_and_dimension_corrections',
  'public',
  'ot_generated_questions_payload',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'id', question.id,
      'payload', question.payload
    )
    order by question.id
  )::text
from public.ot_generated_questions question
where (
    question.dedupe_key in (
      'sequence|GEN|abraham_early_life',
      'sequence|GEN|jacob_major_events',
      'sequence|EXO|exodus_to_sinai',
      'sequence|JOS|entry_into_canaan',
      'sequence|1SA|saul_to_david',
      'sequence|1KI|solomon_to_division'
    )
    or question.payload->>'prompt' in (
      'Whose voices dominate the poetry of Song of Songs?',
      'What contrast structures Psalm 1?'
    )
    or question.payload->>'prompt' ilike
      'What pattern of ministry makes Elijah%both the OT and NT?'
  )
having not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag =
        '20260727_sequence_core_and_dimension_corrections'
      and backup.object_schema = 'public'
      and backup.object_name = 'ot_generated_questions_payload'
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
  '20260727_sequence_core_and_dimension_corrections',
  'public',
  'obs_question_dimension_overrides',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'id', question.id,
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
where (
    question.payload->>'prompt' in (
      'Whose voices dominate the poetry of Song of Songs?',
      'What contrast structures Psalm 1?'
    )
    or question.payload->>'prompt' ilike
      'What pattern of ministry makes Elijah%both the OT and NT?'
  )
having not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag =
        '20260727_sequence_core_and_dimension_corrections'
      and backup.object_schema = 'public'
      and backup.object_name = 'obs_question_dimension_overrides'
      and backup.object_type = 'data'
  );

do $$
declare
  payload_backup_count integer;
  override_backup_count integer;
  payload_row_count integer;
  override_row_count integer;
begin
  select count(*), max(jsonb_array_length(definition::jsonb))
  into payload_backup_count, payload_row_count
  from public.obs_schema_backups
  where backup_tag =
      '20260727_sequence_core_and_dimension_corrections'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions_payload'
    and object_type = 'data';

  select count(*), max(jsonb_array_length(definition::jsonb))
  into override_backup_count, override_row_count
  from public.obs_schema_backups
  where backup_tag =
      '20260727_sequence_core_and_dimension_corrections'
    and object_schema = 'public'
    and object_name = 'obs_question_dimension_overrides'
    and object_type = 'data';

  if payload_backup_count <> 1
     or override_backup_count <> 1
     or payload_row_count <> 9
     or override_row_count <> 3
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Backup assertion failed: payload backups/rows=%s/%s; override backups/rows=%s/%s.',
        payload_backup_count,
        payload_row_count,
        override_backup_count,
        override_row_count
      );
  end if;
end
$$;

update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            question.payload,
            '{retest_stage}',
            to_jsonb('core'::text),
            true
          ),
          '{question_layer}',
          to_jsonb('2'::text),
          true
        ),
        '{question_family}',
        to_jsonb('broad_event_sequence'::text),
        true
      ),
      '{knowledge_granularity}',
      to_jsonb('book_synthesis'::text),
      true
    ),
    '{baseline_eligible}',
    'true'::jsonb,
    true
  )
where question.question_type = 'sequence_order_v1'
  and question.dedupe_key in (
    'sequence|GEN|abraham_early_life',
    'sequence|GEN|jacob_major_events',
    'sequence|EXO|exodus_to_sinai',
    'sequence|JOS|entry_into_canaan',
    'sequence|1SA|saul_to_david',
    'sequence|1KI|solomon_to_division'
  );

update public.ot_generated_questions question
set payload = jsonb_set(
  question.payload,
  '{prompt}',
  to_jsonb(
    'What pattern of ministry makes Elijah a defining prophetic figure in Israel?'::text
  ),
  true
)
where question.question_type not like 'quarantined%'
  and question.payload->>'prompt' ilike
    'What pattern of ministry makes Elijah%both the OT and NT?';

update public.ot_generated_questions question
set payload = jsonb_set(
  question.payload,
  '{dimension_key}',
  to_jsonb(
    case
      when question.payload->>'prompt' in (
        'Whose voices dominate the poetry of Song of Songs?',
        'What contrast structures Psalm 1?'
      ) then 'theological_reasoning'
      else 'characters_lineage'
    end::text
  ),
  true
)
where question.question_type not like 'quarantined%'
  and (
    question.payload->>'prompt' in (
      'Whose voices dominate the poetry of Song of Songs?',
      'What contrast structures Psalm 1?',
      'What pattern of ministry makes Elijah a defining prophetic figure in Israel?'
    )
  );

insert into public.obs_question_dimension_overrides (
  generated_question_id,
  dimension_key,
  review_reason,
  updated_at,
  updated_by
)
select
  question.id,
  case
    when question.payload->>'prompt' in (
      'Whose voices dominate the poetry of Song of Songs?',
      'What contrast structures Psalm 1?'
    ) then 'theological_reasoning'
    else 'characters_lineage'
  end,
  '20260727 live review: literary reasoning is not cross-reference evidence; Elijah wording is OT-only.',
  now(),
  null
from public.ot_generated_questions question
where question.question_type not like 'quarantined%'
  and question.payload->>'prompt' in (
    'Whose voices dominate the poetry of Song of Songs?',
    'What contrast structures Psalm 1?',
    'What pattern of ministry makes Elijah a defining prophetic figure in Israel?'
  )
on conflict (generated_question_id) do update set
  dimension_key = excluded.dimension_key,
  review_reason = excluded.review_reason,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

notify pgrst, 'reload schema';

commit;
