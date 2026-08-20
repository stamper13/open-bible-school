-- Read-only helper for function cleanup reviews.
--
-- Usage:
--   1. Put the app-facing or otherwise known-live function signatures in
--      seed_functions below.
--   2. Run this against the live database.
--   3. Treat every row returned as reachable before dropping any function.
--
-- pg_depend catches parser-visible function references. The definition text
-- columns are included because dynamic SQL and some PL/pgSQL rewrites can hide
-- dependencies from the catalog; they make review cheap instead of magical.

with recursive seed_functions(signature) as (
  values
    ('public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure),
    ('public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure),
    ('public.obs_get_next_ot_assessment_question(uuid)'::regprocedure),
    ('public.obs_get_bli_scores_v2(uuid)'::regprocedure),
    ('public.obs_get_user_recommendation_v2(uuid)'::regprocedure)
),
function_edges as (
  select distinct
    caller.oid as caller_oid,
    caller.oid::regprocedure as caller_signature,
    callee.oid as callee_oid,
    callee.oid::regprocedure as callee_signature
  from pg_depend dep
  join pg_proc caller
    on caller.oid = dep.objid
  join pg_proc callee
    on callee.oid = dep.refobjid
  where dep.classid = 'pg_proc'::regclass
    and dep.refclassid = 'pg_proc'::regclass
    and caller.pronamespace = 'public'::regnamespace
    and callee.pronamespace = 'public'::regnamespace
    and caller.oid <> callee.oid
),
reachable as (
  select
    seed.signature::oid as function_oid,
    seed.signature as signature,
    array[seed.signature::text] as path
  from seed_functions seed

  union all

  select
    edge.callee_oid,
    edge.callee_signature,
    reachable.path || edge.callee_signature::text
  from reachable
  join function_edges edge
    on edge.caller_oid = reachable.function_oid
  where not edge.callee_signature::text = any(reachable.path)
),
deduped as (
  select distinct on (signature)
    signature,
    path
  from reachable
  order by signature, cardinality(path)
)
select
  signature,
  cardinality(path) - 1 as dependency_depth,
  array_to_string(path, ' -> ') as reachability_path,
  obj_description(signature::oid) as function_comment,
  pg_get_functiondef(signature::oid) as function_definition
from deduped
order by dependency_depth, signature::text;
