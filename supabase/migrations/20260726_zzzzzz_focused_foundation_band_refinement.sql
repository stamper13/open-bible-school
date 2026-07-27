-- Refine the foundation band so focused retests have enough broad entry items.

begin;

do $$
begin
  if to_regprocedure(
       'public.obs_focused_item_stage(text,jsonb,double precision)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Focused foundation refinement preflight failed; apply the adaptive ladder first.';
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
  '20260726_focused_foundation_band_refinement',
  'public',
  'obs_focused_item_stage',
  'function',
  pg_get_functiondef(
    'public.obs_focused_item_stage(text,jsonb,double precision)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_focused_foundation_band_refinement'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_focused_item_stage'
    and backup.object_type = 'function'
);

do $$
declare
  captured integer;
begin
  select count(*)
  into captured
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_focused_foundation_band_refinement'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_focused_item_stage'
    and backup.object_type = 'function';

  if captured <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Focused foundation refinement backup failed; expected 1 definition, found %s.',
        captured
      );
  end if;
end
$$;

create or replace function public.obs_focused_item_stage(
  p_question_type text,
  p_payload jsonb,
  p_effective_irt_b double precision
)
returns integer
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_question_type, '') = 'book_orientation_mcq_v1'
      or lower(coalesce(p_payload->>'assessment_role', '')) in (
        'book_orientation',
        'foundation',
        'baseline'
      )
      or coalesce(p_effective_irt_b, 0.0) <= -0.75
      or public.obs_payload_number(
        coalesce(p_payload, '{}'::jsonb),
        'difficulty_estimate'
      ) <= 480
      then 1
    when lower(coalesce(p_question_type, '')) like '%significance%'
      or lower(coalesce(p_question_type, '')) like '%theological%'
      or lower(coalesce(p_question_type, '')) like '%cross_ref%'
      or lower(coalesce(p_question_type, '')) like '%crossref%'
      or coalesce(p_question_type, '') = 'sequence_order_v1'
      or coalesce(p_effective_irt_b, 0.0) > 0.50
      or public.obs_payload_number(
        coalesce(p_payload, '{}'::jsonb),
        'difficulty_estimate'
      ) > 560
      then 3
    else 2
  end;
$$;

comment on function public.obs_focused_item_stage(
  text, jsonb, double precision
) is
  'Classifies focused-retest items as foundation (through difficulty estimate 480), core knowledge, or detail and synthesis.';

notify pgrst, 'reload schema';

commit;
