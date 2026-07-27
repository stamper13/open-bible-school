-- Curate Genesis 1-11 retest stages and prevent hard-stage fallback.
--
-- The first live adaptive retest exposed three distinct problems:
--   * legacy "outline" question types were mislabeled as Cross Ref;
--   * event difficulty made several broad facts look like hard items;
--   * once genuine detail items were exhausted, the selector fell back to
--     easier questions instead of completing the retest.

begin;

do $$
begin
  if to_regclass('public.obs_question_dimension_overrides') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_ot_assessment_question(uuid)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Genesis retest curation preflight failed; required contracts are missing.';
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
  '20260726_genesis_retest_stage_curation',
  'public',
  object_row.object_name,
  'function',
  pg_get_functiondef(object_row.signature::regprocedure)
from (
  values
    (
      'obs_focused_item_stage',
      'public.obs_focused_item_stage(text,jsonb,double precision)'
    ),
    (
      'obs_get_next_focused_question_v2',
      'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
    ),
    (
      'obs_get_next_ot_assessment_question',
      'public.obs_get_next_ot_assessment_question(uuid)'
    )
) object_row(object_name, signature)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_retest_stage_curation'
    and backup.object_schema = 'public'
    and backup.object_name = object_row.object_name
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
  '20260726_genesis_retest_stage_curation',
  'public',
  'ot_generated_questions_gen_1_11_retest_payloads',
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
  '1f3f6079-04d4-4b5f-95ae-ebe574fcd1cc'::uuid,
  'a5734548-f565-440e-a7a5-684baa24d500'::uuid,
  'eb04b513-bd1e-4a19-8bef-b2723ae348e0'::uuid,
  '0c5f91a1-cfdc-431c-b940-e04ad38f298b'::uuid,
  '6e4e68c5-aa2f-44cb-a5b2-8a0c4e2260e6'::uuid,
  '86a2b9a7-99dd-489c-8dc4-7d345cdcf1e3'::uuid,
  '62278155-4684-46fa-8402-e984bcf5e274'::uuid,
  'f4cfa226-32ff-4a7d-8f61-2b7ad870bde7'::uuid,
  '706bfddc-8a9e-415b-9b42-5632c7ce0692'::uuid,
  '03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid,
  '1b9a8777-a6ad-4a17-a97a-195be4bd8049'::uuid,
  '0aa05a3d-7951-4fa5-947b-a02d9d057e91'::uuid,
  'f2d5635f-d68f-447d-b83b-a7cdd50f3694'::uuid,
  'be63586b-e619-4d74-81d5-f979a4d5d223'::uuid,
  '6f7b4baf-1e56-46a5-8d9d-245dd8554e7d'::uuid,
  'dca43d6c-b408-4c85-9c88-a4c93ea7d0e3'::uuid,
  '8d8b240d-ef39-465e-99a6-6b720c184dc7'::uuid,
  'ccc6e75a-265a-4826-8c07-d15dbd0a056c'::uuid,
  '6a26e1f8-9529-4b93-a007-4cd945161ca0'::uuid,
  '00b2a46a-acfc-461a-abb2-b3ed8840413a'::uuid,
  'bcdb6a3e-7606-4514-8fc9-036229f59279'::uuid,
  'b520adf4-f1ea-4d1b-8125-12163c8587a7'::uuid,
  '1326142f-cdfe-4465-84a0-dbfa39519c1d'::uuid,
  '7739e6aa-d74f-4d0d-8e72-7be09f717098'::uuid,
  'ee26ff51-a180-486c-b0df-69142434aeeb'::uuid,
  '2fba4da7-7849-400d-9487-2636be7f0a6f'::uuid,
  '027fd525-e789-41c6-8c24-c6bccfe4f2e3'::uuid,
  'aba95fa9-4d31-4607-a0b6-eb02bf48214a'::uuid,
  'a1b830db-472e-4a94-9c1b-b13d648ae85e'::uuid,
  'f625e17b-2357-43fa-a620-64727ee0f473'::uuid,
  'ebdb5a0e-d308-4464-8b55-4ad880962bec'::uuid,
  '038b1ebc-1d5f-4cf7-8368-7bf03f4b106c'::uuid
)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_retest_stage_curation'
    and backup.object_schema = 'public'
    and backup.object_name =
      'ot_generated_questions_gen_1_11_retest_payloads'
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
  '20260726_genesis_retest_stage_curation',
  'public',
  'obs_question_dimension_overrides_genesis_outline',
  'data',
  jsonb_agg(
    jsonb_build_object(
      'generated_question_id', curated.generated_question_id,
      'had_override', override.generated_question_id is not null,
      'dimension_key', override.dimension_key,
      'review_reason', override.review_reason,
      'updated_at', override.updated_at,
      'updated_by', override.updated_by
    )
    order by curated.generated_question_id
  )::text
