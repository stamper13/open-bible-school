-- Restrict the NT pilot to the explicitly approved account while the pilot is private.
create or replace function public.obs_nt_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $function$
  select lower(coalesce((
    select u.email
    from auth.users u
    where u.id = auth.uid()
  ), '')) = 'adstamper35@gmail.com';
$function$;

revoke all on function public.obs_nt_access_allowed() from public;
grant execute on function public.obs_nt_access_allowed() to anon, authenticated;

create or replace function public.enforce_nt_access_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if upper(coalesce(new.testament, '')) = 'NT'
     and not public.obs_nt_access_allowed() then
    raise exception using
      errcode = '42501',
      message = 'New Testament access is currently limited to the approved pilot account';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_nt_access_allowlist() from public;

drop trigger if exists trg_nt_access_allowlist_attempts on public.assessment_attempts;
create trigger trg_nt_access_allowlist_attempts
before insert or update of testament on public.assessment_attempts
for each row
execute function public.enforce_nt_access_allowlist();

create or replace function public.enforce_nt_answer_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_testament text;
begin
  select upper(coalesce(a.testament, ''))
    into v_testament
  from public.assessment_attempts a
  where a.id = new.attempt_id;

  if v_testament = 'NT'
     and not public.obs_nt_access_allowed() then
    raise exception using
      errcode = '42501',
      message = 'New Testament access is currently limited to the approved pilot account';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_nt_answer_allowlist() from public;

drop trigger if exists trg_nt_access_allowlist_answers on public.assessment_answers;
create trigger trg_nt_access_allowlist_answers
before insert or update on public.assessment_answers
for each row
execute function public.enforce_nt_answer_allowlist();
