-- Restore the recommendation learning units from the pre-gateway snapshot.

begin;

do $$
declare
  backup_rows jsonb;
begin
  select definition::jsonb
  into backup_rows
  from public.obs_schema_backups
  where backup_tag =
      '20260728_recommendation_historical_spine_gateway'
    and object_schema = 'public'
    and object_name = 'obs_learning_units_historical_spine'
    and object_type = 'data';

  if jsonb_array_length(coalesce(backup_rows, '[]'::jsonb)) <> 6 then
    raise exception using
      errcode = 'P0001',
      message =
        'Historical-spine rollback requires the six-unit data snapshot.';
  end if;

  delete from public.obs_learning_units unit
  using jsonb_array_elements(backup_rows) restored(item)
  where unit.unit_key = restored.item->>'unit_key'
    and not (restored.item->>'had_row')::boolean;

  update public.obs_learning_units unit
  set
    section = restored.item->'row'->>'section',
    book_code = restored.item->'row'->>'book_code',
    label = restored.item->'row'->>'label',
    start_chapter =
      (restored.item->'row'->>'start_chapter')::integer,
    end_chapter =
      (restored.item->'row'->>'end_chapter')::integer,
    sequence_order =
      (restored.item->'row'->>'sequence_order')::integer,
    is_foundation =
      (restored.item->'row'->>'is_foundation')::boolean,
    baseline_display_score_required =
      (
        restored.item->'row'->>'baseline_display_score_required'
      )::integer,
    min_answers_required =
      (restored.item->'row'->>'min_answers_required')::integer,
    retest_question_target =
      (restored.item->'row'->>'retest_question_target')::integer,
    focus_text = restored.item->'row'->>'focus_text',
    created_at =
      (restored.item->'row'->>'created_at')::timestamptz
  from jsonb_array_elements(backup_rows) restored(item)
  where unit.unit_key = restored.item->>'unit_key'
    and (restored.item->>'had_row')::boolean;
end
$$;

notify pgrst, 'reload schema';

commit;
