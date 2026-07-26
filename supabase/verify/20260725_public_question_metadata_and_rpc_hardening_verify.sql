do $$
declare
  v_columns text[];
  v_unsafe_column_count integer;
begin
  if to_regprocedure(
    'public.obs_get_public_question_metadata(integer,integer)'
  ) is null then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: obs_get_public_question_metadata is missing.';
  end if;

  select array_agg(key order by key)
  into v_columns
  from (
    select jsonb_object_keys(to_jsonb(metadata_row)) as key
    from public.obs_get_public_question_metadata(0, 1) metadata_row
  ) keys;

  if v_columns is distinct from array[
    'book_code',
    'dimension_key',
    'generated_question_id',
    'importance_conceptual',
    'importance_context',
    'question_layer',
    'question_type',
    'routing_score'
  ]::text[] then
    raise exception using
      errcode = 'P0001',
      message = format(
        'VERIFY FAILED: unexpected public metadata columns: %s',
        coalesce(array_to_string(v_columns, ', '), '<none>')
      );
  end if;

  select count(*)
  into v_unsafe_column_count
  from unnest(v_columns) column_name
  where column_name ilike '%answer%'
     or column_name ilike '%choice%'
     or column_name in ('payload', 'prompt');

  if v_unsafe_column_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: public metadata exposes an answer-bearing column.';
  end if;

  if has_table_privilege('anon', 'public.ot_generated_questions', 'select')
     or has_table_privilege('anon', 'public.v_question_bank', 'select')
     or has_table_privilege('anon', 'public.obs_question_bank_with_dimensions', 'select')
     or has_table_privilege('authenticated', 'public.ot_generated_questions', 'select')
     or has_table_privilege('authenticated', 'public.v_question_bank', 'select')
     or has_table_privilege('authenticated', 'public.obs_question_bank_with_dimensions', 'select')
  then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: a raw answer-bearing question surface remains readable.';
  end if;

  if not has_function_privilege(
       'anon',
       'public.obs_get_public_question_metadata(integer,integer)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.obs_get_public_question_metadata(integer,integer)',
       'execute'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: the safe metadata RPC is not available to the frontend.';
  end if;

  if has_function_privilege('anon', 'public.compute_bli(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.compute_bli(uuid)', 'execute')
     or has_function_privilege(
       'authenticated',
       'public.update_theta_internal(uuid,text,uuid,boolean)',
       'execute'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: scoring function privileges are not hardened.';
  end if;

  if to_regprocedure('public.nt_submit_pilot_answer(uuid,text)') is not null
     and (
       has_function_privilege(
         'anon',
         'public.nt_submit_pilot_answer(uuid,text)',
         'execute'
       )
       or has_function_privilege(
         'authenticated',
         'public.nt_submit_pilot_answer(uuid,text)',
         'execute'
       )
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'VERIFY FAILED: the legacy NT grading oracle remains executable.';
  end if;

  raise notice
    'PASS: public question metadata is answer-free and scoring RPC privileges are hardened.';
end
$$;

-- This is a real role-level execution check, not only a privilege-table check.
begin;
set local role anon;
select count(*) as public_metadata_rows_sampled
from public.obs_get_public_question_metadata(0, 1);
rollback;
