-- Balance the next 25 legacy distractor sets identified by the private audit.

begin;

create temporary table obs_distractor_repairs_batch_2 (
  id uuid primary key,
  correct_id text not null,
  prompt_new text,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null
) on commit drop;

insert into obs_distractor_repairs_batch_2 values
  (
    '558ea092-25b3-4b3a-a939-daf881462c02',
    'B',
    null,
    'His royal line will end after his death',
    'The sword will never depart from his house',
    'Jerusalem will fall during his reign',
    'The ark will be removed from Israel'
  ),
  (
    'df1ab419-cf39-4236-8bdf-f9d8ef13ce8e',
    'C',
    null,
    'He was less faithful than Solomon but better than Jeroboam',
    'He was judged mainly for losing wars against Aram',
    'He did more evil than any who came before him',
    'He followed the LORD while tolerating Jezebel''s worship'
  ),
  (
    '65295da7-f7f2-40ac-b68d-eeb2c1467fab',
    'A',
    null,
    'The judges themselves are morally compromised',
    'Israel''s leaders consistently understand the law',
    'Military courage guarantees faithful leadership',
    'A sincere vow makes every action righteous'
  ),
  (
    'd059aa68-14e5-48af-8770-27f7005d1f30',
    'C',
    null,
    'Israel owns the land without restriction',
    'Every debt is forbidden under the covenant',
    'The land belongs to God and Israel are tenants',
    'Wealth must be divided equally every year'
  ),
  (
    'cace42c9-5136-491d-8750-0dc20e35b2f7',
    'B',
    null,
    'He will remove every Canaanite immediately',
    'He will no longer drive out the nations before them',
    'He will replace Joshua with a foreign ruler',
    'He will move the tabernacle from Shiloh'
  ),
  (
    '5ef3c54c-1307-4fb5-86cf-a49b74e08456',
    'A',
    null,
    'The LORD Is There, because God dwells with his people',
    'The City of David, because David''s throne has returned',
    'New Jerusalem, because Babylon''s city has been replaced',
    'The Holy City, because only priests may live there'
  ),
  (
    'c1a9046b-e9c0-415f-9fd3-d345f09c452d',
    'C',
    null,
    'A sequence of royal coronation songs',
    'A history of Israel from the exodus to the exile',
    'An alphabetic acrostic devoted to God''s instruction',
    'A collection of laments over Jerusalem'
  ),
  (
    'd70fe0a2-6381-4beb-a0b0-ae3a183f2732',
    'C',
    null,
    'He identifies the secret sin that caused Job''s suffering',
    'He explains the heavenly scene directly to Job',
    'He answers Job with questions about creation',
    'He promises to explain every cause later'
  ),
  (
    'ae0cf0a0-8b9b-420f-9ab8-d2bc6a448363',
    'D',
    null,
    'Naomi''s debts and household servants',
    'Only the land, with no family obligation',
    'Guardianship of Naomi until she dies',
    'Ruth, to preserve Elimelech''s family line'
  ),
  (
    '736838d6-c5a9-4c61-b10a-c139b2d5a0d0',
    'A',
    null,
    'A clean heart and a steadfast spirit',
    'Healing from an unnamed physical illness',
    'Restoration to the throne after exile',
    'Protection from enemies in battle'
  ),
  (
    '1f883881-3df6-4ab6-b385-09353eacf9da',
    'C',
    null,
    'She establishes the permanent priesthood at Shiloh',
    'She leads Israel during the Philistine wars',
    'Her prayer anticipates God raising the lowly',
    'She founds the royal line of Benjamin'
  ),
  (
    '6c5a9f92-60e0-4bd5-a21d-c07dddf854c6',
    'B',
    null,
    'That Baal''s prophets must be destroyed',
    'That the LORD is God and Elijah is his servant',
    'That Ahab will immediately become faithful',
    'That rain will fall before the sacrifice burns'
  ),
  (
    '8138d21c-6afd-4ca2-8025-28f62e44214b',
    'D',
    null,
    'She becomes Israel''s first female judge',
    'She establishes inheritance rights for every foreigner',
    'She returns Moab to Israelite control',
    'She becomes the great-grandmother of David'
  ),
  (
    'db5cd875-27bb-4341-ae78-bec17529931e',
    'C',
    null,
    'God appears in visions throughout the story',
    'God speaks directly through Mordecai',
    'God is never named or directly mentioned',
    'God sends an angel to defeat Haman'
  ),
  (
    'adf7c9ef-07e2-4a77-9503-17b4578173c8',
    'C',
    null,
    'Redemption can be forced without consent',
    'Family land may never change hands',
    'He willingly assumes the cost of redemption',
    'Gleaning laws replace family obligations'
  ),
  (
    'af06a809-c84c-4b74-849d-39247137fc5f',
    'A',
    null,
    'The water stops and stands in a heap',
    'An east wind divides it for three days',
    'Two walls of water rise on either side',
    'The river slowly falls to a shallow level'
  ),
  (
    '3c23dfa5-06f2-4f81-9f54-cbecaf3de499',
    'D',
    null,
    'Barrenness always proves divine punishment',
    'Prayer replaces kingship as Israel''s government',
    'Priests will permanently rule over Israel',
    'God raises the lowly and brings down the mighty'
  ),
  (
    'b107bf89-378d-4f34-aa2c-6d1b176174c0',
    'A',
    null,
    'He repeatedly disobeyed the LORD''s commands',
    'He came from Benjamin rather than Judah',
    'He refused to build the temple in Jerusalem',
    'He lost every battle against the Philistines'
  ),
  (
    'ca1df14a-56e2-4470-a434-0d6e83717bda',
    'C',
    null,
    'God''s justice and judgment over nations',
    'God''s holiness beyond human understanding',
    'God''s complete knowledge and inescapable presence',
    'God''s patience toward Israel''s repeated sin'
  ),
  (
    '41d86a63-dc6f-4998-8282-07fe7c6f4c36',
    'B',
    null,
    'Priesthood may be changed without warning',
    'Those who approach God must honor his holiness',
    'Only firstborn sons may serve as priests',
    'Every Israelite must abstain from wine'
  ),
  (
    'ebf57298-d6f0-470a-9e7f-feb7ded7d5f3',
    'A',
    null,
    'Judge, prophet, and anointer of Israel''s first kings',
    'Priest, military commander, and royal scribe',
    'Nazirite, miracle worker, and temple builder',
    'Levite, lawgiver, and governor of Judah'
  ),
  (
    'd78f794c-285c-436d-98d4-01a91f5e8231',
    'D',
    null,
    'It is the only psalm Jesus is recorded singing',
    'It predicts the division of Jesus'' garments',
    'It introduces Jesus'' title Son of Man',
    'It is the OT text most often cited in the NT'
  ),
  (
    '533bade0-e578-4fe5-9e58-b6b9af1a4bcb',
    'C',
    null,
    'God appoints a judge to defend the poor',
    'Nations gather peacefully to worship at Zion',
    'Nations rage while God installs his king on Zion',
    'Foreign armies permanently overthrow Israel''s king'
  ),
  (
    '326dfe8e-9e04-4b2d-82a3-b5eb238eb77b',
    'A',
    null,
    'God can deliver them, but they will not worship the image even if he does not',
    'The law promises they cannot die for refusing an idol',
    'Daniel has already promised their rescue',
    'Their deaths will immediately end the exile'
  ),
  (
    'a5342e5a-e439-4695-86d1-d0b7dc463374',
    'C',
    null,
    'Balaam refuses and is punished before reaching Moab',
    'Balaam curses Moab instead of Israel',
    'God turns Balaam''s intended curses into blessings',
    'Balaam curses Israel and causes an immediate plague'
  );

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_distractor_length_repair_batch_2',
  'public',
  'ot_generated_questions',
  'data',
  jsonb_agg(
    jsonb_build_object('id', question.id, 'payload', question.payload)
    order by question.id
  )::text
