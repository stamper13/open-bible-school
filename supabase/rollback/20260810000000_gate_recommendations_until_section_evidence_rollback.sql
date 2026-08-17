begin;

drop function if exists public.obs_get_user_recommendation_v2(uuid);

do $$
begin
  if to_regprocedure('public.obs_get_user_recommendation_v2_ungated(uuid)') is not null then
    alter function public.obs_get_user_recommendation_v2_ungated(uuid)
      rename to obs_get_user_recommendation_v2;
  end if;
end;
$$;

revoke all on function public.obs_get_user_recommendation_v2(uuid)
  from public, anon;
grant execute on function public.obs_get_user_recommendation_v2(uuid)
  to authenticated, service_role;

comment on function public.obs_get_user_recommendation_v2(uuid) is
  'Recommends the earliest universal foundation gap, then applies book-specific historical prerequisites before a prophetic target; preserves dimension-aware focused retesting.';

notify pgrst, 'reload schema';

commit;
