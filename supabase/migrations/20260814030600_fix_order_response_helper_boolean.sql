create or replace function public.obs_is_order_response_question(
  p_question_type text,
  p_payload jsonb
)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(
    coalesce(p_question_type, '') = 'sequence_order_v1'
    or (
      jsonb_typeof(p_payload->'choices') = 'array'
      and jsonb_typeof(p_payload->'correct_order') = 'array'
      and jsonb_array_length(p_payload->'choices') between 3 and 5
      and jsonb_array_length(p_payload->'correct_order')
        = jsonb_array_length(p_payload->'choices')
    ),
    false
  );
$$;

comment on function public.obs_is_order_response_question(text, jsonb) is
  'Returns true only for OT questions that are explicitly order-response items. Missing correct_order metadata returns false, not null.';

notify pgrst, 'reload schema';
