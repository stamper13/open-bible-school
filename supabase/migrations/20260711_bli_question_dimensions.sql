-- Canonical BLI dimensions for question categorization.
--
-- Run this in the Supabase SQL editor.
-- It creates:
--   1. obs_bli_dimensions: the official seven-dimension taxonomy.
--   2. obs_question_dimension_overrides: manual corrections for ambiguous questions.
--   3. obs_infer_question_dimension(...): first-pass classifier for existing questions.
--   4. obs_question_bank_with_dimensions: question-bank view with dimension metadata.
--   5. Adds dimension metadata to obs_question_bank_with_units when that view exists.

begin;

create table if not exists public.obs_bli_dimensions (
  dimension_key text primary key,
  label text not null,
  short_label text not null,
  sort_order integer not null unique,
  description text not null,
  is_advanced boolean not null default false,
  created_at timestamptz not null default now(),
  constraint obs_bli_dimensions_key_ck check (
    dimension_key in (
      'characters_lineage',
      'events_timeline',
      'geography_nations',
      'law_commands',
      'promise_prophecy',
      'theological_reasoning',
      'structure_cross_ref'
    )
  )
);

insert into public.obs_bli_dimensions (
  dimension_key,
  label,
  short_label,
  sort_order,
  description,
  is_advanced
)
values
  (
    'characters_lineage',
    'Characters & Lineage',
    'Characters',
    10,
    'People, family lines, tribes, identity markers, roles, and people groups.',
    false
  ),
  (
    'events_timeline',
    'Events & Timeline',
    'Events',
    20,
    'Major events, plot sequence, chronology, time spans, dates, and narrative turning points.',
    false
  ),
  (
    'geography_nations',
    'Geography & Nations',
    'Geography',
    30,
    'Places, regions, routes, borders, nations, kingdoms, empires, and territorial movement.',
    false
  ),
  (
    'law_commands',
    'Law & Commands',
    'Law',
    40,
    'Commands, prohibitions, ritual requirements, covenant obligations, and stated covenant sanctions.',
    false
  ),
  (
    'promise_prophecy',
    'Promise & Prophecy',
    'Promise',
    50,
    'Divine promises, prophetic warnings, judgments, future declarations, and restoration announcements.',
    false
  ),
  (
    'theological_reasoning',
    'Theological Reasoning',
    'Reasoning',
    60,
    'Wisdom reflection, covenant interpretation, poetic theology, and the text''s explanation of why events matter.',
    false
  ),
  (
    'structure_cross_ref',
    'Structure & Cross Ref',
    'Cross Ref',
    70,
    'Canon structure, genre, book placement, literary structure, explicit quotations, and inner-biblical references.',
    true
  )
on conflict (dimension_key) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  sort_order = excluded.sort_order,
  description = excluded.description,
  is_advanced = excluded.is_advanced;

