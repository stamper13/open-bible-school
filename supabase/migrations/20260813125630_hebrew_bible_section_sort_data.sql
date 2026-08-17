update public.scripture_books
set ot_division = case
  when book_code in ('GEN','EXO','LEV','NUM','DEU') then 'TORAH'
  when book_code in ('JOS','JDG','1SA','2SA','1KI','2KI') then 'FORMER'
  when book_code in ('ISA','JER','EZE','EZK','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL') then 'LATTER'
  when testament = 'OT' then 'WRITINGS'
  else ot_division
end,
updated_at = now()
where testament = 'OT';

update public.ot_generated_questions question
set payload = jsonb_set(
  jsonb_set(
    question.payload,
    '{prompt}',
    to_jsonb(case
      when question.question_type like 'nt_%' then 'Drag each New Testament book to its correct division.'
      else 'Using Hebrew Bible divisions, drag each book to its correct section.'
    end),
    true
  ),
  '{canon_division_system}',
  to_jsonb(case
    when question.question_type like 'nt_%' then 'new_testament_common'
    else 'hebrew_bible_tanakh'
  end),
  true
)
where question.payload->>'interaction_type' = 'section_sort_drag_drop';
