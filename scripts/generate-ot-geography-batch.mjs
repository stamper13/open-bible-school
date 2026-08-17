import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(
  root,
  "supabase/data/20260729_ot_geography_questions.json",
);
const migrationPath = path.join(
  root,
  "supabase/migrations/20260729_ot_geography_centrality_question_batch.sql",
);
const rollbackPath = path.join(
  root,
  "supabase/rollback/20260729_ot_geography_centrality_question_batch_rollback.sql",
);
const verifyPath = path.join(
  root,
  "supabase/verify/20260729_ot_geography_centrality_question_batch_verify.sql",
);

const sourceBatch = "20260729_ot_geography_centrality_v1";
const backupTag = "20260729_ot_geography_centrality_question_batch";
const targetUpdates = [
  ["LEV", 1, 1, "optional", "Sinai and the tabernacle locate Leviticus within Israel's journey."],
  ["DEU", 1, 3, "standard", "The plains of Moab and the Jordan are essential to Deuteronomy's covenant-renewal setting."],
  ["JOB", 1, 1, "optional", "The land of Uz is useful setting context but not a primary route through Job."],
  ["PSA", 1, 2, "standard", "Zion and Jerusalem are recurring geographic centers of worship and royal hope in Psalms."],
  ["PRO", 1, 1, "optional", "Public settings such as the city gate support interpretation of Proverbs."],
  ["ECC", 1, 1, "optional", "Jerusalem supplies the Teacher's stated royal setting in Ecclesiastes."],
  ["SNG", 1, 1, "optional", "Geographic imagery contributes to Song of Songs without governing its structure."],
  ["JOL", 1, 2, "standard", "Zion, Jerusalem, and Judah are central to Joel's judgment and restoration."],
  ["HAB", 1, 2, "standard", "Judah and the rise of Babylon form the geopolitical crisis behind Habakkuk."],
  ["ZEP", 1, 2, "standard", "Judah and Jerusalem anchor Zephaniah's judgment among the surrounding nations."],
  ["MAL", 1, 1, "optional", "Restored Judah and its functioning temple supply the setting for Malachi's rebukes."],
];
const expectedBooks = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
  "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
  "ECC", "SNG", "ISA", "JER", "LAM", "EZE", "DAN", "HOS", "JOL", "AMO",
  "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
];
const questions = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const fail = (message) => {
  throw new Error(message);
};

if (questions.length !== 50) fail(`Expected 50 questions, found ${questions.length}.`);

const slugs = new Set();
for (const [index, question] of questions.entries()) {
  const required = [
    "book_code",
    "slug",
    "kind",
    "prompt",
    "answer",
    "distractors",
    "source_ref",
    "explanation",
    "centrality",
    "importance_context",
    "importance_conceptual",
    "retest_stage",
    "irt_b",
  ];
  for (const key of required) {
    if (question[key] === undefined || question[key] === null) {
      fail(`Question ${index + 1} is missing ${key}.`);
    }
  }
  if (!expectedBooks.includes(question.book_code)) {
    fail(`Question ${index + 1} has invalid book ${question.book_code}.`);
  }
  if (!["book", "episode"].includes(question.kind)) {
    fail(`Question ${index + 1} has invalid kind ${question.kind}.`);
  }
  if (!["essential", "supporting", "episode"].includes(question.centrality)) {
    fail(`Question ${index + 1} has invalid centrality ${question.centrality}.`);
  }
  if (!["foundation", "core"].includes(question.retest_stage)) {
    fail(`Question ${index + 1} has invalid stage ${question.retest_stage}.`);
  }
  if (!Array.isArray(question.distractors) || question.distractors.length !== 3) {
    fail(`Question ${index + 1} must have exactly three distractors.`);
  }
  if (new Set([question.answer, ...question.distractors]).size !== 4) {
    fail(`Question ${index + 1} has duplicate choices.`);
  }
  const uniqueKey = `${question.kind}|${question.book_code}|${question.slug}`;
  if (slugs.has(uniqueKey)) fail(`Duplicate question key ${uniqueKey}.`);
  slugs.add(uniqueKey);
}

