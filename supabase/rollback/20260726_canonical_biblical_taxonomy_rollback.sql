-- Roll back the canonical biblical taxonomy and restore affected ability rows.

begin;

do $$
declare
  backup record;
  v_restored integer := 0;
begin
  if to_regclass('public.obs_biblical_taxonomy_ability_backup') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Ability backup is missing; rollback aborted.';
  end if;

  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260726_canonical_biblical_taxonomy'
      and object_schema = 'public'
      and object_name in (
        'obs_book_testament',
        'obs_book_section',
        'obs_compute_bli_internal',
        'update_theta_internal'
      )
      and object_type = 'function'
    order by object_name
  loop
    execute backup.definition;
    v_restored := v_restored + 1;
  end loop;

  if v_restored <> 4 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected to restore four functions, restored %s.', v_restored);
  end if;
end
$$;

delete from public.user_abilities
where upper(scope) in ('FORMER', 'LATTER', 'WRITINGS');

insert into public.user_abilities
select *
from public.obs_biblical_taxonomy_ability_backup;

drop function if exists public.obs_get_biblical_taxonomy();
drop function if exists public.obs_book_codes_for_scope(text);
drop table if exists public.obs_biblical_books;

revoke all on function public.obs_compute_bli_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_compute_bli_internal(uuid)
  to service_role;
revoke all on function public.update_theta_internal(uuid,text,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.update_theta_internal(uuid,text,uuid,boolean)
  to service_role;
grant execute on function public.obs_book_testament(text)
  to anon, authenticated, service_role;
grant execute on function public.obs_book_section(text)
  to anon, authenticated, service_role;

drop table public.obs_biblical_taxonomy_bli_baseline;
drop table public.obs_biblical_taxonomy_ability_backup;

notify pgrst, 'reload schema';

commit;
