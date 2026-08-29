-- Restores get_next_assessment_question by removing the step-11 fast-selector
-- foundation-gap guard. Prefer rolling forward with a replacement function if
-- later router migrations have changed this body.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_sql text;
begin
  select pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
  into v_sql;

  v_sql := replace(
    v_sql,
    '  v_scored_answered integer := 0;
  v_dashboard_foundation_gap boolean := false;',
    '  v_scored_answered integer := 0;'
  );

  v_sql := regexp_replace(
    v_sql,
    E'\\n  select exists \\([\\s\\S]+?\\n  into v_dashboard_foundation_gap;\\n\\n  -- The fast baseline selector',
    E'\\n\\n  -- The fast baseline selector'
  );

  v_sql := replace(
    v_sql,
    E'       and v_mode = ''cold_start''\\n       and not v_dashboard_foundation_gap\\n       and v_scored_answered < v_fast_answer_limit',
    E'       and v_mode = ''cold_start''\\n       and v_scored_answered < v_fast_answer_limit'
  );

  execute v_sql;
end
$rollback$;

commit;