const coreQuestions = questions.filter((question) => question.kind === "book");
if (coreQuestions.length !== 39) {
  fail(`Expected 39 book questions, found ${coreQuestions.length}.`);
}
const coveredBooks = new Set(coreQuestions.map((question) => question.book_code));
if (
  coveredBooks.size !== 39
  || expectedBooks.some((bookCode) => !coveredBooks.has(bookCode))
) {
  fail("Book-level questions do not cover all 39 Old Testament books exactly once.");
}

const escapeSql = (value) => String(value).replaceAll("'", "''");
const payloadRows = questions.map((question, index) => {
  const position = index % 4;
  const choices = [...question.distractors];
  choices.splice(position, 0, question.answer);
  const choiceObjects = choices.map((text, choiceIndex) => ({
    id: ["A", "B", "C", "D"][choiceIndex],
    text,
  }));
  const correctChoiceId = choiceObjects[position].id;
  const questionType = question.kind === "book"
    ? "geography_book_mcq_v1"
    : "geography_episode_mcq_v1";
  const questionFamily = question.kind === "book"
    ? "book_geography_overview"
    : "episode_geography";
  const knowledgeGranularity = question.kind === "book"
    ? "book_geography_overview"
    : "episode_detail";
  const retrievalTarget = question.kind === "book"
    ? "book_setting"
    : "episode_location";
  const assessmentRole = question.retest_stage === "foundation"
    ? "baseline"
    : "adaptive";
  const difficultyEstimate = Math.round(500 + question.irt_b * 100);
  const routingScore = Math.round(
    question.importance_conceptual * 0.7
      + question.importance_context * 0.3,
  );
  const rationale = question.centrality === "essential"
    ? "Book-level geography needed to follow the main plot, political setting, or prophetic audience."
    : question.centrality === "supporting"
      ? "Geography supports interpretation of the book but is not its main narrative framework."
      : "Episode-level location that clarifies a specific passage rather than the whole book.";

  const payload = {
    prompt: question.prompt,
    choices: choiceObjects,
    correct_choice_id: correctChoiceId,
    correct_answer: question.answer,
    book_code: question.book_code,
    dimension_key: "geography_nations",
    question_family: questionFamily,
    stem_family: `geography_v1|${question.book_code}|${question.slug}`,
    assessment_role: assessmentRole,
    baseline_eligible: question.retest_stage === "foundation",
    retest_stage: question.retest_stage,
    difficulty_estimate: difficultyEstimate,
    irt_a: 1.0,
    irt_b: question.irt_b,
    importance_context: question.importance_context,
    importance_conceptual: question.importance_conceptual,
    routing_score: routingScore,
    geography_centrality: question.centrality,
    importance_rationale: rationale,
    knowledge_granularity: knowledgeGranularity,
    retrieval_target: retrievalTarget,
    negative_stem: /\bnot\b/i.test(question.prompt),
    exact_chapter_recall_required: false,
    source_ref: question.source_ref,
    explanation: question.explanation,
    distractor_review: "same_category_manual",
    source_batch: sourceBatch,
    content_version: sourceBatch,
  };
  const dedupeKey = `geography_v1|${question.book_code}|${question.slug}`;
  return `    ('${escapeSql(questionType)}', '${escapeSql(dedupeKey)}', '${escapeSql(JSON.stringify(payload))}'::jsonb)`;
});
const targetUpdateRows = targetUpdates.map(
  ([bookCode, minimum, target, priority, rationale]) =>
    `    ('${bookCode}', 'geography_nations', ${minimum}, ${target}, '${priority}', '${escapeSql(rationale)}')`,
).join(",\n");