from (
  values
    ('a5734548-f565-440e-a7a5-684baa24d500'::uuid),
    ('f4cfa226-32ff-4a7d-8f61-2b7ad870bde7'::uuid),
    ('706bfddc-8a9e-415b-9b42-5632c7ce0692'::uuid),
    ('03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid),
    ('1b9a8777-a6ad-4a17-a97a-195be4bd8049'::uuid),
    ('0aa05a3d-7951-4fa5-947b-a02d9d057e91'::uuid),
    ('f2d5635f-d68f-447d-b83b-a7cdd50f3694'::uuid),
    ('be63586b-e619-4d74-81d5-f979a4d5d223'::uuid),
    ('6f7b4baf-1e56-46a5-8d9d-245dd8554e7d'::uuid),
    ('dca43d6c-b408-4c85-9c88-a4c93ea7d0e3'::uuid)
) curated(generated_question_id)
left join public.obs_question_dimension_overrides override
  using (generated_question_id)
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_retest_stage_curation'
    and backup.object_schema = 'public'
    and backup.object_name =
      'obs_question_dimension_overrides_genesis_outline'
    and backup.object_type = 'data'
);

do $$
declare
  function_backups integer;
  data_backups integer;
begin
  select
    count(*) filter (where object_type = 'function'),
    count(*) filter (where object_type = 'data')
  into function_backups, data_backups
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_genesis_retest_stage_curation'
    and backup.object_schema = 'public';

  if function_backups <> 3 or data_backups <> 2 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Genesis retest backup failed: functions=%s/3 data=%s/2.',
        function_backups,
        data_backups
      );
  end if;
end
$$;

update public.ot_generated_questions question
set payload =
  question.payload
  || jsonb_build_object('retest_stage', curated.retest_stage)
  || case
       when curated.stem_family is null then '{}'::jsonb
       else jsonb_build_object('stem_family', curated.stem_family)
     end
