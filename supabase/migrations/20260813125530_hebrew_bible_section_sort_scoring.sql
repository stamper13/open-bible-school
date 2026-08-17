create or replace function public.obs_section_sort_book_key(
  p_book_code text,
  p_testament text,
  p_nt_division text
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_testament = 'NT' and p_nt_division = 'Gospels_Acts' then 'GOSPELS_ACTS'
    when p_testament = 'NT' and p_nt_division = 'Pauline' then 'PAULINE'
    when p_testament = 'NT' and p_nt_division = 'General' then 'GENERAL'
    when p_testament = 'NT' and p_nt_division = 'Apocalypse' then 'APOCALYPSE'
    when p_book_code in ('GEN','EXO','LEV','NUM','DEU') then 'TORAH'
    when p_book_code in ('JOS','JDG','1SA','2SA','1KI','2KI') then 'FORMER'
    when p_book_code in ('ISA','JER','EZE','EZK','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL') then 'LATTER'
    when p_testament = 'OT' then 'WRITINGS'
    else null
  end;
$$;

grant execute on function public.obs_section_sort_book_key(text, text, text)
  to anon, authenticated, service_role;

comment on function public.obs_section_sort_book_key(text, text, text) is
  'Returns section-sort scoring keys using Hebrew Bible/Tanakh divisions for OT book structure.';

notify pgrst, 'reload schema';
