begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.obs_question_ladder_metadata (
  generated_question_id uuid primary key
    references public.ot_generated_questions(id) on delete cascade,
  routing_granularity text not null default 'unknown',
  scoring_scope_level text not null default 'unknown',
  depth_stage smallint not null default 1,
  section_key text,
  section_name text,
  book_code text references public.obs_biblical_books(book_code),
  unit_key text references public.obs_learning_units(unit_key),
  start_chapter integer,
  end_chapter integer,
  dimension_key text references public.obs_bli_dimensions(dimension_key),
  foundationality_weight numeric(5,4) not null default 0.5000,
  global_signal_weight numeric(5,4) not null default 0.5000,
  local_signal_weight numeric(5,4) not null default 1.0000,
  exact_chapter_recall_required boolean not null default false,
  chapter_addressed_prompt boolean not null default false,
  metadata_source text not null default 'rule_inferred',
  metadata_confidence numeric(5,4) not null default 0.0000,
  review_status text not null default 'needs_review',
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obs_question_ladder_metadata_granularity_ck
    check (routing_granularity in (
      'unknown',
      'ot_overview',
      'section_overview',
      'book_overview',
      'book_intersection',
      'unit_overview',
      'chapter_range',
      'chapter_detail',
      'verse_detail'
    )),
  constraint obs_question_ladder_metadata_scope_level_ck
    check (scoring_scope_level in (
      'unknown',
      'ot',
      'section',
      'book',
      'unit',
      'chapter',
      'passage'
    )),
  constraint obs_question_ladder_metadata_depth_stage_ck
    check (depth_stage between 1 and 5),
  constraint obs_question_ladder_metadata_section_key_ck
    check (
      section_key is null
      or section_key in ('TORAH', 'FORMER', 'LATTER', 'WRITINGS')
    ),
  constraint obs_question_ladder_metadata_section_name_ck
    check (
      section_name is null
      or section_name in ('Torah', 'Former Prophets', 'Latter Prophets', 'Writings')
    ),
  constraint obs_question_ladder_metadata_section_pair_ck
    check (
      section_key is null
      or section_name is null
      or (
        (section_key = 'TORAH' and section_name = 'Torah')
        or (section_key = 'FORMER' and section_name = 'Former Prophets')
        or (section_key = 'LATTER' and section_name = 'Latter Prophets')
        or (section_key = 'WRITINGS' and section_name = 'Writings')
      )
    ),
  constraint obs_question_ladder_metadata_chapter_ck
    check (
      (start_chapter is null and end_chapter is null)
      or (
        start_chapter is not null
        and end_chapter is not null
        and start_chapter >= 1
        and end_chapter >= start_chapter
      )
    ),
  constraint obs_question_ladder_metadata_weights_ck
    check (
      foundationality_weight between 0 and 1
      and global_signal_weight between 0 and 1
      and local_signal_weight between 0 and 1
    ),
  constraint obs_question_ladder_metadata_confidence_ck
    check (metadata_confidence between 0 and 1),
  constraint obs_question_ladder_metadata_source_ck
    check (metadata_source in (
      'payload',
      'rule_inferred',
      'llm_assisted',
      'manual',
      'hybrid'
    )),
  constraint obs_question_ladder_metadata_review_status_ck
    check (review_status in (
      'needs_review',
      'auto_accepted',
      'reviewed',
      'flagged'
    )),
  constraint obs_question_ladder_metadata_unit_scope_ck
    check (
      unit_key is null
      or scoring_scope_level in ('unit', 'chapter', 'passage', 'unknown')
    ),
  constraint obs_question_ladder_metadata_chapter_scope_ck
    check (
      start_chapter is null
      or scoring_scope_level in ('unit', 'chapter', 'passage', 'unknown')
    )
);

alter table public.obs_question_ladder_metadata enable row level security;

revoke all on table public.obs_question_ladder_metadata from public, anon, authenticated;
grant all on table public.obs_question_ladder_metadata to service_role;

create index if not exists obs_question_ladder_metadata_route_idx
  on public.obs_question_ladder_metadata (
    routing_granularity,
    scoring_scope_level,
    depth_stage
  );

create index if not exists obs_question_ladder_metadata_scope_idx
  on public.obs_question_ladder_metadata (
    section_key,
    book_code,
    unit_key,
    dimension_key
  );

create index if not exists obs_question_ladder_metadata_review_idx
  on public.obs_question_ladder_metadata (
    review_status,
    metadata_confidence,
    routing_granularity
  );

comment on table public.obs_question_ladder_metadata is
  'Sidecar V7 metadata for broad-to-narrow question routing and shadow hierarchical BLI scoring.';

comment on column public.obs_question_ladder_metadata.routing_granularity is
  'Question-selection ladder level, from OT overview through verse detail.';

comment on column public.obs_question_ladder_metadata.scoring_scope_level is
  'Primary scope where the question should contribute scoring evidence.';

comment on column public.obs_question_ladder_metadata.depth_stage is
  'Coarse 1-5 depth ladder used by V7 routing. Higher stages represent narrower textual depth.';

comment on column public.obs_question_ladder_metadata.foundationality_weight is
  '0-1 estimate of how much the item supports broader biblical understanding.';

comment on column public.obs_question_ladder_metadata.global_signal_weight is
  '0-1 shadow-scoring weight for headline BLI impact.';

comment on column public.obs_question_ladder_metadata.local_signal_weight is
  '0-1 shadow-scoring weight for local book/unit/chapter confidence impact.';

commit;
