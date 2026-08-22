do $verify$
declare
  v_mismatch_count integer;
begin
  with nt_answer_totals as (
    select
      attempt.id as attempt_id,
      count(*) filter (where answer.answered_at is not null)::integer
        as answered_count,
      count(*) filter (
        where answer.answered_at is not null
          and coalesce(answer.is_correct, false)
      )::integer as correct_count,
      greatest(
        1,
        coalesce(
          attempt.target_question_count,
          attempt.question_target,
          attempt.total_count,
          20
        )
      ) as target_count
    from public.assessment_attempts attempt
    join public.assessment_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = attempt.user_id
    where upper(coalesce(attempt.testament, '')) = 'NT'
    group by attempt.id
    having count(*) filter (where answer.answered_at is not null) > 0
  )
  select count(*)::integer
  into v_mismatch_count
  from public.assessment_attempts attempt
  join nt_answer_totals totals
    on totals.attempt_id = attempt.id
  where attempt.answered_count is distinct from totals.answered_count
     or attempt.correct_count is distinct from totals.correct_count
     or coalesce(attempt.is_complete, false) is distinct from (
       totals.answered_count >= totals.target_count
     );

  if v_mismatch_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT attempt summary backfill verification failed: %s mismatches remain.',
        v_mismatch_count
      );
  end if;
end
$verify$;
