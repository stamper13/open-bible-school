-- Keep baseline assessments from jumping straight from section screens into
-- chapter/passage-detail recall. Detail items are still available, but they
-- are demoted until the attempt has enough broad/book-level evidence.

create or replace function public.obs_is_high_specificity_assessment_question(
  p_prompt text,
  p_question_type text,
  p_payload jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    lower(coalesce(p_payload->>'knowledge_granularity', '')) in (
      'chapter_detail',
      'chapter_section',
      'episode_detail',
      'event_detail',
      'law_detail',
      'micro_detail',
      'passage_detail',
      'specific_pericope',
      'verse_detail'
    )
    or lower(coalesce(p_payload->>'question_family', '')) in (
      'chapter_detail',
      'chapter_recall',
      'episode_detail',
      'passage_detail',
      'verse_detail'
    )
    or lower(coalesce(p_payload->>'exact_chapter_recall_required', 'false'))
      in ('true', 't', '1', 'yes', 'y')
    or lower(coalesce(p_question_type, '')) in (
      'chapter_detail_mcq_v1',
      'passage_detail_mcq_v1',
      'verse_detail_mcq_v1'
    )
    or coalesce(p_prompt, '') ~* E'\\m(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1[[:space:]]+Samuel|2[[:space:]]+Samuel|1[[:space:]]+Kings|2[[:space:]]+Kings|1[[:space:]]+Chronicles|2[[:space:]]+Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song[[:space:]]+of[[:space:]]+Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1[[:space:]]+Corinthians|2[[:space:]]+Corinthians|Galatians|Ephesians|Philippians|Colossians|1[[:space:]]+Thessalonians|2[[:space:]]+Thessalonians|1[[:space:]]+Timothy|2[[:space:]]+Timothy|Titus|Philemon|Hebrews|James|1[[:space:]]+Peter|2[[:space:]]+Peter|1[[:space:]]+John|2[[:space:]]+John|3[[:space:]]+John|Jude|Revelation)[[:space:]]+[0-9]{1,3}\\M';
$$;

revoke all on function public.obs_is_high_specificity_assessment_question(text, text, jsonb)
  from public, anon;
grant execute on function public.obs_is_high_specificity_assessment_question(text, text, jsonb)
  to authenticated, service_role;

create or replace function public.get_next_assessment_question(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text,
  map jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row record;
  policy_row record;
  active_row record;
  shadow_row record;
  v_answer_count integer := 0;
  v_foundation_count integer := 0;
  v_map jsonb;
begin
  select attempt.*
  into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and auth.uid() = p_user_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    (count(*) filter (
      where lower(coalesce(question.payload->>'question_family', '')) in (
        'book_orientation',
        'section_screen'
      )
      or lower(coalesce(question.payload->>'knowledge_granularity', '')) in (
        'book_overview',
        'canon_section',
        'section_overview'
      )
      or question.question_type in (
        'ot_book_section_sort_v1',
        'nt_book_section_sort_v1'
      )
    ))::integer
  into v_answer_count, v_foundation_count
  from public.assessment_answers answer
  left join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = answer.generated_question_id
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  select *
  into policy_row
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  if upper(coalesce(policy_row.active_version, 'V4')) = 'V5' then
    select *
    into active_row
    from public.obs_rank_ot_assessment_candidates_v5(
      p_attempt_id, p_user_id, 'V5', null, now(), 75
    ) ranked
    where not exists (
      select 1
      from public.assessment_answers answer
      where answer.attempt_id = p_attempt_id
        and answer.user_id = p_user_id
        and answer.generated_question_id = ranked.generated_question_id
    )
    order by
      case
        when (v_answer_count < 16 or v_foundation_count < 12)
          and public.obs_is_high_specificity_assessment_question(
            ranked.prompt,
            ranked.question_type,
            ranked.payload
          )
          then 2
        when v_answer_count >= 8
          and (v_answer_count < 16 or v_foundation_count < 12)
          and lower(coalesce(ranked.payload->>'question_family', ''))
            = 'book_orientation'
          then 0
        else 1
      end,
      ranked.candidate_rank
    limit 1;
  else
    select *
    into active_row
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id, p_user_id, policy_row.active_version, null, now(), 75
    ) ranked
    where not exists (
      select 1
      from public.assessment_answers answer
      where answer.attempt_id = p_attempt_id
        and answer.user_id = p_user_id
        and answer.generated_question_id = ranked.generated_question_id
    )
    order by
      case
        when (v_answer_count < 16 or v_foundation_count < 12)
          and public.obs_is_high_specificity_assessment_question(
            ranked.prompt,
            ranked.question_type,
            ranked.payload
          )
          then 2
        when v_answer_count >= 8
          and (v_answer_count < 16 or v_foundation_count < 12)
          and lower(coalesce(ranked.payload->>'question_family', ''))
            = 'book_orientation'
          then 0
        else 1
      end,
      ranked.candidate_rank
    limit 1;
  end if;

  if not found then
    return;
  end if;

  if policy_row.shadow_enabled
     and policy_row.shadow_sample_every_n > 0
     and mod(v_answer_count, policy_row.shadow_sample_every_n) = 0
     and not exists (
       select 1 from public.obs_router_shadow_log log
       where log.attempt_id = p_attempt_id
         and log.answer_count = v_answer_count
         and log.active_version = policy_row.active_version
         and log.shadow_version = policy_row.shadow_version
     )
  then
    if upper(coalesce(policy_row.shadow_version, 'V4')) = 'V5' then
      select *
      into shadow_row
      from public.obs_rank_ot_assessment_candidates_v5(
        p_attempt_id, p_user_id, 'V5', null, now(), 1
      );
    else
      select *
      into shadow_row
      from public.obs_rank_ot_assessment_candidates_v4(
        p_attempt_id, p_user_id, policy_row.shadow_version, null, now(), 1
      );
    end if;

    insert into public.obs_router_shadow_log (
      attempt_id, user_id, answer_count, active_version, shadow_version,
      active_question_id, shadow_question_id, active_book_code, shadow_book_code,
      active_stage, shadow_stage, active_target_theta, shadow_target_theta,
      active_lane, shadow_lane
    ) values (
      p_attempt_id, p_user_id, v_answer_count,
      policy_row.active_version, policy_row.shadow_version,
      active_row.generated_question_id, shadow_row.generated_question_id,
      active_row.book_code, shadow_row.book_code,
      active_row.candidate_stage, shadow_row.candidate_stage,
      active_row.target_theta, shadow_row.target_theta,
      active_row.selection_lane, shadow_row.selection_lane
    )
    on conflict (attempt_id, answer_count, active_version, shadow_version)
      do nothing;
  end if;

  v_map := null;
  if coalesce(active_row.question_type, '') like 'map\_%'
     and active_row.payload ? 'map_points' then
    select jsonb_build_object(
      'basemap_id', basemap.basemap_id,
      'label', basemap.label,
      'bounds', jsonb_build_object(
        'lat_min', basemap.lat_min,
        'lat_max', basemap.lat_max,
        'lon_min', basemap.lon_min,
        'lon_max', basemap.lon_max
      ),
      'min_separation_km', basemap.min_separation_km,
      'points', active_row.payload->'map_points'
    )
    into v_map
    from public.obs_map_basemaps basemap
    where basemap.basemap_id = active_row.payload->>'basemap_id';
  end if;

  return query
  select
    active_row.generated_question_id::uuid,
    active_row.prompt::text,
    active_row.question_type::text,
    active_row.payload->'choices',
    active_row.event_title::text,
    active_row.book_code::text,
    active_row.importance_tier::integer,
    active_row.section::text,
    v_map;
end;
$$;

revoke all on function public.get_next_assessment_question(uuid, uuid)
  from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid)
  to authenticated, service_role;

