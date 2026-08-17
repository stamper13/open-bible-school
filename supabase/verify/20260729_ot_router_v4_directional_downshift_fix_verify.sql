do $$
declare
  exact_priority integer;
  easier_priority integer;
  harder_priority integer;
  other_orientation_priority integer;
begin
  select public.obs_general_route_priority_v4(
    'OBA', 1, 'OBA', 1, false, 0, false,
    'book_orientation', 1, 1
  ) into exact_priority;

  select public.obs_general_route_priority_v4(
    'OBA', 2, 'OBA', 1, true, 0, false,
    null, 1, 2
  ) into easier_priority;

  select public.obs_general_route_priority_v4(
    'OBA', 1, 'OBA', 1, false, 0, false,
    null, 2, 1
  ) into harder_priority;

  select public.obs_general_route_priority_v4(
    'OBA', 1, 'HAB', 0, false, 0, false,
    'book_orientation', 1, 1
  ) into other_orientation_priority;

  if exact_priority <> -2
     or easier_priority <> -1
     or harder_priority <> 3
     or other_orientation_priority <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Directional downshift failed: exact=%s easier=%s harder=%s other_orientation=%s.',
        exact_priority,
        easier_priority,
        harder_priority,
        other_orientation_priority
      );
  end if;

  raise notice
    'PASS: V4 downshifts never route upward when the requested stage is unavailable.';
end
$$;