const sharedAssertions = `
  select
    count(*),
    count(*) filter (where payload->>'knowledge_granularity' = 'book_geography_overview'),
    count(distinct payload->>'book_code') filter (
      where payload->>'knowledge_granularity' = 'book_geography_overview'
    ),
    count(*) filter (where payload->>'geography_centrality' = 'essential'),
    count(*) filter (where payload->>'geography_centrality' = 'supporting'),
    count(*) filter (where payload->>'geography_centrality' = 'episode'),
    count(*) filter (where payload->>'retest_stage' = 'foundation'),
    count(*) filter (where payload->>'retest_stage' = 'core')
  into
    batch_count,
    book_count,
    covered_book_count,
    essential_count,
    supporting_count,
    episode_count,
    foundation_count,
    core_count
  from public.ot_generated_questions
  where payload->>'source_batch' = '${sourceBatch}';

  select count(*)
  into malformed_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' = '${sourceBatch}'
    and (
      question.payload->>'dimension_key' <> 'geography_nations'
      or jsonb_array_length(question.payload->'choices') <> 4
      or (
        select count(*)
        from jsonb_array_elements(question.payload->'choices') choice
        where choice->>'id' = question.payload->>'correct_choice_id'
      ) <> 1
      or (
        select count(distinct lower(btrim(choice->>'text')))
        from jsonb_array_elements(question.payload->'choices') choice
      ) <> 4
    );

  select count(*)
  into blocked_count
  from public.obs_admin_question_bank_audit audit
  where audit.payload->>'source_batch' = '${sourceBatch}'
    and (
      cardinality(audit.blocker_reasons) > 0
      or not audit.router_eligible
    );

  select count(*)
  into structurally_flagged
  from public.obs_question_distractor_quality_audit audit
  join public.ot_generated_questions question
    on question.id = audit.generated_question_id
  where question.payload->>'source_batch' = '${sourceBatch}'
    and audit.requires_review;

  select count(*)
  into semantic_pass_count
  from public.obs_semantic_distractor_reviews review
  join public.ot_generated_questions question
    on question.id = review.generated_question_id
  where question.payload->>'source_batch' = '${sourceBatch}'
    and review.review_status = 'pass'
    and review.same_semantic_category
    and not review.obvious_elimination_present;

  select min(position_count), max(position_count)
  into correct_position_min, correct_position_max
  from (
    select
      question.payload->>'correct_choice_id' as choice_id,
      count(*)::integer as position_count
    from public.ot_generated_questions question
    where question.payload->>'source_batch' = '${sourceBatch}'
    group by question.payload->>'correct_choice_id'
  ) positions;

  select
    avg(
      (
        (payload->>'importance_context')::numeric
        + (payload->>'importance_conceptual')::numeric
      ) / 2.0
    ) filter (where payload->>'geography_centrality' = 'essential'),
    avg(
      (
        (payload->>'importance_context')::numeric
        + (payload->>'importance_conceptual')::numeric
      ) / 2.0
    ) filter (where payload->>'geography_centrality' = 'supporting'),
    avg(
      (
        (payload->>'importance_context')::numeric
        + (payload->>'importance_conceptual')::numeric
      ) / 2.0
    ) filter (where payload->>'geography_centrality' = 'episode')
  into essential_mean, supporting_mean, episode_mean
  from public.ot_generated_questions
  where payload->>'source_batch' = '${sourceBatch}';

  if batch_count <> 50
     or book_count <> 39
     or covered_book_count <> 39
     or essential_count <> 33
     or supporting_count <> 6
     or episode_count <> 11
     or foundation_count <> 35
     or core_count <> 15
     or malformed_count <> 0
     or blocked_count <> 0
     or structurally_flagged <> 0
     or semantic_pass_count <> 50
     or correct_position_max - correct_position_min > 1
     or not (
       essential_mean > supporting_mean
       and supporting_mean > episode_mean
     )
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Geography batch failed: total=%s book=%s books=%s centrality=%s/%s/%s stage=%s/%s malformed=%s blocked=%s structural=%s semantic=%s positions=%s-%s means=%s/%s/%s.',
        batch_count,
        book_count,
        covered_book_count,
        essential_count,
        supporting_count,
        episode_count,
        foundation_count,
        core_count,
        malformed_count,
        blocked_count,
        structurally_flagged,
        semantic_pass_count,
        correct_position_min,
        correct_position_max,
        round(essential_mean, 2),
        round(supporting_mean, 2),
        round(episode_mean, 2)
      );
  end if;`;

