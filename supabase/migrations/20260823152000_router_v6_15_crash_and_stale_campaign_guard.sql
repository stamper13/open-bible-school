-- Router v6, step 15: crash guard and stale-campaign cleanup.
--
-- Three unsupported drag-order questions reached the MCQ assessment flow and
-- were only quarantined after submit failures. Also, a Genesis 12-50 campaign
-- stayed open after the ladder had already moved that unit back to sufficient,
-- which could keep widening into a strong sibling unit.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.obs_router_campaign
  drop constraint if exists obs_router_campaign_closed_reason_check;

alter table public.obs_router_campaign
  add constraint obs_router_campaign_closed_reason_check
  check (
    closed_reason is null
    or closed_reason in (
      'bracketed',
      'budget_spent',
      'bank_exhausted',
      'resolved_strong',
      'superseded_by_reread',
      'stale_abandoned',
      'resolved_ladder_sufficient'
    )
  );

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql not like '%unsupported order response questions excluded from MCQ selector%' then
    v_sql := replace(
      v_sql,
$needle$
      and (
        (
          public.obs_is_order_response_question(question.question_type, question.payload)
          and jsonb_array_length(question.payload->'choices') between 3 and 5
        )
        or (
          not public.obs_is_order_response_question(question.question_type, question.payload)
          and jsonb_array_length(question.payload->'choices') = 4
          and coalesce(
            question.payload->>'correct_choice_id',
            question.payload->>'answer_id',
            question.payload->>'correctAnswerId'
          ) is not null
        )
      )
$needle$,
$replacement$
      -- unsupported order response questions excluded from MCQ selector
      and not public.obs_is_order_response_question(question.question_type, question.payload)
      and coalesce(question.payload->>'interaction_type', '') <> 'drag_order_v1'
      and jsonb_array_length(question.payload->'choices') = 4
      and coalesce(
        question.payload->>'correct_choice_id',
        question.payload->>'answer_id',
        question.payload->>'correctAnswerId'
      ) is not null
$replacement$
    );

    if v_sql = v_original
       or v_sql not like '%unsupported order response questions excluded from MCQ selector%' then
      raise exception using
        errcode = 'P0001',
        message = 'Could not patch fast OT selector to exclude unsupported order questions.';
    end if;

    execute v_sql;
  end if;
end
$migration$;

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql not like '%unsupported order response questions excluded before v6 ranking%' then
    v_sql := replace(
      v_sql,
$needle$
    from scored
  ),
  reranked as (
$needle$,
$replacement$
    from scored
    -- unsupported order response questions excluded before v6 ranking
    where not public.obs_is_order_response_question(scored.question_type, scored.payload)
      and coalesce(scored.payload->>'interaction_type', '') <> 'drag_order_v1'
  ),
  reranked as (
$replacement$
    );

    v_sql := replace(
      v_sql,
$needle$
          case
            when eligible.is_campaign_pick then eligible.candidate_stage
            else 0
          end,
          case
            when eligible.is_campaign_pick then -eligible.information_score
            else 0
          end,
$needle$,
$replacement$
          case
            when eligible.is_campaign_pick then eligible.candidate_stage
            else 0
          end,
          case
            when eligible.is_campaign_pick
              and public.obs_is_high_specificity_assessment_question(
                eligible.prompt,
                eligible.question_type,
                eligible.payload
              )
              then 1
            else 0
          end,
          case
            when eligible.is_campaign_pick then -eligible.information_score
            else 0
          end,
$replacement$
    );

    if v_sql = v_original
       or v_sql not like '%unsupported order response questions excluded before v6 ranking%'
       or v_sql not like '%obs_is_high_specificity_assessment_question(%' then
      raise exception using
        errcode = 'P0001',
        message = 'Could not patch v6 ranker for order exclusion and chapter-addressed demotion.';
    end if;

    execute v_sql;
  end if;
end
$migration$;

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_router_sync_campaign(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql not like '%Close a campaign whose unit is no longer the dashboard/focus gap%' then
    v_sql := replace(
      v_sql,
$needle$
    if v_campaign.id is not null then
      -- Record the stage boundary as it is discovered.
$needle$,
$replacement$
    if v_campaign.id is not null then
      -- Close a campaign whose unit is no longer the dashboard/focus gap.
      if v_campaign.unit_key is not null
         and exists (
           select 1
           from public.obs_get_ladder_state_v1(p_user_id) ladder
           where ladder.unit_key = v_campaign.unit_key
             and ladder.state <> 'insufficient_evidence'
             and ladder.answered >= ladder.required_answers
             and ladder.display_score >= ladder.required_score
         ) then
        update public.obs_router_campaign
        set phase = 'closed',
            closed_at = now(),
            closed_reason = 'resolved_ladder_sufficient',
            items_spent = coalesce(v_cell.answered, 0),
            last_advanced_at = now()
        where id = v_campaign.id
        returning * into v_campaign;

        v_campaign := null;
      end if;
    end if;

    if v_campaign.id is not null then
      -- Record the stage boundary as it is discovered.
$replacement$
    );

    if v_sql = v_original
       or v_sql not like '%resolved_ladder_sufficient%' then
      raise exception using
        errcode = 'P0001',
        message = 'Could not patch router campaign sync stale-unit closure.';
    end if;

    execute v_sql;
  end if;
end
$migration$;

comment on function public.obs_get_next_ot_baseline_question_fast(uuid, uuid) is
  'Fast OT baseline selector with unsupported order-response questions excluded from the MCQ path, retake novelty, section balancing, and duplicate suppression.';

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Excludes unsupported order-response questions before ranking, demotes chapter-addressed high-specificity items inside campaigns, closes dashboard foundation gaps ahead of campaigns, and promotes phase-matching campaign evidence subject to per-attempt caps. STABLE: writes nothing.';

comment on function public.obs_router_sync_campaign(uuid, uuid) is
  'Synchronizes OT router campaigns, including stale campaign closure when the target unit is already sufficient on the ladder.';

notify pgrst, 'reload schema';

commit;
