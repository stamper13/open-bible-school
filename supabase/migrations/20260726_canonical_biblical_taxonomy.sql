-- Canonical 66-book taxonomy for frontend metadata and backend scoring scopes.
--
-- The OT section assignments follow the dashboard's Hebrew-canon structure:
-- Former Prophets ends at 2 Kings; Chronicles through Esther are Writings.

begin;

create table if not exists public.obs_schema_backups (
  id uuid primary key default gen_random_uuid(),
  backup_tag text not null,
  object_schema text not null,
  object_name text not null,
  object_type text not null,
  definition text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.obs_biblical_books') is not null
     or to_regclass('public.obs_biblical_taxonomy_ability_backup') is not null
     or to_regclass('public.obs_biblical_taxonomy_bli_baseline') is not null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Canonical taxonomy or its safety snapshots already exist; no changes made.';
  end if;

  if to_regclass('public.user_abilities') is null
     or to_regprocedure('public.obs_compute_bli_internal(uuid)') is null
     or to_regprocedure('public.update_theta_internal(uuid,text,uuid,boolean)') is null
     or to_regprocedure('public.obs_book_testament(text)') is null
     or to_regprocedure('public.obs_book_section(text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'A required scoring table or function is missing; no changes made.';
  end if;
end
$$;

do $$
declare
  target record;
  v_definition text;
  v_count integer;
begin
  for target in
    select *
    from (
      values
        ('obs_book_testament', 'text'),
        ('obs_book_section', 'text'),
        ('obs_compute_bli_internal', 'uuid'),
        ('update_theta_internal', 'uuid,text,uuid,boolean')
    ) as functions(function_name, function_args)
  loop
    if not exists (
      select 1
      from public.obs_schema_backups
      where backup_tag = '20260726_canonical_biblical_taxonomy'
        and object_schema = 'public'
        and object_name = target.function_name
        and object_type = 'function'
    ) then
      select pg_get_functiondef(
        to_regprocedure(
          'public.' || target.function_name || '(' || target.function_args || ')'
        )
      )
      into v_definition;

      insert into public.obs_schema_backups (
        backup_tag, object_schema, object_name, object_type, definition
      ) values (
        '20260726_canonical_biblical_taxonomy',
        'public',
        target.function_name,
        'function',
        v_definition
      );
    end if;
  end loop;

  select count(*)
  into v_count
  from public.obs_schema_backups
  where backup_tag = '20260726_canonical_biblical_taxonomy'
    and object_schema = 'public'
    and object_name in (
      'obs_book_testament',
      'obs_book_section',
      'obs_compute_bli_internal',
      'update_theta_internal'
    )
    and object_type = 'function';

  if v_count <> 4 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected exactly four function backups, found %s; no changes made.', v_count);
  end if;
end
$$;

create table public.obs_biblical_books (
  book_code text primary key,
  display_name text not null,
  testament text not null check (testament in ('OT', 'NT')),
  section_key text not null check (
    section_key in (
      'TORAH', 'FORMER', 'LATTER', 'WRITINGS',
      'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
    )
  ),
  section_name text not null check (
    section_name in (
      'Torah', 'Former Prophets', 'Latter Prophets', 'Writings',
      'Gospels & Acts', 'Pauline Epistles', 'General Epistles', 'Apocalypse'
    )
  ),
  canonical_order smallint not null unique check (canonical_order between 1 and 66),
  constraint obs_biblical_books_code_ck
    check (book_code = upper(book_code) and book_code ~ '^[0-9A-Z]{3}$'),
  constraint obs_biblical_books_testament_section_ck
    check (
      (testament = 'OT' and section_key in ('TORAH', 'FORMER', 'LATTER', 'WRITINGS'))
      or
      (testament = 'NT' and section_key in ('GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'))
    ),
  constraint obs_biblical_books_section_pair_ck
    check (
      (section_key = 'TORAH' and section_name = 'Torah')
      or (section_key = 'FORMER' and section_name = 'Former Prophets')
      or (section_key = 'LATTER' and section_name = 'Latter Prophets')
      or (section_key = 'WRITINGS' and section_name = 'Writings')
      or (section_key = 'GOSPELS_ACTS' and section_name = 'Gospels & Acts')
      or (section_key = 'PAULINE' and section_name = 'Pauline Epistles')
      or (section_key = 'GENERAL' and section_name = 'General Epistles')
      or (section_key = 'APOCALYPSE' and section_name = 'Apocalypse')
    )
);

insert into public.obs_biblical_books (
  book_code, display_name, testament, section_key, section_name, canonical_order
) values
  ('GEN','Genesis','OT','TORAH','Torah',1),
  ('EXO','Exodus','OT','TORAH','Torah',2),
  ('LEV','Leviticus','OT','TORAH','Torah',3),
  ('NUM','Numbers','OT','TORAH','Torah',4),
  ('DEU','Deuteronomy','OT','TORAH','Torah',5),
  ('JOS','Joshua','OT','FORMER','Former Prophets',6),
  ('JDG','Judges','OT','FORMER','Former Prophets',7),
  ('RUT','Ruth','OT','FORMER','Former Prophets',8),
  ('1SA','1 Samuel','OT','FORMER','Former Prophets',9),
  ('2SA','2 Samuel','OT','FORMER','Former Prophets',10),
  ('1KI','1 Kings','OT','FORMER','Former Prophets',11),
  ('2KI','2 Kings','OT','FORMER','Former Prophets',12),
  ('1CH','1 Chronicles','OT','WRITINGS','Writings',13),
  ('2CH','2 Chronicles','OT','WRITINGS','Writings',14),
  ('EZR','Ezra','OT','WRITINGS','Writings',15),
  ('NEH','Nehemiah','OT','WRITINGS','Writings',16),
  ('EST','Esther','OT','WRITINGS','Writings',17),
  ('JOB','Job','OT','WRITINGS','Writings',18),
  ('PSA','Psalms','OT','WRITINGS','Writings',19),
  ('PRO','Proverbs','OT','WRITINGS','Writings',20),
  ('ECC','Ecclesiastes','OT','WRITINGS','Writings',21),
  ('SNG','Song of Songs','OT','WRITINGS','Writings',22),
  ('ISA','Isaiah','OT','LATTER','Latter Prophets',23),
  ('JER','Jeremiah','OT','LATTER','Latter Prophets',24),
  ('LAM','Lamentations','OT','LATTER','Latter Prophets',25),
  ('EZE','Ezekiel','OT','LATTER','Latter Prophets',26),
  ('DAN','Daniel','OT','LATTER','Latter Prophets',27),
  ('HOS','Hosea','OT','LATTER','Latter Prophets',28),
  ('JOL','Joel','OT','LATTER','Latter Prophets',29),
  ('AMO','Amos','OT','LATTER','Latter Prophets',30),
  ('OBA','Obadiah','OT','LATTER','Latter Prophets',31),
  ('JON','Jonah','OT','LATTER','Latter Prophets',32),
  ('MIC','Micah','OT','LATTER','Latter Prophets',33),
  ('NAM','Nahum','OT','LATTER','Latter Prophets',34),
  ('HAB','Habakkuk','OT','LATTER','Latter Prophets',35),
  ('ZEP','Zephaniah','OT','LATTER','Latter Prophets',36),
  ('HAG','Haggai','OT','LATTER','Latter Prophets',37),
  ('ZEC','Zechariah','OT','LATTER','Latter Prophets',38),
  ('MAL','Malachi','OT','LATTER','Latter Prophets',39),
  ('MAT','Matthew','NT','GOSPELS_ACTS','Gospels & Acts',40),
  ('MRK','Mark','NT','GOSPELS_ACTS','Gospels & Acts',41),
  ('LUK','Luke','NT','GOSPELS_ACTS','Gospels & Acts',42),
  ('JHN','John','NT','GOSPELS_ACTS','Gospels & Acts',43),
  ('ACT','Acts','NT','GOSPELS_ACTS','Gospels & Acts',44),
  ('ROM','Romans','NT','PAULINE','Pauline Epistles',45),
  ('1CO','1 Corinthians','NT','PAULINE','Pauline Epistles',46),
  ('2CO','2 Corinthians','NT','PAULINE','Pauline Epistles',47),
  ('GAL','Galatians','NT','PAULINE','Pauline Epistles',48),
  ('EPH','Ephesians','NT','PAULINE','Pauline Epistles',49),
  ('PHP','Philippians','NT','PAULINE','Pauline Epistles',50),
  ('COL','Colossians','NT','PAULINE','Pauline Epistles',51),
  ('1TH','1 Thessalonians','NT','PAULINE','Pauline Epistles',52),
  ('2TH','2 Thessalonians','NT','PAULINE','Pauline Epistles',53),
  ('1TI','1 Timothy','NT','PAULINE','Pauline Epistles',54),
  ('2TI','2 Timothy','NT','PAULINE','Pauline Epistles',55),
  ('TIT','Titus','NT','PAULINE','Pauline Epistles',56),
  ('PHM','Philemon','NT','PAULINE','Pauline Epistles',57),
  ('HEB','Hebrews','NT','GENERAL','General Epistles',58),
  ('JAS','James','NT','GENERAL','General Epistles',59),
  ('1PE','1 Peter','NT','GENERAL','General Epistles',60),
  ('2PE','2 Peter','NT','GENERAL','General Epistles',61),
  ('1JN','1 John','NT','GENERAL','General Epistles',62),
  ('2JN','2 John','NT','GENERAL','General Epistles',63),
  ('3JN','3 John','NT','GENERAL','General Epistles',64),
  ('JUD','Jude','NT','GENERAL','General Epistles',65),
  ('REV','Revelation','NT','APOCALYPSE','Apocalypse',66);

alter table public.obs_biblical_books enable row level security;
revoke all on table public.obs_biblical_books from public, anon, authenticated;
grant select on table public.obs_biblical_books to service_role;

create or replace function public.obs_get_biblical_taxonomy()
returns table(
  book_code text,
  display_name text,
  testament text,
  section_key text,
  section_name text,
  canonical_order smallint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.book_code,
    b.display_name,
    b.testament,
    b.section_key,
    b.section_name,
    b.canonical_order
  from public.obs_biblical_books b
  order by b.canonical_order;
$$;

create or replace function public.obs_book_testament(p_book_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select b.testament
  from public.obs_biblical_books b
  where b.book_code = upper(btrim(coalesce(p_book_code, '')));
$$;

create or replace function public.obs_book_section(p_book_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select b.section_name
      from public.obs_biblical_books b
      where b.book_code = upper(btrim(coalesce(p_book_code, '')))
    ),
    'Unmapped'
  );
$$;

create or replace function public.obs_book_codes_for_scope(p_scope text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case upper(btrim(coalesce(p_scope, '')))
    when 'BIBLE' then (
      select array_agg(b.book_code order by b.canonical_order)
      from public.obs_biblical_books b
    )
    when 'OT' then (
      select array_agg(b.book_code order by b.canonical_order)
      from public.obs_biblical_books b
      where b.testament = 'OT'
    )
    when 'NT' then (
      select array_agg(b.book_code order by b.canonical_order)
      from public.obs_biblical_books b
      where b.testament = 'NT'
    )
    else (
      select array_agg(b.book_code order by b.canonical_order)
      from public.obs_biblical_books b
      where b.section_key = upper(btrim(coalesce(p_scope, '')))
    )
  end;
$$;

revoke all on function public.obs_get_biblical_taxonomy()
  from public;
grant execute on function public.obs_get_biblical_taxonomy()
  to anon, authenticated, service_role;
revoke all on function public.obs_book_testament(text)
  from public;
grant execute on function public.obs_book_testament(text)
  to anon, authenticated, service_role;
revoke all on function public.obs_book_section(text)
  from public;
grant execute on function public.obs_book_section(text)
  to anon, authenticated, service_role;
revoke all on function public.obs_book_codes_for_scope(text)
  from public, anon, authenticated;
grant execute on function public.obs_book_codes_for_scope(text)
  to service_role;

create table public.obs_biblical_taxonomy_ability_backup as
select *
from public.user_abilities
where upper(scope) in ('FORMER', 'LATTER', 'WRITINGS');

alter table public.obs_biblical_taxonomy_ability_backup enable row level security;
revoke all on table public.obs_biblical_taxonomy_ability_backup
  from public, anon, authenticated;
grant select on table public.obs_biblical_taxonomy_ability_backup
  to service_role;

create table public.obs_biblical_taxonomy_bli_baseline as
select
  users.user_id,
  scored.bli_score,
  scored.total_weighted_possible,
  scored.total_weighted_earned,
  scored.questions_answered
from (
  select distinct aa.user_id
  from public.assessment_answers aa
  where aa.user_id is not null
) users
cross join lateral public.obs_compute_bli_internal(users.user_id) scored;

alter table public.obs_biblical_taxonomy_bli_baseline enable row level security;
revoke all on table public.obs_biblical_taxonomy_bli_baseline
  from public, anon, authenticated;
grant select on table public.obs_biblical_taxonomy_bli_baseline
  to service_role;

do $$
declare
  v_definition text;
  v_updated text;
  v_start integer;
  v_end integer;
  v_section_rows integer;
  v_relative integer;
  v_replaced text;
  v_marker text;
begin
  select pg_get_functiondef(
    to_regprocedure('public.obs_compute_bli_internal(uuid)')
  )
  into v_definition;

  v_section_rows := strpos(v_definition, 'section_rows as (');
  if v_section_rows = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Could not locate section_rows in obs_compute_bli_internal; no changes made.';
  end if;

  v_relative := strpos(substring(v_definition from v_section_rows), 'case');
  v_start := v_section_rows + v_relative - 1;
  v_marker := E'      end as section,\\n';
  if v_relative = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Could not locate the section CASE in obs_compute_bli_internal; no changes made.';
  end if;

  v_relative := strpos(substring(v_definition from v_start), 'end as section,');
  if v_relative = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Could not locate the end of the section CASE in obs_compute_bli_internal; no changes made.';
  end if;
  v_end := v_start + v_relative - 1 + length('end as section,');
  v_replaced := substring(v_definition from v_start for v_end - v_start);

  if strpos(v_replaced, 'when bk in') = 0
     or strpos(v_replaced, 'else ''Unmapped''') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'The located section CASE does not match the expected static book mapping.';
  end if;

  v_updated :=
    substring(v_definition from 1 for v_start - 1)
    || 'public.obs_book_section(bk) as section,'
    || substring(v_definition from v_end);

  if v_updated = v_definition
     or strpos(v_updated, 'public.obs_book_section(bk) as section') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'obs_compute_bli_internal rewrite did not change exactly the intended section mapping.';
  end if;

  execute v_updated;

  select pg_get_functiondef(
    to_regprocedure('public.update_theta_internal(uuid,text,uuid,boolean)')
  )
  into v_definition;

  v_start := strpos(v_definition, 'v_books := case v_scope');
  v_marker := 'if v_books is null then';
  if v_start = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Could not locate the scope CASE in update_theta_internal; no changes made.';
  end if;
  v_end := strpos(substring(v_definition from v_start), v_marker);
  if v_end = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Could not locate the end of the scope CASE in update_theta_internal; no changes made.';
  end if;
  v_end := v_start + v_end - 1;
  v_replaced := substring(v_definition from v_start for v_end - v_start);
  if strpos(v_replaced, 'when ''BIBLE''') = 0
     or strpos(v_replaced, 'when ''APOCALYPSE''') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'The located scope CASE does not match the expected static ability mapping.';
  end if;

  v_updated :=
    substring(v_definition from 1 for v_start - 1)
    || 'v_books := public.obs_book_codes_for_scope(v_scope); '
    || substring(v_definition from v_end);

  if v_updated = v_definition
     or strpos(v_updated, 'public.obs_book_codes_for_scope(v_scope)') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'update_theta_internal rewrite did not change exactly the intended scope mapping.';
  end if;

  execute v_updated;
end
$$;

revoke all on function public.obs_compute_bli_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_compute_bli_internal(uuid)
  to service_role;
revoke all on function public.update_theta_internal(uuid,text,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.update_theta_internal(uuid,text,uuid,boolean)
  to service_role;

do $$
declare
  ability record;
begin
  for ability in
    select user_id, scope
    from public.obs_biblical_taxonomy_ability_backup
  loop
    perform public.update_theta_internal(
      ability.user_id,
      ability.scope,
      null,
      false
    );
  end loop;
end
$$;

comment on table public.obs_biblical_books is
  'Canonical 66-book registry used by BLI scoring scopes and mirrored by the frontend taxonomy module.';
comment on function public.obs_get_biblical_taxonomy() is
  'Returns the canonical 66-book taxonomy in Bible order.';
comment on function public.obs_book_codes_for_scope(text) is
  'Resolves BIBLE, testament, or section ability scopes to canonical ordered book codes.';

notify pgrst, 'reload schema';

commit;
