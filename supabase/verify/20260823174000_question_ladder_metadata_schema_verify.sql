do $$
declare
  v_failures jsonb;
begin
  with checks(name, ok) as (
    values
      (
        'ladder metadata table exists',
        to_regclass('public.obs_question_ladder_metadata') is not null
      ),
      (
        'ladder metadata table has RLS enabled',
        exists (
          select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = 'obs_question_ladder_metadata'
            and c.relrowsecurity
        )
      ),
      (
        'primary key exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_pkey'
            and constraint_row.contype = 'p'
        )
      ),
      (
        'granularity check exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_granularity_ck'
        )
      ),
      (
        'scope-level check exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_scope_level_ck'
        )
      ),
      (
        'depth-stage check exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_depth_stage_ck'
        )
      ),
      (
        'book foreign key exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_book_code_fkey'
            and constraint_row.contype = 'f'
        )
      ),
      (
        'unit foreign key exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_unit_key_fkey'
            and constraint_row.contype = 'f'
        )
      ),
      (
        'dimension foreign key exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conrelid = 'public.obs_question_ladder_metadata'::regclass
            and constraint_row.conname = 'obs_question_ladder_metadata_dimension_key_fkey'
            and constraint_row.contype = 'f'
        )
      ),
      (
        'anon cannot select ladder metadata directly',
        not has_table_privilege('anon', 'public.obs_question_ladder_metadata', 'select')
      ),
      (
        'authenticated cannot select ladder metadata directly',
        not has_table_privilege('authenticated', 'public.obs_question_ladder_metadata', 'select')
      ),
      (
        'service role can manage ladder metadata',
        has_table_privilege('service_role', 'public.obs_question_ladder_metadata', 'insert')
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: question ladder metadata schema verification failed: %', v_failures;
  end if;
end;
$$;
