do $$
declare
  rubric_count integer;
  review_count integer;
  synchronized_count integer;
  missing_review_count integer;
  repaired_count integer;
  jacob_brother_score numeric;
  rebekah_father_score numeric;
begin
  if to_regclass('public.obs_relationship_importance_rubric') is null
     or to_regclass('public.obs_relationship_question_reviews') is null
     or to_regclass('public.obs_admin_relationship_importance_audit') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: relationship importance objects are missing.';
  end if;

  select count(*)
  into rubric_count
  from public.obs_relationship_importance_rubric;

  select count(*)
  into review_count
  from public.obs_relationship_question_reviews;

  select count(*)
  into synchronized_count
  from public.obs_admin_relationship_importance_audit
  where relationship_class is not null
    and global_score = significance_score
    and importance_tier = significance_tier
    and global_score = effective_global_score
    and context_score = effective_context_score;

  select count(*)
  into missing_review_count
  from public.obs_admin_relationship_importance_audit
  where relationship_class is null;

  select count(*)
  into repaired_count
  from public.ot_generated_questions question
  cross join lateral jsonb_array_elements(question.payload->'choices') choice
  where question.id = '6e0c61e8-6e2a-47f1-be70-b27ce44c0831'::uuid
    and question.payload->>'prompt' =
      'According to Genesis 18, what did the LORD promise would happen when he returned at the appointed time?'
    and question.payload->>'source_ref' = 'Gen 18:10-14'
    and choice->>'id' = question.payload->>'correct_choice_id'
    and choice->>'text' = 'Sarah will have a son';

  select effective_global_score
  into jacob_brother_score
  from public.obs_admin_relationship_importance_audit
  where generated_question_id = '5093f6eb-0809-4830-a1e8-060289093cd6'::uuid;

  select effective_global_score
  into rebekah_father_score
  from public.obs_admin_relationship_importance_audit
  where generated_question_id = 'b6a15bdd-384c-43b1-9a05-c077348e015c'::uuid;

  if rubric_count <> 4
     or review_count <> 12
     or synchronized_count <> 12
     or missing_review_count <> 0
     or repaired_count <> 1
     or jacob_brother_score < 95
     or rebekah_father_score > 60
     or jacob_brother_score - rebekah_father_score < 35
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: rubric=%s/4 reviews=%s/12 synchronized=%s/12 missing=%s repaired=%s/1 Jacob=%s Rebekah=%s.',
        rubric_count,
        review_count,
        synchronized_count,
        missing_review_count,
        repaired_count,
        jacob_brother_score,
        rebekah_father_score
      );
  end if;

  raise notice
    'PASS: Sarah prompt repaired; 12 kinship questions reviewed; Jacob brother=% and Rebekah father=% global importance.',
    jacob_brother_score,
    rebekah_father_score;
end
$$;

select
  prompt,
  relationship_class,
  global_score,
  context_score,
  importance_tier,
  effective_global_score
from public.obs_admin_relationship_importance_audit
order by global_score desc, prompt;
