-- Add a least-evidence follow-up route without changing the versioned BLI
-- scoring formula. The dashboard uses this before a point-estimate weakness
-- recommendation whenever a section has too little evidence to interpret.

begin;

create or replace function public.obs_get_bli_section_followup_v1(
  p_user_id uuid,
  p_testament text default 'OT'
)
returns table (
  scoring_version text,
  testament text,
  section_name text,
  scope_key text,
  answered integer,
  minimum_reliable_answers integer,
  established_answers integer,
  answers_needed integer,
  suggested_question_count integer,
  evidence_status text,
  is_provisional boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  with authorized as (
    select upper(btrim(p_testament)) as testament
    where public.obs_is_authorized_user(p_user_id)
      and upper(btrim(p_testament)) in ('OT', 'NT')
  ), canonical_sections as (
    select *
    from (values
      ('OT', 'Torah', 1, 'TORAH'),
      ('OT', 'Former Prophets', 2, 'FORMER'),
      ('OT', 'Latter Prophets', 3, 'LATTER'),
      ('OT', 'Writings', 4, 'WRITINGS'),
      ('NT', 'Gospels & Acts', 1, 'GOSPELS_ACTS'),
      ('NT', 'Pauline Epistles', 2, 'PAULINE'),
      ('NT', 'General Epistles', 3, 'GENERAL'),
      ('NT', 'Apocalypse', 4, 'APOCALYPSE')
    ) section(testament, section_name, canonical_order, scope_key)
  ), evidence_counts as (
    select
      evidence.testament,
      evidence.section as section_name,
      count(*)::integer as answered
    from public.obs_answer_evidence evidence
    join authorized
      on authorized.testament = evidence.testament
    join public.assessment_answers answer
      on answer.id = evidence.answer_id
     and answer.scoring_eligible
    where evidence.user_id = p_user_id
      and evidence.question_type not like 'quarantined%'
    group by evidence.testament, evidence.section
  ), ranked as (
    select
      section.testament,
      section.section_name,
      section.scope_key,
      coalesce(evidence.answered, 0)::integer as answered,
      section.canonical_order
    from canonical_sections section
    join authorized
      on authorized.testament = section.testament
    left join evidence_counts evidence
      on evidence.testament = section.testament
     and evidence.section_name = section.section_name
    order by
      coalesce(evidence.answered, 0),
      section.canonical_order
    limit 1
  )
  select
    'bli_weighted_v2'::text,
    ranked.testament,
    ranked.section_name,
    ranked.scope_key,
    ranked.answered,
    15,
    30,
    greatest(0, 15 - ranked.answered),
    greatest(5, least(20, 15 - ranked.answered)),
    case
      when ranked.answered >= 30 then 'established'
      when ranked.answered >= 15 then 'developing'
      else 'provisional'
    end,
    ranked.answered < 15
  from ranked;
$function$;

revoke all on function public.obs_get_bli_section_followup_v1(uuid, text)
  from public, anon;
grant execute on function public.obs_get_bli_section_followup_v1(uuid, text)
  to authenticated, service_role;

comment on function public.obs_get_bli_section_followup_v1(uuid, text) is
  'Returns the canonical section with the least eligible evidence. A dashboard should route provisional sections here before interpreting the lowest BLI point estimate. Uses 15 answers as the interpretation floor and 30 as established evidence.';

commit;