create or replace function public.obs_get_next_nt_assessment_question(
  p_attempt_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  book_code text,
  book_name text,
  nt_division text,
  answered_count integer,
  target_question_count integer
)
language sql
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.scope_key, 'NT')) as scope_key,
      greatest(1, coalesce(attempt.target_question_count, 20)) as target_count
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = auth.uid()
      and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  ),
  attempt_answers as (
    select
      answer.generated_question_id,
      question.question_type,
      question.payload,
      nullif(question.payload->>'stem_family', '') as stem_family
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    join authorized_attempt attempt
      on attempt.id = answer.attempt_id
  ),
  progress as (
    select count(*)::integer as answered
    from attempt_answers
  ),
  foundation as (
    select (count(*) filter (
      where lower(coalesce(payload->>'question_family', '')) in (
        'book_orientation',
        'section_screen'
      )
      or lower(coalesce(payload->>'knowledge_granularity', '')) in (
        'book_overview',
        'canon_section',
        'section_overview'
      )
      or question_type in (
        'ot_book_section_sort_v1',
        'nt_book_section_sort_v1'
      )
    ))::integer as answered
    from attempt_answers
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    where answer.user_id = auth.uid()
    group by answer.generated_question_id
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      question.book_code,
      book.name as book_name,
      book.nt_division,
      nullif(question.payload->>'stem_family', '') as stem_family,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      public.obs_effective_item_irt_a(question.payload, null) as effective_a,
      public.obs_effective_item_irt_b(question.payload, null) as effective_b,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        nt_ability.theta - 0.5 * coalesce(nt_ability.theta_se, 1.0),
        0.0
      ) as theta_lcb,
      greatest(
        0.0,
        least(
          1.0,
          coalesce(
            public.obs_payload_number(
              question.payload,
              'importance_conceptual'
            ) / 100.0,
            0.60
          )
        )
      ) as importance_score,
      attempt.target_count
    from authorized_attempt attempt
    join public.v_nt_question_bank question
      on true
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.user_abilities ability
      on ability.user_id = attempt.user_id
     and ability.scope = case
       when attempt.scope_key in (
         'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
       ) then attempt.scope_key
       else public.obs_nt_scope_key(book.nt_division, null)
     end
    left join public.user_abilities nt_ability
      on nt_ability.user_id = attempt.user_id
     and nt_ability.scope = 'NT'
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    cross join progress
    where progress.answered < attempt.target_count
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
      and public.obs_nt_question_matches_scope(
        question.book_code,
        book.nt_division,
        attempt.scope_key
      )
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(
            question.payload->>'stem_family',
            ''
          )
      )
  ),
  ranked as (
    select
      candidate.*,
      (
        0.55 * public.obs_item_information(
          candidate.theta_lcb,
          candidate.effective_a,
          candidate.effective_b
        )
        + 0.25 * candidate.importance_score
        + 0.15 * (1.0 / (1.0 + candidate.times_answered))
        + 0.05 * random()
      ) as adaptive_score
    from candidates candidate
  )
  select
    ranked.generated_question_id,
    ranked.prompt,
    ranked.question_type,
    ranked.payload->'choices',
    ranked.book_code,
    ranked.book_name,
    ranked.nt_division,
    progress.answered,
    ranked.target_count
  from ranked
  cross join progress
  cross join foundation
  order by
    case
      when (progress.answered < 16 or foundation.answered < 12)
        and public.obs_is_high_specificity_assessment_question(
          ranked.prompt,
          ranked.question_type,
          ranked.payload
        )
        then 2
      when progress.answered >= 8
        and (progress.answered < 16 or foundation.answered < 12)
        and lower(coalesce(ranked.payload->>'question_family', ''))
          = 'book_orientation'
        then 0
      else 1
    end,
    ranked.adaptive_score desc,
    ranked.times_answered asc,
    ranked.last_answered_at asc nulls first,
    ranked.generated_question_id
  limit 1;
$$;

revoke all on function public.obs_get_next_nt_assessment_question(uuid)
  from public, anon;
grant execute on function public.obs_get_next_nt_assessment_question(uuid)
  to authenticated, service_role;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question, preferring foundation/book-level checks before chapter-detail recall.';
comment on function public.obs_get_next_nt_assessment_question(uuid) is
  'Returns one adaptive NT question while preferring foundation/book-level checks before chapter-detail recall.';
comment on function public.obs_is_high_specificity_assessment_question(text, text, jsonb) is
  'Classifies chapter, passage, and verse-detail assessment items for early-session routing gates.';

notify pgrst, 'reload schema';
