create or replace function public.obs_submit_section_sort_answers(
  p_attempt_id uuid,
  p_screen_question_id uuid,
  p_assignments jsonb
)
returns table (
  is_correct boolean,
  is_idk boolean,
  correct_choice_id text,
  answered_count integer,
  correct_count integer,
  target_question_count integer,
  target_reached boolean,
  remaining_count integer,
  scored_item_count integer,
  scored_correct_count integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_screen public.ot_generated_questions%rowtype;
  v_assignment record;
  v_label text;
  v_selected text;
  v_correct text;
  v_book public.scripture_books%rowtype;
  v_scored integer := 0;
  v_scored_correct integer := 0;
  v_has_idk boolean := false;
  v_all_correct boolean := true;
  v_selected_choice_id text;
  v_inserted boolean;
  v_answered integer;
  v_correct_count integer;
  v_target_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception using errcode = '22023', message = 'Assignments must be a JSON array';
  end if;

  select * into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Attempt not found or not authorized';
  end if;

  select * into v_screen
  from public.ot_generated_questions question
  where question.id = p_screen_question_id
    and question.question_type not like 'quarantined%';

  if not found then
    raise exception using errcode = '22023', message = 'Section-sort question was not found';
  end if;

  for v_assignment in select * from jsonb_array_elements(p_assignments) item loop
    v_label := nullif(btrim(v_assignment.value->>'text'), '');
    v_selected := upper(nullif(btrim(v_assignment.value->>'section_key'), ''));

    if v_label is null then
      raise exception using errcode = '22023', message = 'Assignment is missing a book label';
    end if;

    v_correct := upper(v_screen.payload->'correct_assignments'->>v_label);

    if v_correct is null then
      select * into v_book
      from public.scripture_books book
      where lower(book.name) = lower(v_label)
      limit 1;

      if not found then
        raise exception using errcode = '22023', message = format('Book label is not recognized: %s', v_label);
      end if;

      v_correct := public.obs_section_sort_book_key(v_book.book_code, v_book.testament, v_book.nt_division);
    end if;

    if v_correct is null then
      raise exception using errcode = '22023', message = format('Book label has no section mapping: %s', v_label);
    end if;

    v_scored := v_scored + 1;

    if v_selected = '__IDK__' then
      v_has_idk := true;
      v_all_correct := false;
    elsif v_selected = v_correct then
      v_scored_correct := v_scored_correct + 1;
    else
      v_all_correct := false;
    end if;
  end loop;

  v_selected_choice_id := case
    when v_has_idk then '__IDK__'
    when v_all_correct then 'A'
    else 'B'
  end;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    question_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    answered_at
  ) values (
    p_attempt_id,
    v_user_id,
    p_screen_question_id,
    p_screen_question_id,
    v_selected_choice_id,
    v_all_correct and v_scored > 0,
    v_has_idk,
    now()
  )
  on conflict (attempt_id, question_id) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) and v_screen.event_id is not null then
    perform public.update_theta_internal(
      v_user_id,
      coalesce(v_attempt.scope_key, coalesce(v_attempt.testament, 'OT')),
      v_screen.event_id,
      v_all_correct and v_scored > 0
    );
  end if;

  select count(*)::integer,
         count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  v_target_count := greatest(
    1,
    coalesce(v_attempt.target_question_count, v_attempt.question_target, v_attempt.total_count, 20)
  );

  update public.assessment_attempts attempt
  set answered_count = v_answered,
      correct_count = v_correct_count,
      is_complete = v_answered >= v_target_count,
      completed_at = case
        when v_answered >= v_target_count then coalesce(attempt.completed_at, now())
        else attempt.completed_at
      end
  where attempt.id = p_attempt_id;

  return query select
    v_all_correct and v_scored > 0,
    v_has_idk,
    'A'::text,
    v_answered,
    v_correct_count,
    v_target_count,
    v_answered >= v_target_count,
    greatest(v_target_count - v_answered, 0),
    v_scored,
    v_scored_correct;
end;
$function$;

revoke all on function public.obs_submit_section_sort_answers(uuid, uuid, jsonb)
  from public;

grant execute on function public.obs_submit_section_sort_answers(uuid, uuid, jsonb)
  to anon, authenticated, service_role;

comment on function public.obs_submit_section_sort_answers(uuid, uuid, jsonb) is
  'Submits section-sort drag/drop answers using Hebrew Bible/Tanakh divisions for OT book structure and common NT divisions for NT book structure.';

notify pgrst, 'reload schema';
