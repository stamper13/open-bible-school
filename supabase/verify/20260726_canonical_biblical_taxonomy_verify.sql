-- Fail-loud verification for the canonical biblical taxonomy migration.

do $$
declare
  v_total integer;
  v_ot integer;
  v_nt integer;
  v_bad_sections integer;
  v_missing_weight_books integer;
  v_missing_scripture_books integer;
  v_bli_differences integer;
  v_compute_definition text;
  v_theta_definition text;
begin
  if to_regclass('public.obs_biblical_books') is null
     or to_regprocedure('public.obs_get_biblical_taxonomy()') is null
     or to_regprocedure('public.obs_book_codes_for_scope(text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Canonical taxonomy objects are missing.';
  end if;

  select
    count(*),
    count(*) filter (where testament = 'OT'),
    count(*) filter (where testament = 'NT')
  into v_total, v_ot, v_nt
  from public.obs_biblical_books;

  if (v_total, v_ot, v_nt) <> (66, 39, 27) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Book counts are wrong: total=%s OT=%s NT=%s; expected 66/39/27.',
        v_total, v_ot, v_nt
      );
  end if;

  with expected(section_key, expected_count) as (
    values
      ('TORAH', 5),
      ('FORMER', 7),
      ('LATTER', 17),
      ('WRITINGS', 10),
      ('GOSPELS_ACTS', 5),
      ('PAULINE', 13),
      ('GENERAL', 8),
      ('APOCALYPSE', 1)
  ), actual as (
    select section_key, count(*)::integer as actual_count
    from public.obs_biblical_books
    group by section_key
  )
  select count(*)
  into v_bad_sections
  from expected e
  left join actual a using (section_key)
  where a.actual_count is distinct from e.expected_count;

  if v_bad_sections <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format('%s canonical sections have the wrong book count.', v_bad_sections);
  end if;

  select count(*)
  into v_missing_weight_books
  from public.book_bli_weights bw
  left join public.obs_biblical_books b
    on b.book_code = upper(bw.book_code)
  where b.book_code is null;

  select count(*)
  into v_missing_scripture_books
  from public.scripture_books sb
  left join public.obs_biblical_books b
    on b.book_code = upper(sb.book_code)
  where b.book_code is null;

  if v_missing_weight_books <> 0 or v_missing_scripture_books <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Live book tables contain unmapped codes: book_bli_weights=%s scripture_books=%s.',
        v_missing_weight_books,
        v_missing_scripture_books
      );
  end if;

  if exists (
    select 1
    from public.obs_biblical_books b
    where public.obs_book_testament(b.book_code) is distinct from b.testament
       or public.obs_book_section(b.book_code) is distinct from b.section_name
       or not (b.book_code = any(public.obs_book_codes_for_scope(b.section_key)))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'At least one taxonomy helper disagrees with the canonical table.';
  end if;

  select pg_get_functiondef(
    to_regprocedure('public.obs_compute_bli_internal(uuid)')
  )
  into v_compute_definition;
  select pg_get_functiondef(
    to_regprocedure('public.update_theta_internal(uuid,text,uuid,boolean)')
  )
  into v_theta_definition;

  if strpos(v_compute_definition, 'public.obs_book_section(bk) as section') = 0
     or strpos(v_theta_definition, 'public.obs_book_codes_for_scope(v_scope)') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'One or both active scorers are not wired to the canonical taxonomy.';
  end if;

  select count(*)
  into v_bli_differences
  from public.obs_biblical_taxonomy_bli_baseline baseline
  cross join lateral public.obs_compute_bli_internal(baseline.user_id) scored
  where baseline.bli_score is distinct from scored.bli_score
     or baseline.total_weighted_possible is distinct from scored.total_weighted_possible
     or baseline.total_weighted_earned is distinct from scored.total_weighted_earned
     or baseline.questions_answered is distinct from scored.questions_answered;

  if v_bli_differences <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        '%s users changed overall BLI values; only section membership should change.',
        v_bli_differences
      );
  end if;

  raise notice
    'PASS: 66 books, 8 sections, live book tables covered, scorers rewired, overall BLI unchanged.';
end
$$;

select
  section_key,
  section_name,
  count(*) as books,
  min(canonical_order) as first_order,
  max(canonical_order) as last_order
from public.obs_biblical_books
group by section_key, section_name
order by min(canonical_order);