from public.ot_generated_questions question
join obs_distractor_repairs_batch_2 repair
  on repair.id = question.id
having count(*) = 25
   and not exists (
     select 1
     from public.obs_schema_backups backup
     where backup.backup_tag =
             '20260729_distractor_length_repair_batch_2'
       and backup.object_schema = 'public'
       and backup.object_name = 'ot_generated_questions'
       and backup.object_type = 'data'
   );

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260729_distractor_length_repair_batch_2'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions'
    and object_type = 'data';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Batch 2 backup count was %s.', backup_count);
  end if;
end
$$;

update public.ot_generated_questions question
set payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          question.payload,
          '{choices}',
          jsonb_build_array(
            jsonb_build_object('id', 'A', 'text', repair.choice_a),
            jsonb_build_object('id', 'B', 'text', repair.choice_b),
            jsonb_build_object('id', 'C', 'text', repair.choice_c),
            jsonb_build_object('id', 'D', 'text', repair.choice_d)
          )
        ),
        '{correct_answer}',
        to_jsonb(
          (
            case repair.correct_id
              when 'A' then repair.choice_a
              when 'B' then repair.choice_b
              when 'C' then repair.choice_c
              else repair.choice_d
            end
          )::text
        )
      ),
      '{prompt}',
      to_jsonb(
        coalesce(repair.prompt_new, question.payload->>'prompt')::text
      )
    ),
    '{distractor_review}',
    '"same_category_length_balanced_v2"'::jsonb
  )
from obs_distractor_repairs_batch_2 repair
where question.id = repair.id
  and question.payload->>'correct_choice_id' = repair.correct_id;

do $$
declare
  repaired_count integer;
  remaining_flags integer;
begin
  select count(*)
  into repaired_count
  from public.ot_generated_questions question
  join obs_distractor_repairs_batch_2 repair
    on repair.id = question.id
  where question.payload->>'distractor_review'
    = 'same_category_length_balanced_v2';

  select count(*)
  into remaining_flags
  from public.obs_question_distractor_quality_audit audit
  join obs_distractor_repairs_batch_2 repair
    on repair.id = audit.generated_question_id
  where audit.requires_review;

  if repaired_count <> 25 or remaining_flags <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Batch 2 repair failed: repaired=%s flags=%s.',
        repaired_count,
        remaining_flags
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