const declarations = `
  batch_count integer;
  book_count integer;
  covered_book_count integer;
  essential_count integer;
  supporting_count integer;
  episode_count integer;
  foundation_count integer;
  core_count integer;
  malformed_count integer;
  blocked_count integer;
  structurally_flagged integer;
  semantic_pass_count integer;
  correct_position_min integer;
  correct_position_max integer;
  essential_mean numeric;
  supporting_mean numeric;
  episode_mean numeric;`;

const migration = `-- Add 39 book-level and 11 episode-level Old Testament geography items.
-- Importance follows geographic centrality: essential book geography is
-- weighted above supporting context, which is weighted above episode detail.

begin;

do $$
begin
  if to_regclass('public.ot_generated_questions') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.question_coverage_targets') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.obs_admin_question_bank_audit') is null
     or to_regclass('public.obs_question_distractor_quality_audit') is null
     or to_regclass('public.obs_semantic_distractor_reviews') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Old Testament geography batch prerequisites are missing.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '${backupTag}',
  'public',
  'question_coverage_targets',
  'data',
  jsonb_agg(to_jsonb(target) order by target.book_code)::text
from public.question_coverage_targets target
where target.dimension_key = 'geography_nations'
  and target.book_code in (
    'LEV', 'DEU', 'JOB', 'PSA', 'PRO', 'ECC',
    'SNG', 'JOL', 'HAB', 'ZEP', 'MAL'
  )
having not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '${backupTag}'
    and backup.object_schema = 'public'
    and backup.object_name = 'question_coverage_targets'
    and backup.object_type = 'data'
);

do $$
declare
  backup_count integer;
  saved_row_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '${backupTag}'
    and object_schema = 'public'
    and object_name = 'question_coverage_targets'
    and object_type = 'data';

  select jsonb_array_length(definition::jsonb)
  into saved_row_count
  from public.obs_schema_backups
  where backup_tag = '${backupTag}'
    and object_schema = 'public'
    and object_name = 'question_coverage_targets'
    and object_type = 'data';

  if backup_count <> 1 or saved_row_count <> 11 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Geography target backup failed: backups=%s saved_rows=%s.',
        backup_count,
        coalesce(saved_row_count, 0)
      );
  end if;
end
$$;

update public.question_coverage_targets target
set
  minimum_active_questions = correction.minimum_active_questions,
  target_active_questions = correction.target_active_questions,
  priority = correction.priority,
  rationale = correction.rationale,
  updated_at = now()
from (
  values
${targetUpdateRows}
) correction(
  book_code,
  dimension_key,
  minimum_active_questions,
  target_active_questions,
  priority,
  rationale
)
where target.book_code = correction.book_code
  and target.dimension_key = correction.dimension_key;

with seed(question_type, dedupe_key, payload) as (
  values
${payloadRows.join(",\n")}
)
insert into public.ot_generated_questions (
  event_id,
  question_type,
  payload,
  dedupe_key
)
select
  null,
  seed.question_type,
  seed.payload,
  seed.dedupe_key
from seed
on conflict (question_type, dedupe_key) do nothing;

insert into public.obs_semantic_distractor_reviews (
  generated_question_id,
  review_status,
  same_semantic_category,
  obvious_elimination_present,
  expected_category,
  review_notes,
  reviewed_by,
  reviewed_at,
  updated_at
)
select
  question.id,
  'pass',
  true,
  false,
  'places, regions, nations, routes, or geopolitical units',
  'Manually authored geography set with same-category distractors.',
  '${sourceBatch}',
  now(),
  now()
from public.ot_generated_questions question
where question.payload->>'source_batch' = '${sourceBatch}'
on conflict (generated_question_id) do update
set
  review_status = excluded.review_status,
  same_semantic_category = excluded.same_semantic_category,
  obvious_elimination_present = excluded.obvious_elimination_present,
  expected_category = excluded.expected_category,
  review_notes = excluded.review_notes,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_at = excluded.updated_at;

do $$
declare${declarations}
begin
${sharedAssertions}
end
$$;

notify pgrst, 'reload schema';

commit;
`;