create table if not exists public.obs_question_dimension_overrides (
  generated_question_id uuid primary key,
  dimension_key text not null references public.obs_bli_dimensions(dimension_key),
  review_reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create index if not exists obs_question_dimension_overrides_dimension_idx
  on public.obs_question_dimension_overrides (dimension_key);

create or replace function public.obs_normalize_dimension_key(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when lower(btrim(p_value)) in ('characters_lineage', 'characters', 'character', 'lineage', 'genealogy', 'who', 'people') then 'characters_lineage'
    when lower(btrim(p_value)) in ('events_timeline', 'events', 'event', 'timeline', 'sequence', 'chronology', 'numbers', 'numeric', 'what_when') then 'events_timeline'
    when lower(btrim(p_value)) in ('geography_nations', 'geography', 'geography_nation', 'nations', 'nation', 'places', 'where', 'geopolitics') then 'geography_nations'
    when lower(btrim(p_value)) in ('law_commands', 'law', 'commands', 'command', 'rules', 'covenant_terms') then 'law_commands'
    when lower(btrim(p_value)) in ('promise_prophecy', 'promise', 'prophecy', 'prophetic', 'speech', 'speech_promise') then 'promise_prophecy'
    when lower(btrim(p_value)) in ('theological_reasoning', 'theology', 'reasoning', 'significance', 'concept', 'wisdom', 'reflection') then 'theological_reasoning'
    when lower(btrim(p_value)) in (
      'structure_cross_ref',
      'structure',
      'cross_ref',
      'crossref',
      'cross reference',
      'cross-reference',
      'scripture_connections',
      'intertextual',
      'context',
      'canon_context',
      'canonical context',
      'key_texts',
      'key texts',
      'nt_connections',
      'nt connections',
      'historical_context',
      'historical context',
      'literary_structure',
      'literary structure'
    ) then 'structure_cross_ref'
    else null
  end;
$$;

create or replace function public.obs_infer_question_dimension(
  p_question_type text,
  p_payload jsonb default '{}'::jsonb,
  p_prompt text default null
)
returns text
language plpgsql
stable
as $$
declare
  explicit_dimension text;
  q text := lower(coalesce(p_question_type, ''));
  prompt_text text := lower(coalesce(p_prompt, p_payload->>'prompt', ''));
begin
  explicit_dimension := public.obs_normalize_dimension_key(coalesce(
    p_payload->>'dimension_key',
    p_payload->>'dimension',
    p_payload->>'domain',
    p_payload->>'bli_dimension'
  ));

  if explicit_dimension is not null then
    return explicit_dimension;
  end if;

  if q ~ '(scripture[_ -]?connection|cross[_ -]?ref|intertextual|quotation|quote|canonical|canon|structure|outline|genre)' then
    return 'structure_cross_ref';
  end if;

  if q ~ '(relationship|people|person|role|oppressor|entity|character|lineage|genealog|tribe|father|mother|son|daughter|king|priest|prophet)' then
    return 'characters_lineage';
  end if;

  if q ~ '(geograph|location|place|city|region|river|mountain|wilderness|nation|empire|kingdom|territor|route)' then
    return 'geography_nations';
  end if;

  if q ~ '(command|law|legal|torah|ritual|purity|sacrifice|offering|festival|sabbath|covenant[_ -]?curse|blessing[_ -]?curse)' then
    return 'law_commands';
  end if;

  if q ~ '(promise|prophe|speech|oracle|warning|judg(e)?ment|restoration|messianic|future|declare|announcement)' then
    return 'promise_prophecy';
  end if;

  if q ~ '(significance|concept|wisdom|theolog|reason|reflection|meaning|interpret|lament|praise|justice|suffering)' then
    return 'theological_reasoning';
  end if;

  if q ~ '(primary|event|chronolog|sequence|timeline|numeric|number|duration|date|year|detail)' then
    return 'events_timeline';
  end if;

  if prompt_text ~ '(where|city|region|river|mountain|wilderness|nation|empire|kingdom)' then
    return 'geography_nations';
  end if;

  if prompt_text ~ '(father|mother|son|daughter|tribe|descendant|ancestor|king|priest|prophet|who was)' then
    return 'characters_lineage';
  end if;

  if prompt_text ~ '(command|law|forbid|required|must|shall|covenant curse|blessing and curse)' then
    return 'law_commands';
  end if;

  if prompt_text ~ '(promise|prophet|prophesied|declared|warned|judgment|restoration)' then
    return 'promise_prophecy';
  end if;

  if prompt_text ~ '(why|meaning|significance|wisdom|psalm|proverb|job|ecclesiastes|lament)' then
    return 'theological_reasoning';
  end if;

  return 'events_timeline';
end;
$$;

create or replace view public.obs_question_bank_with_dimensions as
select
  q.*,
  coalesce(
    o.dimension_key,
    public.obs_infer_question_dimension(q.question_type, q.payload, q.prompt)
  ) as dimension_key,
  d.label as dimension_label,
  d.short_label as dimension_short_label,
  d.sort_order as dimension_sort_order,
  d.description as dimension_description,
  d.is_advanced as dimension_is_advanced,
  (o.generated_question_id is not null) as dimension_is_manual_override
from public.v_question_bank q
left join public.obs_question_dimension_overrides o
  on o.generated_question_id = q.generated_question_id
left join public.obs_bli_dimensions d
  on d.dimension_key = coalesce(
    o.dimension_key,
    public.obs_infer_question_dimension(q.question_type, q.payload, q.prompt)
  );

do $$
begin
  if to_regclass('public.obs_question_bank_with_units') is not null then
    execute $view$
      create or replace view public.obs_question_bank_with_units as
      select
        q.*,
        inferred.inferred_chapter,
        u.unit_key,
        u.label as unit_label,
        u.section as unit_section,
        u.sequence_order as unit_sequence_order,
        coalesce(
          o.dimension_key,
          public.obs_infer_question_dimension(q.question_type, q.payload, q.prompt)
        ) as dimension_key,
        d.label as dimension_label,
        d.short_label as dimension_short_label,
        d.sort_order as dimension_sort_order,
        d.description as dimension_description,
        d.is_advanced as dimension_is_advanced,
        (o.generated_question_id is not null) as dimension_is_manual_override
      from public.v_question_bank q
      left join public.bible_events e
        on e.id = q.event_id
      cross join lateral (
        select coalesce(
          public.obs_infer_question_chapter(q.book_code, q.prompt, q.payload, q.dedupe_key),
          e.start_chapter
        ) as inferred_chapter
      ) inferred
      left join public.obs_learning_units u
        on u.book_code = q.book_code
       and inferred.inferred_chapter between u.start_chapter and u.end_chapter
      left join public.obs_question_dimension_overrides o
        on o.generated_question_id = q.generated_question_id
      left join public.obs_bli_dimensions d
        on d.dimension_key = coalesce(
          o.dimension_key,
          public.obs_infer_question_dimension(q.question_type, q.payload, q.prompt)
        )
    $view$;
  end if;
end $$;

grant select on public.obs_bli_dimensions to anon, authenticated, service_role;
grant select on public.obs_question_bank_with_dimensions to anon, authenticated, service_role;
grant select, insert, update, delete on public.obs_question_dimension_overrides to service_role;
grant select on public.obs_question_dimension_overrides to authenticated;
grant execute on function public.obs_normalize_dimension_key(text) to anon, authenticated, service_role;
grant execute on function public.obs_infer_question_dimension(text, jsonb, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
