-- Fail-loud verification for Torah question coverage and focused stages.

do $$
declare
  active_count integer;
  mcq_count integer;
  sequence_count integer;
  quarantined_count integer;
  bad_metadata integer;
  eventless_new_questions integer;
  still_unmapped_explicit_chapters integer;
  bad_dimensions integer;
  thin_units integer;
  stage_report text;
begin
  select
    count(*)::integer,
    count(*) filter (
      where question.question_type = 'torah_coverage_mcq_v1'
    )::integer,
    count(*) filter (
      where question.question_type = 'sequence_order_v1'
    )::integer
  into active_count, mcq_count, sequence_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
      '20260726_torah_question_coverage'
    and question.question_type not like 'quarantined%';

  select count(*)::integer
  into quarantined_count
  from public.ot_generated_questions question
  where question.payload->>'quarantine_reason' =
    'Cross-testament interpretation is outside the OT-only BLI construct.'
    and question.question_type like 'quarantined%';

  select count(*)::integer
  into bad_metadata
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' =
      '20260726_torah_question_coverage'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
      or audit.payload->>'retest_stage' not in ('foundation', 'detail')
      or audit.inferred_chapter is null
    );

  select count(*)::integer
  into eventless_new_questions
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' =
      '20260726_torah_question_coverage'
    and audit.event_id is null;

  select count(*)::integer
  into still_unmapped_explicit_chapters
  from public.obs_admin_question_bank_audit audit
  where audit.book_code in ('EXO', 'LEV', 'NUM', 'DEU')
    and audit.payload->>'chapter' ~ '^[0-9]{1,3}$'
    and audit.inferred_chapter is null;

  select count(*)::integer
  into bad_dimensions
  from public.obs_admin_question_bank_audit audit
  where audit.dedupe_key in (
    'batch10|LEV|lev_love_neighbor',
    'batch4|LEV|holiness_refrain',
    'primary_mcq_v2|NUM|3|levites_firstborn_redemption',
    'primary_mcq_v2|NUM|6|nazirite'
  )
    and audit.dimension_key <> 'law_commands';

  with stage_counts as (
    select
      question.unit_key,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      )) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 1
      ) as foundation_families,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      )) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 2
      ) as core_families,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      )) filter (
        where public.obs_focused_item_stage(
          question.question_type,
          question.payload,
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        ) = 3
      ) as detail_families
    from public.obs_question_bank_with_units question
    left join public.bible_events event
      on event.id = question.event_id
    where question.unit_key in (
      'exo-1-20',
      'exo-21-40',
      'lev-1-16',
      'lev-17-27',
      'num-10-25',
      'deu-5-30'
    )
    group by question.unit_key
  )
  select
    count(*) filter (
      where foundation_families < 2
         or core_families < 4
         or detail_families < 9
    )::integer,
    string_agg(
      format(
        '%s=%s/%s/%s',
        unit_key,
        foundation_families,
        core_families,
        detail_families
      ),
      ', '
      order by unit_key
    )
  into thin_units, stage_report
  from stage_counts;

  if active_count <> 25
     or mcq_count <> 21
     or sequence_count <> 4
     or quarantined_count <> 5
     or bad_metadata <> 0
     or eventless_new_questions <> 1
     or still_unmapped_explicit_chapters <> 0
     or bad_dimensions <> 0
     or thin_units <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Torah coverage VERIFY FAILED: active=%s/25 mcq=%s/21 sequence=%s/4 quarantined=%s/5 bad_metadata=%s eventless=%s/1 unmapped_explicit=%s bad_dimensions=%s thin_units=%s stages=[%s].',
        active_count,
        mcq_count,
        sequence_count,
        quarantined_count,
        bad_metadata,
        eventless_new_questions,
        still_unmapped_explicit_chapters,
        bad_dimensions,
        thin_units,
        coalesce(stage_report, 'missing')
      );
  end if;

  raise notice
    'PASS: Torah coverage is active. Stage families (foundation/core/detail): %.',
    stage_report;
end
$$;

select
  audit.book_code,
  audit.inferred_chapter,
  audit.payload->>'retest_stage' as retest_stage,
  audit.dimension_key,
  audit.question_type,
  audit.prompt
from public.obs_admin_question_bank_audit audit
where audit.payload->>'source_batch' =
  '20260726_torah_question_coverage'
order by
  audit.book_code,
  audit.inferred_chapter,
  audit.payload->>'retest_stage',
  audit.prompt;
