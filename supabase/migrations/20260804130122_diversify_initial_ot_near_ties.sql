-- Diversify the first OT question for genuinely new learners without weakening
-- the adaptive router after evidence exists.
--
-- Candidates within 0.005 of the best route-priority-zero score are
-- psychometrically near-equivalent at the session-fallback theta. Within that
-- band, use the existing attempt/question hash before the exact score. The same
-- attempt remains reproducible, while different attempts no longer all receive
-- the single numerically highest item.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
begin
  if to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception 'Initial OT near-tie diversification prerequisites are missing';
  end if;
end
$preconditions$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260804130122_diversify_initial_ot_near_ties',
  'public',
  'obs_rank_ot_assessment_candidates_v4',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260804130122_diversify_initial_ot_near_ties'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function'
);

do $install$
declare
  v_definition text;
  v_old_cte constant text := $old_cte$    from scored
  ),
  ranked as (
    select
      weighted.*,$old_cte$;
  v_new_cte constant text := $new_cte$    from scored
  ),
  opening_banded as (
    select
      weighted.*,
      max(adaptive_score) filter (
        where answered_total = 0
          and effective_theta_source = 'SESSION_FALLBACK'
          and route_priority = 0
      ) over () as opening_top_score
    from weighted
  ),
  ranked as (
    select
      opening_banded.*,$new_cte$;
  v_old_order constant text := $old_order$          adaptive_score desc,
          times_answered,
          last_answered_at nulls first,
          md5(p_attempt_id::text || ':' || generated_question_id::text)
      ) as resolved_rank
    from weighted$old_order$;
  v_new_order constant text := $new_order$          case
            when answered_total = 0
              and effective_theta_source = 'SESSION_FALLBACK'
              and route_priority = 0
              and adaptive_score >= opening_top_score - 0.005
              then 0
            else 1
          end,
          case
            when answered_total = 0
              and effective_theta_source = 'SESSION_FALLBACK'
              and route_priority = 0
              and adaptive_score >= opening_top_score - 0.005
              then md5(
                p_attempt_id::text || ':' || generated_question_id::text
              )
            else null
          end nulls last,
          adaptive_score desc,
          times_answered,
          last_answered_at nulls first,
          md5(p_attempt_id::text || ':' || generated_question_id::text)
      ) as resolved_rank
    from opening_banded$new_order$;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_definition;

  if strpos(v_definition, 'opening_top_score') > 0 then
    raise exception 'Initial OT near-tie diversification is already installed';
  end if;

  if strpos(v_definition, v_old_cte) = 0
     or strpos(v_definition, v_old_order) = 0
  then
    raise exception 'Live OT router ranking anchors changed; review instead of patching blindly';
  end if;

  v_definition := replace(v_definition, v_old_cte, v_new_cte);
  v_definition := replace(v_definition, v_old_order, v_new_order);

  execute v_definition;
end
$install$;

do $postconditions$
declare
  v_definition text := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );
  v_backup_count integer;
begin
  select count(*)
  into v_backup_count
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260804130122_diversify_initial_ot_near_ties'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function';

  if v_backup_count <> 1 then
    raise exception 'Expected one OT router backup, found %', v_backup_count;
  end if;

  if strpos(v_definition, 'opening_top_score') = 0
     or strpos(v_definition, 'opening_top_score - 0.005') = 0
     or strpos(v_definition, 'from opening_banded') = 0
  then
    raise exception 'Initial OT near-tie diversification was not installed';
  end if;

  if has_function_privilege(
       'anon',
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)',
       'execute'
     )
  then
    raise exception 'OT router execute privileges changed unexpectedly';
  end if;
end
$postconditions$;

comment on function public.obs_rank_ot_assessment_candidates_v4(
  uuid, uuid, text, integer, timestamptz, integer
) is
'Ranks OT adaptive candidates. For a genuinely new session-fallback learner, route-priority-zero candidates within 0.005 of the top score are diversified deterministically by attempt ID; evidence-bearing routing remains exact-score ordered.';

notify pgrst, 'reload schema';

commit;