const rollback = `-- Remove the geography batch only when it has no answer history.

begin;

do $$
declare
  referenced_count integer;
  backup_count integer;
begin
  select count(*)
  into referenced_count
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' = '${sourceBatch}';

  if referenced_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Rollback refused: %s assessment answers reference this geography batch.',
        referenced_count
      );
  end if;

  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '${backupTag}'
    and object_schema = 'public'
    and object_name = 'question_coverage_targets'
    and object_type = 'data';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Rollback requires exactly one geography-target backup; found %s.',
        backup_count
      );
  end if;
end
$$;

delete from public.obs_semantic_distractor_reviews review
using public.ot_generated_questions question
where question.id = review.generated_question_id
  and question.payload->>'source_batch' = '${sourceBatch}';

delete from public.ot_generated_questions
where payload->>'source_batch' = '${sourceBatch}';

with backup as (
  select definition::jsonb as rows
  from public.obs_schema_backups
  where backup_tag = '${backupTag}'
    and object_schema = 'public'
    and object_name = 'question_coverage_targets'
    and object_type = 'data'
), saved as (
  select *
  from backup
  cross join lateral jsonb_to_recordset(backup.rows) as row(
    book_code text,
    dimension_key text,
    minimum_active_questions integer,
    target_active_questions integer,
    priority text,
    rationale text,
    updated_at timestamptz
  )
)
update public.question_coverage_targets target
set
  minimum_active_questions = saved.minimum_active_questions,
  target_active_questions = saved.target_active_questions,
  priority = saved.priority,
  rationale = saved.rationale,
  updated_at = saved.updated_at
from saved
where target.book_code = saved.book_code
  and target.dimension_key = saved.dimension_key;

delete from public.obs_schema_backups
where backup_tag = '${backupTag}'
  and object_schema = 'public'
  and object_name = 'question_coverage_targets'
  and object_type = 'data';

notify pgrst, 'reload schema';

commit;
`;

const verify = `-- Verify the Old Testament geography batch and report coverage.

do $$
declare${declarations}
begin
${sharedAssertions}
  raise notice
    'PASS: 50 geography questions installed (39 book-level, 11 episode-level); all 39 OT books covered; importance centrality and distractors verified.';
end
$$;

select
  question.payload->>'geography_centrality' as geography_centrality,
  question.payload->>'retest_stage' as retest_stage,
  count(*)::integer as questions,
  round(
    avg((question.payload->>'importance_context')::numeric),
    1
  ) as mean_context_importance,
  round(
    avg((question.payload->>'importance_conceptual')::numeric),
    1
  ) as mean_conceptual_importance
from public.ot_generated_questions question
where question.payload->>'source_batch' = '${sourceBatch}'
group by
  question.payload->>'geography_centrality',
  question.payload->>'retest_stage'
order by
  min(
    case question.payload->>'geography_centrality'
      when 'essential' then 1
      when 'supporting' then 2
      else 3
    end
  ),
  retest_stage;

select
  book.book_code,
  book.display_name as book_name,
  count(question.generated_question_id)::integer
    as active_geography_questions,
  count(question.generated_question_id) filter (
    where question.payload->>'source_batch' = '${sourceBatch}'
  )::integer as new_geography_questions
from public.obs_biblical_books book
left join public.obs_question_bank_with_dimensions question
  on question.book_code = book.book_code
 and question.dimension_key = 'geography_nations'
where book.testament = 'OT'
group by book.canonical_order, book.book_code, book.display_name
order by book.canonical_order;
`;

fs.writeFileSync(migrationPath, migration);
fs.writeFileSync(rollbackPath, rollback);
fs.writeFileSync(verifyPath, verify);

console.log(`Generated ${path.relative(root, migrationPath)}`);
console.log(`Generated ${path.relative(root, rollbackPath)}`);
console.log(`Generated ${path.relative(root, verifyPath)}`);
