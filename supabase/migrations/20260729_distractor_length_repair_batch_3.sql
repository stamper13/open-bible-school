-- Balance the final 25 legacy distractor sets identified by the private audit.

begin;

create temporary table obs_distractor_repairs_batch_3 (
  id uuid primary key,
  correct_id text not null,
  prompt_new text,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null
) on commit drop;

insert into obs_distractor_repairs_batch_3 values
  (
    '697df772-fcbc-4ef8-9e85-0e6da8b873fb',
    'B',
    null,
    'Corrupt priests serving for payment',
    'Idolatry spreading from Samaria into Judah',
    'Trust in military alliances with Egypt',
    'Seizing houses and fields from the powerless'
  ),
  (
    '3ec34d83-3391-4cc5-8642-b1591183cc91',
    'B',
    null,
    'The exodus and Israel''s journey to Sinai',
    'Holy worship, community life, sacred time, and covenant obedience',
    'Tribal censuses and military organization',
    'Speeches preparing Israel to enter Canaan'
  ),
  (
    '1dabd731-6863-401b-a2da-a2c361ada45f',
    'B',
    null,
    'Daniel interpreting the king''s dream in Babylon',
    'Jehoiachin receiving a place at Babylon''s royal table',
    'Cyrus ordering Jerusalem''s temple rebuilt',
    'Ezra reading the law to the returned exiles'
  ),
  (
    '89a7bce5-0c5d-4716-8496-9673e186445b',
    'B',
    null,
    'The earthly ruler appointed over Rome',
    'The image of the invisible God, firstborn over creation',
    'The final priest descended from Levi',
    'One heavenly messenger among many'
  ),
  (
    'fbc8662c-aea9-42c0-8613-aef02523976b',
    'B',
    null,
    'A refrain repeated at the end of each psalm',
    'A divine charge followed by the people''s objection',
    'A royal dream followed by its interpretation',
    'A judge''s victory followed by his death'
  ),
  (
    '4eb80dc9-ee47-4143-8f51-e88d0c3c2eb5',
    'B',
    null,
    'They will be judged before the living',
    'They will rise before living believers are gathered',
    'They will remain asleep after the Lord comes',
    'They will return to ordinary mortal life'
  ),
  (
    '6d4db89b-a12f-4c1a-9e89-6b3b5ab57ad2',
    'A',
    null,
    'The LORD''s appointed annual festivals',
    'The monthly schedule of new-moon sacrifices',
    'The rotation of priestly divisions',
    'The tribal calendar for military service'
  ),
  (
    'aba95fa9-4d31-4607-a0b6-eb02bf48214a',
    'D',
    null,
    'Guard and cultivate only the garden',
    'Avoid every tree in the garden',
    'Remain within the land of Eden',
    'Be fruitful, multiply, and fill the earth'
  ),
  (
    '228ec7fd-16af-4fc8-9cf1-c2dd45475324',
    'B',
    null,
    'Holy, holy, holy is the LORD of hosts',
    'Woe is me, for I am lost and unclean',
    'Depart from me, for I am a sinful man',
    'Here I am; send me to the nations'
  ),
  (
    'd491ae59-72ee-4460-9006-c856989998a9',
    'B',
    null,
    'Return to Haran and serve Laban again',
    'Go to Bethel, settle there, and build an altar',
    'Travel to Egypt before the famine begins',
    'Remain at Shechem and renew the covenant'
  ),
  (
    'ccc6e75a-265a-4826-8c07-d15dbd0a056c',
    'D',
    null,
    'Enter the ark with your household',
    'Gather manna for the coming journey',
    'Circumcise every male in your household',
    'Build an ark from gopher wood'
  ),
  (
    '6e0f8c77-4e98-4b03-b1c6-fd25a51ee2bb',
    'D',
    null,
    'Solomon dedicating Jerusalem''s temple',
    'Assyria conquering Samaria',
    'Babylon destroying Jerusalem',
    'Cyrus permitting the temple to be rebuilt'
  ),
  (
    '72f38e9d-2a9e-42b4-8501-5a48459e2203',
    'C',
    null,
    'Roman guards sealing the entrance',
    'Jesus'' body still lying in the tomb',
    'An open tomb and a young man announcing resurrection',
    'The disciples waiting for them inside'
  ),
  (
    'dc81ab74-1e95-4807-9366-b81441d5a5b0',
    'A',
    null,
    'Love from a pure heart, good conscience, and sincere faith',
    'Separation from every unbelieving neighbor',
    'Skill in argument and public speaking',
    'Influence over the civic leaders of Ephesus'
  ),
  (
    '4d359b8e-f5cb-47e2-a822-1e14ed45fa1e',
    'B',
    null,
    'A military officer in Judah',
    'A herdsman and dresser of sycamore figs',
    'A temple singer from Jerusalem',
    'A royal scribe in Samaria'
  ),
  (
    '2e05d298-d6d8-4d78-bf08-bcb9a7656a7b',
    'B',
    null,
    'Hear this word against you',
    'For three transgressions, and for four',
    'Woe to those at ease in Zion',
    'Seek the LORD and live'
  ),
  (
    '8d0c26fd-12c9-4070-aeec-61423b4379b9',
    'A',
    null,
    'Abijah, daughter of Zechariah',
    'Jecoliah, daughter of Jerusalem',
    'Athaliah, daughter of Omri',
    'Maacah, daughter of Absalom'
  ),
  (
    '2b1d8f97-db98-4bc9-9262-2a4ec6417c3d',
    'C',
    null,
    'A private faith that needs no action',
    'A sincere confession sufficient by itself',
    'A dead faith incapable of saving',
    'An immature faith already complete'
  ),
  (
    '29059673-2218-4c42-85c4-344b1a8f031a',
    'A',
    null,
    'Be holy, because the LORD is holy',
    'Love the LORD with all your heart',
    'Do justice, love mercy, and walk humbly',
    'Remember the Sabbath and keep covenant'
  ),
  (
    'ef670def-8c67-413f-80bc-12ded66d0d7a',
    'C',
    null,
    'By generations in a genealogy',
    'By a sequence of Israelite kings',
    'By a sequence of dated prophetic messages',
    'By a series of alphabetic poems'
  ),
  (
    '39f7b9c8-d1b3-4492-ac54-ab90e18441b8',
    'B',
    'What physical covenant sign did God command for every male in Abraham''s household?',
    'Wear a covenant mark on the right hand',
    'Circumcise every male in Abraham''s household',
    'Offer a firstborn son',
    'Build an altar at Mamre'
  ),
  (
    'b92c1387-d794-4bab-945c-711a6ca61e22',
    'A',
    null,
    'Mount Sinai in the wilderness',
    'Mount Carmel in northern Israel',
    'Mount Zion in Jerusalem',
    'The plains of Moab near Jericho'
  ),
  (
    '1393a4fd-a435-4f3e-a261-c8b8e1b0569e',
    'C',
    null,
    'Zechariah, father of John',
    'Gamaliel, a teacher in Jerusalem',
    'Simeon, awaiting Israel''s consolation',
    'Joseph of Arimathea, a council member'
  ),
  (
    'c31d6fad-3dd9-40a9-bee7-efc8cf747b2d',
    'B',
    null,
    'It becomes pale with fear',
    'It shines after speaking with the LORD',
    'It is marked by a permanent scar',
    'It is hidden by a cloud'
  ),
  (
    'cbe28d94-9c3f-4c16-a08e-a8027058cb9e',
    'B',
    null,
    'The bronze altar for burnt offerings',
    'The ark of the covenant',
    'The bronze basin for priestly washing',
    'The outer court surrounding the tabernacle'
  );

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_distractor_length_repair_batch_3',
  'public',
  'ot_generated_questions',
  'data',
  jsonb_agg(
    jsonb_build_object('id', question.id, 'payload', question.payload)
    order by question.id
  )::text
from public.ot_generated_questions question
join obs_distractor_repairs_batch_3 repair
  on repair.id = question.id
having count(*) = 25
   and not exists (
     select 1
     from public.obs_schema_backups backup
     where backup.backup_tag =
             '20260729_distractor_length_repair_batch_3'
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
  where backup_tag = '20260729_distractor_length_repair_batch_3'
    and object_schema = 'public'
    and object_name = 'ot_generated_questions'
    and object_type = 'data';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Batch 3 backup count was %s.', backup_count);
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
    '"same_category_length_balanced_v3"'::jsonb
  )
from obs_distractor_repairs_batch_3 repair
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
  join obs_distractor_repairs_batch_3 repair
    on repair.id = question.id
  where question.payload->>'distractor_review'
    = 'same_category_length_balanced_v3';

  select count(*)
  into remaining_flags
  from public.obs_question_distractor_quality_audit audit
  join obs_distractor_repairs_batch_3 repair
    on repair.id = audit.generated_question_id
  where audit.requires_review;

  if repaired_count <> 25 or remaining_flags <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Batch 3 repair failed: repaired=%s flags=%s.',
        repaired_count,
        remaining_flags
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
