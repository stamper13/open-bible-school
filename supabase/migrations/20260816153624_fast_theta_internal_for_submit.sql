-- Keep assessment submits inside the statement timeout.
--
-- update_theta_internal is called up to three times for one event-backed
-- answer: book/section scope, testament scope, and BIBLE. The previous version
-- rebuilt an 81-point posterior grid from joined answer history on every call,
-- which made curated OT answers time out during normal 40-question baselines.
--
-- The immutable BLI evidence/snapshot pipeline remains the source of the
-- formal BLI score. This function keeps the lightweight live ability row fresh
-- enough for routing and uncertainty UI without doing a full posterior fit in
-- the answer transaction.

begin;

do $$
begin
  if to_regprocedure('public.update_theta_internal(uuid,text,uuid,boolean)') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.bible_events') is null
     or to_regclass('public.user_abilities') is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Fast theta prerequisites are missing; no changes made.';
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
  '20260816154500_fast_theta_internal_for_submit',
  'public',
  'update_theta_internal',
  'function',
  pg_get_functiondef('public.update_theta_internal(uuid,text,uuid,boolean)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260816154500_fast_theta_internal_for_submit'
    and backup.object_schema = 'public'
    and backup.object_name = 'update_theta_internal'
    and backup.object_type = 'function'
);

create or replace function public.update_theta_internal(
  p_user_id uuid,
  p_scope text,
  p_event_id uuid,
  p_is_correct boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  idk_weight constant double precision := 0.25;
  v_scope text := upper(btrim(p_scope));
  v_books text[];
  v_n integer := 0;
  v_weighted_total double precision := 0.0;
  v_weighted_correct double precision := 0.0;
  v_theta double precision := 0.0;
  v_theta_se double precision := 1.0;
begin
  v_books := public.obs_book_codes_for_scope(v_scope);
  if v_books is null then
    raise exception using
      errcode = '22023',
      message = format('Unsupported BLI ability scope: %s', coalesce(p_scope, '<null>'));
  end if;

  with hist as (
    select
      coalesce(answer.is_idk, false) as is_idk,
      coalesce(answer.is_correct, false) as is_correct,
      case
        when coalesce(answer.is_idk, false) then idk_weight
        else 1.0::double precision
      end
      *
      case
        when public.obs_book_testament(upper(coalesce(event.book_code, question.payload->>'book_code'))) = 'NT'
          then coalesce(review.scoring_weight, 0.0)
        else 1.0::double precision
      end as response_weight
    from public.assessment_answers answer
    join public.ot_generated_questions question
      on question.id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    left join public.obs_nt_expository_item_reviews review
      on review.generated_question_id = question.id
    where answer.user_id = p_user_id
      and answer.scoring_eligible
      and answer.answered_at is not null
      and question.question_type not like 'quarantined%'
      and upper(coalesce(event.book_code, question.payload->>'book_code')) = any(v_books)
      and (
        public.obs_book_testament(upper(coalesce(event.book_code, question.payload->>'book_code'))) <> 'NT'
        or coalesce(review.scoring_weight, 0.0) > 0.0
      )
  )
  select
    count(*)::integer,
    coalesce(sum(response_weight), 0.0),
    coalesce(sum(case when is_correct and not is_idk then response_weight else 0.0 end), 0.0)
  into v_n, v_weighted_total, v_weighted_correct
  from hist;

  if v_weighted_total > 0 then
    v_theta := ln(
      (v_weighted_correct + 0.5)
      / greatest(v_weighted_total - v_weighted_correct + 0.5, 0.000001)
    );
    v_theta := least(4.0, greatest(-4.0, v_theta));
    v_theta_se := greatest(0.25, least(1.25, 1.0 / sqrt(v_weighted_total + 1.0)));
  end if;

  insert into public.user_abilities (
    user_id,
    scope,
    theta,
    theta_se,
    n_responses,
    updated_at
  ) values (
    p_user_id,
    v_scope,
    v_theta,
    v_theta_se,
    coalesce(v_n, 0),
    now()
  )
  on conflict (user_id, scope) do update
  set
    theta = excluded.theta,
    theta_se = excluded.theta_se,
    n_responses = excluded.n_responses,
    updated_at = now();
end;
$function$;

revoke all on function public.update_theta_internal(uuid, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.update_theta_internal(uuid, text, uuid, boolean)
  to service_role;

comment on function public.update_theta_internal(uuid, text, uuid, boolean) is
  'Fast live ability refresh for answer-submit paths; formal BLI scoring remains in immutable evidence and scoped snapshot functions.';

notify pgrst, 'reload schema';

commit;
