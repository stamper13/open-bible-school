-- Verifies the intentional client-executable SECURITY DEFINER surface.
-- Update this snapshot only after reviewing the function body, auth checks,
-- search_path, and grants for the changed function.

do $$
declare
  v_unexpected jsonb;
  v_missing jsonb;
  v_unpinned jsonb;
begin
  with expected(signature, role_name) as (
    values
      ('public.obs_book_section(text)', 'anon'),
      ('public.obs_book_testament(text)', 'anon'),
      ('public.obs_get_biblical_taxonomy()', 'anon'),
      ('public.obs_get_current_focus_path(uuid)', 'anon'),
      ('public.obs_get_ladder_state_v1(uuid)', 'anon'),
      ('public.obs_get_outline_node_mastery_score(uuid,uuid)', 'anon'),
      ('public.obs_get_public_question_metadata(integer,integer)', 'anon'),
      ('public.obs_get_random_starfield_passage()', 'anon'),
      ('public.obs_get_scope_summary(uuid,text,text)', 'anon'),
      ('public.obs_skip_broken_assessment_question(uuid,uuid,text,text,jsonb)', 'anon'),
      ('public.obs_submit_section_sort_answers(uuid,uuid,jsonb)', 'anon'),
      ('public.get_next_assessment_question(uuid,uuid)', 'authenticated'),
      ('public.get_next_scoped_assessment_question(uuid,uuid)', 'authenticated'),
      ('public.migrate_anonymous_data(uuid,uuid)', 'authenticated'),
      ('public.obs_backfill_assessment_snapshots(uuid)', 'authenticated'),
      ('public.obs_book_section(text)', 'authenticated'),
      ('public.obs_book_testament(text)', 'authenticated'),
      ('public.obs_claim_anonymous_transfer(text)', 'authenticated'),
      ('public.obs_compute_scoped_bli(uuid,text,timestamp with time zone)', 'authenticated'),
      ('public.obs_get_attempt_review(uuid,uuid)', 'authenticated'),
      ('public.obs_get_attempt_summary(uuid,uuid)', 'authenticated'),
      ('public.obs_get_biblical_taxonomy()', 'authenticated'),
      ('public.obs_get_bli_scores_v2(uuid)', 'authenticated'),
      ('public.obs_get_bli_section_followup_v1(uuid,text)', 'authenticated'),
      ('public.obs_get_bli_uncertainty(uuid,text)', 'authenticated'),
      ('public.obs_get_current_focus_path(uuid)', 'authenticated'),
      ('public.obs_get_ladder_state_v1(uuid)', 'authenticated'),
      ('public.obs_mark_unit_reread(uuid,text,text)', 'authenticated'),
      ('public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)', 'authenticated'),
      ('public.obs_get_next_nt_assessment_question(uuid)', 'authenticated'),
      ('public.obs_get_next_ot_assessment_question(uuid)', 'authenticated'),
      ('public.obs_get_next_ot_baseline_question_fast(uuid,uuid)', 'authenticated'),
      ('public.obs_get_nt_assessment_status(uuid)', 'authenticated'),
      ('public.obs_get_ot_assessment_status(uuid)', 'authenticated'),
      ('public.obs_get_outline_node_mastery_score(uuid,uuid)', 'authenticated'),
      ('public.obs_get_progress_history(uuid,text,integer)', 'authenticated'),
      ('public.obs_get_public_question_metadata(integer,integer)', 'authenticated'),
      ('public.obs_get_random_starfield_passage()', 'authenticated'),
      ('public.obs_get_scope_summary(uuid,text,text)', 'authenticated'),
      ('public.obs_get_unit_mastery_score(uuid,text,text)', 'authenticated'),
      ('public.obs_get_user_recommendation_pre_ladder(uuid)', 'authenticated'),
      ('public.obs_get_user_recommendation_v2(uuid)', 'authenticated'),
      ('public.obs_issue_anonymous_transfer_token()', 'authenticated'),
      ('public.obs_recompute_versioned_score(uuid,text,integer,timestamp with time zone)', 'authenticated'),
      ('public.obs_record_study_event(uuid,text,text,uuid,jsonb)', 'authenticated'),
      ('public.obs_set_attempt_scoring_version_v2(uuid)', 'authenticated'),
      ('public.obs_skip_broken_assessment_question(uuid,uuid,text,text,jsonb)', 'authenticated'),
      ('public.obs_start_nt_assessment(text,text,integer)', 'authenticated'),
      ('public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)', 'authenticated'),
      ('public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)', 'authenticated'),
      ('public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)', 'authenticated'),
      ('public.obs_submit_nt_assessment_answer(uuid,uuid,text)', 'authenticated'),
      ('public.obs_submit_ot_assessment_answer(uuid,uuid,text)', 'authenticated'),
      ('public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)', 'authenticated'),
      ('public.obs_submit_question_quality_rating(uuid,uuid,smallint,text,text,text,text)', 'authenticated'),
      ('public.obs_submit_section_sort_answers(uuid,uuid,jsonb)', 'authenticated')
  ), actual(signature, role_name) as (
    select
      format('%I.%s', n.nspname, p.oid::regprocedure::text),
      roles.role_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) roles(role_name)
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege(roles.role_name, p.oid, 'execute')
  ), unexpected as (
    select * from actual
    except
    select * from expected
  ), missing as (
    select * from expected
    except
    select * from actual
  )
  select
    coalesce((select jsonb_agg(to_jsonb(unexpected) order by signature, role_name) from unexpected), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(missing) order by signature, role_name) from missing), '[]'::jsonb)
  into v_unexpected, v_missing;

  if jsonb_array_length(v_unexpected) > 0 then
    raise exception 'FAIL: unexpected client-executable SECURITY DEFINER grants: %', v_unexpected;
  end if;

  if jsonb_array_length(v_missing) > 0 then
    raise exception 'FAIL: expected client-executable SECURITY DEFINER grants are missing: %', v_missing;
  end if;

  select coalesce(jsonb_agg(format('%I.%s', n.nspname, p.oid::regprocedure::text) order by p.oid::regprocedure::text), '[]'::jsonb)
  into v_unpinned
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (
      p.proconfig is null
      or not exists (
        select 1
        from unnest(p.proconfig) config(value)
        where config.value like 'search_path=%'
      )
    );

  if jsonb_array_length(v_unpinned) > 0 then
    raise exception 'FAIL: SECURITY DEFINER functions without pinned search_path: %', v_unpinned;
  end if;
end;
$$;
