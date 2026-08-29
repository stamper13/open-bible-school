drop function if exists public.obs_submit_question_quality_rating(
  uuid, uuid, smallint, text, text, text, text
);

drop table if exists public.obs_question_quality_ratings;
