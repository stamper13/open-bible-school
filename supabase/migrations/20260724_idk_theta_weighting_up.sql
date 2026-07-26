-- =====================================================================
-- 20260724_idk_theta_weighting
-- =====================================================================
-- Ratified scope:
--   * update_theta_internal ONLY. No other function is touched.
--   * IDK responses enter the 2PL EAP likelihood with r = 0 and
--     weight 0.25, via a weighted log-likelihood term.
--   * n_responses remains the RAW answer count -- IDK still counts as a
--     response. The reduced evidence generally increases uncertainty,
--     although individual theta_se direction is reported rather than
--     assumed because the posterior location also changes.
--   * Dial helpers (obs_effective_item_irt_a/b) are reused UNCHANGED.
--   * compute_bli is NOT touched: IDK there continues to earn zero while
--     remaining in the denominator.
--
-- WHY. Before this migration the history CTE read
-- `aa.is_correct::integer as r` and never referenced is_idk, so every
-- IDK answer entered theta as a full-confidence wrong answer -- a
-- stronger downward signal than intended.
--
-- PREDICTED IMPACT (measured 2026-07-24, pre-apply):
--   50 ability rows; 11 carry at least one in-scope IDK and should move,
--   39 carry none and MUST NOT move. By scope:
--     OT        12 rows,  3 with IDK, 12 IDK answers
--     BIBLE      6 rows,  2 with IDK, 11 IDK answers
--     FORMER     9 rows,  2 with IDK,  7 IDK answers
--     WRITINGS   6 rows,  2 with IDK,  2 IDK answers
--     LATTER     6 rows,  1 with IDK,  1 IDK answer
--     TORAH     11 rows,  1 with IDK,  1 IDK answer
--   Direction: theta should rise slightly for affected rows because the
--   IDK penalty softens from weight 1.0 to 0.25. theta_se is reported
--   separately; it is not required to move in one direction per row.
--
-- NOTE. Applying this migration does not itself rewrite stored theta.
-- Values update only when update_theta_internal is next called for a
-- pair. The one-time recomputation is a SEPARATE explicit step -- see
-- 20260724_idk_theta_recompute.sql. Do not fold it in here.
-- =====================================================================

do $$
declare
  v_def text;
begin
  if not exists (
    select 1 from public.obs_schema_backups
    where backup_tag = '20260724_idk_theta_weighting'
      and object_schema = 'public'
      and object_name = 'update_theta_internal'
      and object_type = 'function'
  ) then
    select pg_get_functiondef(
      to_regprocedure('public.update_theta_internal(uuid,text,uuid,boolean)')
    ) into v_def;

    if v_def is null then
      raise exception using errcode = 'P0001',
        message = 'update_theta_internal(uuid,text,uuid,boolean) not found; refusing to proceed.';
    end if;

    insert into public.obs_schema_backups (
      backup_tag, object_schema, object_name, object_type, definition
    ) values (
      '20260724_idk_theta_weighting', 'public',
      'update_theta_internal', 'function', v_def
    );
  end if;
end $$;

do $$
declare
  v_n integer;
begin
  select count(*) into v_n
  from public.obs_schema_backups
  where backup_tag = '20260724_idk_theta_weighting'
    and object_schema = 'public'
    and object_type = 'function'
    and object_name = 'update_theta_internal';

  if v_n <> 1 then
    raise exception using errcode = 'P0001',
      message = format(
        'Backup capture failed: expected exactly 1 update_theta_internal backup for tag 20260724_idk_theta_weighting, found %s. Aborting.',
        v_n
      );
  end if;
end $$;

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
as $$
declare
  -- Ratified 2026-07-23: an IDK response enters the 2PL likelihood as a
  -- wrong answer (r = 0) carrying only a quarter of the information of a
  -- genuine wrong answer. It is a weak downward signal, not a full one.
  idk_weight constant double precision := 0.25;
  v_scope text := upper(btrim(p_scope));
  v_books text[];
  v_theta double precision;
  v_se double precision;
  v_n integer;
