create or replace function public.obs_section_sort_review_text(p_assignments jsonb)
returns text
language sql
stable
set search_path = public
as $$
  select string_agg(
    assignment.value->>'text' || ' -> ' || case upper(coalesce(assignment.value->>'section_key', ''))
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
      when 'GOSPELS_ACTS' then 'Gospels & Acts'
      when 'PAULINE' then 'Pauline Epistles'
      when 'GENERAL' then 'General Epistles'
      when 'APOCALYPSE' then 'Apocalypse'
      when '__IDK__' then 'I do not know / skipped'
      else 'Unassigned'
    end,
    '; ' order by assignment.ordinality
  )
  from jsonb_array_elements(p_assignments) with ordinality assignment(value, ordinality);
$$;

grant execute on function public.obs_section_sort_review_text(jsonb)
  to anon, authenticated, service_role;

comment on function public.obs_section_sort_review_text(jsonb) is
  'Formats section-sort assignments for attempt review snapshots.';

notify pgrst, 'reload schema';
