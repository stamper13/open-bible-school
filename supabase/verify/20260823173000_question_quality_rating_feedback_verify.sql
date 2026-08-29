do $$
declare
  v_missing jsonb;
begin
  with checks(name, ok) as (
    values
      (
        'ratings table exists',
        to_regclass('public.obs_question_quality_ratings') is not null
      ),
      (
        'ratings table has RLS enabled',
        exists (
          select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = 'obs_question_quality_ratings'
            and c.relrowsecurity
        )
      ),
      (
        'rating check constraint exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conname = 'obs_question_quality_ratings_rating_ck'
            and constraint_row.conrelid = 'public.obs_question_quality_ratings'::regclass
        )
      ),
      (
        'one rating per user attempt question constraint exists',
        exists (
          select 1
          from pg_constraint constraint_row
          where constraint_row.conname = 'obs_question_quality_ratings_once_per_attempt_question_uk'
            and constraint_row.conrelid = 'public.obs_question_quality_ratings'::regclass
        )
      ),
      (
        'rating RPC exists',
        to_regprocedure(
          'public.obs_submit_question_quality_rating(uuid,uuid,smallint,text,text,text,text)'
        ) is not null
      ),
      (
        'rating RPC search_path pinned',
        exists (
          select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'obs_submit_question_quality_rating'
            and p.proconfig @> array['search_path=public']
        )
      ),
      (
        'anon cannot execute rating RPC',
        not has_function_privilege(
          'anon',
          'public.obs_submit_question_quality_rating(uuid,uuid,smallint,text,text,text,text)',
          'execute'
        )
      ),
      (
        'authenticated can execute rating RPC',
        has_function_privilege(
          'authenticated',
          'public.obs_submit_question_quality_rating(uuid,uuid,smallint,text,text,text,text)',
          'execute'
        )
      ),
      (
        'anon cannot insert ratings directly',
        not has_table_privilege('anon', 'public.obs_question_quality_ratings', 'insert')
      ),
      (
        'authenticated cannot insert ratings directly',
        not has_table_privilege('authenticated', 'public.obs_question_quality_ratings', 'insert')
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_missing
  from checks;

  if jsonb_array_length(v_missing) > 0 then
    raise exception 'FAIL: question quality rating feedback verification failed: %', v_missing;
  end if;
end;
$$;
