-- Restore the universal historical-Writings gate and prior recommendation RPC.

begin;

do $$
declare
  function_definition text;
  unit_rows jsonb;
begin
  select definition
  into function_definition
  from public.obs_schema_backups
  where backup_tag =
      '20260728_conditional_prophetic_recommendation_dependencies'
    and object_schema = 'public'
    and object_name = 'obs_get_user_recommendation_v2'
    and object_type = 'function';

  select definition::jsonb
  into unit_rows
  from public.obs_schema_backups
  where backup_tag =
      '20260728_conditional_prophetic_recommendation_dependencies'
    and object_schema = 'public'
    and object_name = 'obs_learning_units_conditional_history'
    and object_type = 'data';

  if function_definition is null
     or jsonb_array_length(coalesce(unit_rows, '[]'::jsonb)) <> 4
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Conditional prophetic-dependency rollback requires its function and four-unit backups.';
  end if;

  execute function_definition;

  update public.obs_learning_units unit
  set
    section = restored.row->>'section',
    book_code = restored.row->>'book_code',
    label = restored.row->>'label',
    start_chapter = (restored.row->>'start_chapter')::integer,
    end_chapter = (restored.row->>'end_chapter')::integer,
    sequence_order = (restored.row->>'sequence_order')::integer,
    is_foundation = (restored.row->>'is_foundation')::boolean,
    baseline_display_score_required =
      (restored.row->>'baseline_display_score_required')::integer,
    min_answers_required =
      (restored.row->>'min_answers_required')::integer,
    retest_question_target =
      (restored.row->>'retest_question_target')::integer,
    focus_text = restored.row->>'focus_text',
    created_at = (restored.row->>'created_at')::timestamptz
  from jsonb_array_elements(unit_rows) restored(row)
  where unit.unit_key = restored.row->>'unit_key';
end
$$;

drop table if exists
  public.obs_prophetic_recommendation_dependencies;

notify pgrst, 'reload schema';

commit;