begin
  v_books := case v_scope
    when 'BIBLE' then array[
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST',
      'JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL',
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM',
      'HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'
    ]
    when 'OT' then array[
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST',
      'JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'
    ]
    when 'NT' then array[
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM',
      'HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'
    ]
    when 'TORAH' then array['GEN','EXO','LEV','NUM','DEU']
    when 'FORMER' then array['JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST']
    when 'LATTER' then array['ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL']
    when 'WRITINGS' then array['JOB','PSA','PRO','ECC','SNG']
    when 'GOSPELS_ACTS' then array['MAT','MRK','LUK','JHN','ACT']
    when 'PAULINE' then array['ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM']
    when 'GENERAL' then array['HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD']
    when 'APOCALYPSE' then array['REV']
    else null
  end;

  if v_books is null then
    raise exception using
      errcode = '22023',
      message = format('Unsupported BLI ability scope: %s', coalesce(p_scope, '<null>'));
  end if;

  with hist as (
    select
      public.obs_effective_item_irt_a(
        qb.payload,
        be.irt_a::double precision
      ) as a,
      public.obs_effective_item_irt_b(
        qb.payload,
        be.irt_b::double precision
      ) as b,
      case when coalesce(aa.is_idk, false) then 0
           else aa.is_correct::integer
      end as r,
      case when coalesce(aa.is_idk, false) then idk_weight
           else 1.0::double precision
      end as wt
    from public.assessment_answers aa
    join public.ot_generated_questions oq
      on oq.id = aa.generated_question_id
    left join public.bible_events be
      on be.id = oq.event_id
    left join public.v_question_bank qb
      on qb.generated_question_id = oq.id
    where aa.user_id = p_user_id
      and aa.answered_at is not null
      and oq.question_type not like 'quarantined%'
      and upper(coalesce(be.book_code, qb.book_code)) = any(v_books)
  ), grid as (
    select generate_series(-40, 40)::double precision * 0.1 as th
  ), likelihood as (
    select
      gr.th,
      -0.5 * gr.th * gr.th
        + coalesce(sum(h.wt * (h.r * ln(h.pp) + (1 - h.r) * ln(1 - h.pp))), 0) as logpost
    from grid gr
    left join lateral (
      select
        hh.r,
        hh.wt,
        least(
          1 - 1e-9,
          greatest(1e-9, 1.0 / (1.0 + exp(-hh.a * (gr.th - hh.b))))
        ) as pp
      from hist hh
    ) h on true
    group by gr.th
  ), weights as (
    select th, exp(logpost - max(logpost) over ()) as wt
    from likelihood
  ), posterior as (
    select th, wt / sum(wt) over () as pr
    from weights
  ), mean_theta as (
    select sum(th * pr) as m
    from posterior
  )
  select m.m, sqrt(sum(power(p.th - m.m, 2) * p.pr))
  into v_theta, v_se
  from posterior p
  cross join mean_theta m
  group by m.m;

  select count(*)
  into v_n
  from public.assessment_answers aa
  join public.ot_generated_questions oq
    on oq.id = aa.generated_question_id
  left join public.bible_events be
    on be.id = oq.event_id
  left join public.v_question_bank qb
    on qb.generated_question_id = oq.id
  where aa.user_id = p_user_id
    and aa.answered_at is not null
    and oq.question_type not like 'quarantined%'
    and upper(coalesce(be.book_code, qb.book_code)) = any(v_books);

  insert into public.user_abilities (
    user_id, scope, theta, theta_se, n_responses, updated_at
  ) values (
    p_user_id,
    v_scope,
    coalesce(v_theta, 0.0),
    coalesce(v_se, 1.0),
    coalesce(v_n, 0),
    now()
  )
  on conflict (user_id, scope) do update
  set theta = excluded.theta,
      theta_se = excluded.theta_se,
      n_responses = excluded.n_responses,
      updated_at = now();
end;
$$;

notify pgrst, 'reload schema';