from (
  values
    ('1f3f6079-04d4-4b5f-95ae-ebe574fcd1cc'::uuid, 'core', null),
    ('a5734548-f565-440e-a7a5-684baa24d500'::uuid, 'core', null),
    ('eb04b513-bd1e-4a19-8bef-b2723ae348e0'::uuid, 'core', null),
    ('0c5f91a1-cfdc-431c-b940-e04ad38f298b'::uuid, 'core', null),
    ('6e4e68c5-aa2f-44cb-a5b2-8a0c4e2260e6'::uuid, 'foundation', null),
    ('86a2b9a7-99dd-489c-8dc4-7d345cdcf1e3'::uuid, 'detail', 'gen_noah_age_flood'),
    ('62278155-4684-46fa-8402-e984bcf5e274'::uuid, 'detail', 'gen_noah_age_flood'),
    ('f4cfa226-32ff-4a7d-8f61-2b7ad870bde7'::uuid, 'foundation', null),
    ('706bfddc-8a9e-415b-9b42-5632c7ce0692'::uuid, 'foundation', null),
    ('03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid, 'foundation', null),
    ('1b9a8777-a6ad-4a17-a97a-195be4bd8049'::uuid, 'foundation', null),
    ('0aa05a3d-7951-4fa5-947b-a02d9d057e91'::uuid, 'foundation', null),
    ('f2d5635f-d68f-447d-b83b-a7cdd50f3694'::uuid, 'foundation', 'gen4_cain_abel_identity'),
    ('be63586b-e619-4d74-81d5-f979a4d5d223'::uuid, 'foundation', 'gen4_cain_abel_identity'),
    ('6f7b4baf-1e56-46a5-8d9d-245dd8554e7d'::uuid, 'detail', null),
    ('dca43d6c-b408-4c85-9c88-a4c93ea7d0e3'::uuid, 'foundation', null),
    ('8d8b240d-ef39-465e-99a6-6b720c184dc7'::uuid, 'core', null),
    ('ccc6e75a-265a-4826-8c07-d15dbd0a056c'::uuid, 'core', 'gen_noah_pre_flood_command'),
    ('6a26e1f8-9529-4b93-a007-4cd945161ca0'::uuid, 'core', 'gen_noah_pre_flood_command'),
    ('00b2a46a-acfc-461a-abb2-b3ed8840413a'::uuid, 'foundation', 'gen_creation_humanity_command'),
    ('bcdb6a3e-7606-4514-8fc9-036229f59279'::uuid, 'core', 'gen_eden_tree_command'),
    ('b520adf4-f1ea-4d1b-8125-12163c8587a7'::uuid, 'core', null),
    ('1326142f-cdfe-4465-84a0-dbfa39519c1d'::uuid, 'foundation', null),
    ('7739e6aa-d74f-4d0d-8e72-7be09f717098'::uuid, 'detail', null),
    ('ee26ff51-a180-486c-b0df-69142434aeeb'::uuid, 'foundation', null),
    ('2fba4da7-7849-400d-9487-2636be7f0a6f'::uuid, 'foundation', null),
    ('027fd525-e789-41c6-8c24-c6bccfe4f2e3'::uuid, 'core', 'gen_eden_tree_command'),
    ('aba95fa9-4d31-4607-a0b6-eb02bf48214a'::uuid, 'foundation', 'gen_creation_humanity_command'),
    ('a1b830db-472e-4a94-9c1b-b13d648ae85e'::uuid, 'detail', null),
    ('f625e17b-2357-43fa-a620-64727ee0f473'::uuid, 'detail', null),
    ('ebdb5a0e-d308-4464-8b55-4ad880962bec'::uuid, 'core', null),
    ('038b1ebc-1d5f-4cf7-8368-7bf03f4b106c'::uuid, 'foundation', null)
) curated(generated_question_id, retest_stage, stem_family)
where question.id = curated.generated_question_id;

insert into public.obs_question_dimension_overrides (
  generated_question_id,
  dimension_key,
  review_reason,
  updated_at,
  updated_by
)
select
  curated.generated_question_id,
  curated.dimension_key,
  '20260726 Genesis outline review: ordinary event and character facts are not cross-reference questions.',
  now(),
  null
from (
  values
    ('a5734548-f565-440e-a7a5-684baa24d500'::uuid, 'characters_lineage'),
    ('f4cfa226-32ff-4a7d-8f61-2b7ad870bde7'::uuid, 'events_timeline'),
    ('706bfddc-8a9e-415b-9b42-5632c7ce0692'::uuid, 'events_timeline'),
    ('03fb9053-9604-4cfd-863b-a99afe4c9693'::uuid, 'events_timeline'),
    ('1b9a8777-a6ad-4a17-a97a-195be4bd8049'::uuid, 'characters_lineage'),
    ('0aa05a3d-7951-4fa5-947b-a02d9d057e91'::uuid, 'characters_lineage'),
    ('f2d5635f-d68f-447d-b83b-a7cdd50f3694'::uuid, 'characters_lineage'),
    ('be63586b-e619-4d74-81d5-f979a4d5d223'::uuid, 'characters_lineage'),
    ('6f7b4baf-1e56-46a5-8d9d-245dd8554e7d'::uuid, 'characters_lineage'),
    ('dca43d6c-b408-4c85-9c88-a4c93ea7d0e3'::uuid, 'characters_lineage')
) curated(generated_question_id, dimension_key)
on conflict (generated_question_id) do update set
  dimension_key = excluded.dimension_key,
  review_reason = excluded.review_reason,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

create or replace function public.obs_focused_item_stage(
  p_question_type text,
  p_payload jsonb,
  p_effective_irt_b double precision
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when lower(coalesce(p_payload->>'retest_stage', '')) in (
        'foundation', 'easy', '1'
      ) then 1
    when lower(coalesce(p_payload->>'retest_stage', '')) in (
        'core', 'core knowledge', 'medium', '2'
      ) then 2
    when lower(coalesce(p_payload->>'retest_stage', '')) in (
        'detail', 'detail and synthesis', 'hard', '3'
      ) then 3
    when coalesce(p_question_type, '') = 'book_orientation_mcq_v1'
      or lower(coalesce(p_payload->>'assessment_role', '')) in (
        'book_orientation', 'foundation', 'baseline'
      )
      or coalesce(p_effective_irt_b, 0.0) <= -0.75
      or public.obs_payload_number(
        coalesce(p_payload, '{}'::jsonb),
        'difficulty_estimate'
      ) <= 480
      then 1
    when lower(coalesce(p_question_type, '')) like '%significance%'
      or lower(coalesce(p_question_type, '')) like '%theological%'
      or lower(coalesce(p_question_type, '')) like '%cross_ref%'
      or lower(coalesce(p_question_type, '')) like '%crossref%'
      or coalesce(p_question_type, '') = 'sequence_order_v1'
      or coalesce(p_effective_irt_b, 0.0) > 0.50
      or public.obs_payload_number(
        coalesce(p_payload, '{}'::jsonb),
        'difficulty_estimate'
      ) > 560
      then 3
    else 2
  end;
$$;

do $$
declare
  function_definition text;
  old_stage_anchor text :=
    E'      ) as difficulty_stage,\n      coalesce(history.times_answered, 0) as times_answered,';
  new_stage_anchor text :=
    E'      ) as difficulty_stage,\n      public.obs_effective_item_irt_b(\n        question.payload,\n        event.irt_b::double precision\n      ) as effective_irt_b,\n      coalesce(history.times_answered, 0) as times_answered,';
  old_filter_anchor text :=
    E'    where not candidate.answered_in_attempt\n      and not exists (';
  new_filter_anchor text :=
    E'    where not candidate.answered_in_attempt\n      and (\n        desired.difficulty_stage <> 3\n        or candidate.difficulty_stage = 3\n      )\n      and not exists (';
  old_order_anchor text :=
    E'      candidate.last_answered_at nulls first,\n      coalesce(';
  new_order_anchor text :=
    E'      candidate.last_answered_at nulls first,\n      candidate.effective_irt_b,\n      coalesce(';
begin
  select pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  )
  into function_definition;

  if length(function_definition)
       - length(replace(function_definition, old_stage_anchor, ''))
       <> length(old_stage_anchor)
     or length(function_definition)
       - length(replace(function_definition, old_filter_anchor, ''))
       <> length(old_filter_anchor)
     or length(function_definition)
       - length(replace(function_definition, old_order_anchor, ''))
       <> length(old_order_anchor)
  then
    raise exception using
      errcode = 'P0001',
      message = 'Focused selector patch anchors did not each match exactly once.';
  end if;

  function_definition := replace(
    function_definition,
    old_stage_anchor,
    new_stage_anchor
  );
  function_definition := replace(
    function_definition,
    old_filter_anchor,
    new_filter_anchor
  );
  function_definition := replace(
    function_definition,
    old_order_anchor,
    new_order_anchor
  );

  execute function_definition;
end
$$;

create or replace function public.obs_get_next_ot_assessment_question(
  p_attempt_id uuid
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
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row record;
  question_row record;
  answered_total integer;
begin
  select
    attempt.id,
    attempt.user_id,
    attempt.assessment_kind,
    attempt.target_question_count as original_target,
    context.unit_key,
    context.book_code,
    context.start_chapter,
    context.end_chapter,
    context.dimension_key
  into attempt_row
  from public.assessment_attempts attempt
  left join public.obs_ot_attempt_context context
    on context.attempt_id = attempt.id
   and context.user_id = attempt.user_id
  where attempt.id = p_attempt_id
    and attempt.user_id = auth.uid()
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if not found then
    return;
  end if;

  if attempt_row.assessment_kind = 'ot_adaptive' then
    return query
    select adaptive.*
    from public.get_next_assessment_question(
      attempt_row.id,
      attempt_row.user_id
    ) adaptive
    limit 1;
    return;
  end if;

  select focused.*
  into question_row
  from public.obs_get_next_focused_question_v2(
    attempt_row.user_id,
    attempt_row.id,
    attempt_row.unit_key,
    attempt_row.book_code,
    attempt_row.start_chapter,
    attempt_row.end_chapter,
    attempt_row.dimension_key
  ) focused
  limit 1;

  if found then
    return query
    select
      question_row.out_generated_question_id::uuid,
      question_row.prompt::text,
      question_row.question_type::text,
      question_row.choices::jsonb,
      question_row.event_title::text,
      question_row.book_code::text,
      question_row.importance_tier::integer,
      question_row.section::text;
    return;
  end if;

  select count(*)::integer
  into answered_total
  from public.assessment_answers answer
  where answer.attempt_id = attempt_row.id
    and answer.user_id = attempt_row.user_id;

  if answered_total > 0 then
    update public.assessment_attempts
    set
      question_target = answered_total,
      target_question_count = answered_total,
      total_count = answered_total,
      answered_count = answered_total,
      is_complete = true,
      completed_at = coalesce(completed_at, now())
    where id = attempt_row.id;

    insert into public.obs_study_plan_events (
      user_id,
      unit_key,
      event_type,
      attempt_id,
      metadata
    )
    select
      attempt_row.user_id,
      attempt_row.unit_key,
      'retest_completed',
      attempt_row.id,
      jsonb_build_object(
        'source', 'focused_assessment_stage_exhaustion',
        'answered_count', answered_total,
        'original_target', attempt_row.original_target
      )
    where not exists (
      select 1
      from public.obs_study_plan_events event
      where event.user_id = attempt_row.user_id
        and event.attempt_id = attempt_row.id
        and event.event_type = 'retest_completed'
    );
  end if;

  return;
end;
$$;

revoke all on function public.obs_get_next_ot_assessment_question(uuid)
  from public, anon;
grant execute on function public.obs_get_next_ot_assessment_question(uuid)
  to authenticated, service_role;

comment on function public.obs_get_next_ot_assessment_question(uuid) is
  'Returns the next OT item and completes a focused retest when its genuine detail-stage pool is exhausted.';

notify pgrst, 'reload schema';

commit;
