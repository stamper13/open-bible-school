begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop function if exists public.obs_log_nt_assessment_v7_shadow_selection(
  uuid, uuid, uuid, timestamptz
);

drop function if exists public.obs_rank_nt_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
);

drop table if exists public.obs_router_nt_v7_shadow_log;

delete from public.obs_question_ladder_metadata metadata
using public.v_nt_question_bank question
where metadata.generated_question_id = question.generated_question_id;

alter table public.obs_question_ladder_metadata
  drop constraint if exists obs_question_ladder_metadata_granularity_ck,
  drop constraint if exists obs_question_ladder_metadata_scope_level_ck,
  drop constraint if exists obs_question_ladder_metadata_section_key_ck,
  drop constraint if exists obs_question_ladder_metadata_section_name_ck,
  drop constraint if exists obs_question_ladder_metadata_section_pair_ck;

alter table public.obs_question_ladder_metadata
  add constraint obs_question_ladder_metadata_granularity_ck
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
  add constraint obs_question_ladder_metadata_scope_level_ck
    check (scoring_scope_level in (
      'unknown',
      'ot',
      'section',
      'book',
      'unit',
      'chapter',
      'passage'
    )),
  add constraint obs_question_ladder_metadata_section_key_ck
    check (
      section_key is null
      or section_key in ('TORAH', 'FORMER', 'LATTER', 'WRITINGS')
    ),
  add constraint obs_question_ladder_metadata_section_name_ck
    check (
      section_name is null
      or section_name in (
        'Torah',
        'Former Prophets',
        'Latter Prophets',
        'Writings'
      )
    ),
  add constraint obs_question_ladder_metadata_section_pair_ck
    check (
      section_key is null
      or section_name is null
      or (
        (section_key = 'TORAH' and section_name = 'Torah')
        or (section_key = 'FORMER' and section_name = 'Former Prophets')
        or (section_key = 'LATTER' and section_name = 'Latter Prophets')
        or (section_key = 'WRITINGS' and section_name = 'Writings')
      )
    );

notify pgrst, 'reload schema';

commit;
