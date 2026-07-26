# Frontend Implementation Prompt: Assessment Insights and Persistent NT

Use this prompt in the frontend implementation chat.

---

You are updating the Open Bible Assessment frontend in:

`/Users/stamper35/open-bible-school/web`

The Supabase backend migrations below have already been prepared. Do not alter
their contracts unless a real incompatibility is found:

- `20260723_assessment_insights_backend.sql`
- `20260723_question_quality_console.sql`
- `20260723_nt_persistent_adaptive.sql`

Preserve the current visual system, star field, dashboard tabs, assessment card,
BLI vessel, transitions, anonymous-session behavior, and responsive layout.
Implement one feature at a time and test each on desktop and mobile. Do not
redesign unrelated parts of the site.

## 1. Results and Answer Review

Create a real results view, preferably `/results/[attemptId]`.

On load:

```ts
const { data: summary } = await supabase.rpc("obs_get_attempt_summary", {
  p_user_id: session.user.id,
  p_attempt_id: attemptId,
});

const { data: reviewRows } = await supabase.rpc("obs_get_attempt_review", {
  p_user_id: session.user.id,
  p_attempt_id: attemptId,
});
```

`summary` is a JSON object:

```ts
type AttemptSummary = {
  attempt_id: string;
  testament: "OT" | "NT";
  answered: number;
  correct: number;
  idk: number;
  accuracy: number | null;
  started_at: string | null;
  completed_at: string | null;
  snapshot: {
    attempt_id: string;
    testament: "OT" | "NT";
    raw_bli: number;
    display_bli: number;
    bli_level: string;
    questions_answered: number;
    correct_answers: number;
    idk_answers: number;
    theta: number | null;
    theta_se: number | null;
    n_responses: number;
    section_scores: Record<string, unknown>;
    captured_at: string;
  } | null;
  breakdown: Array<{
    type: "section" | "book" | "dimension";
    key: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
};
```

Each review row contains:

```ts
type AttemptReviewRow = {
  answer_id: string;
  answered_at: string;
  generated_question_id: string;
  prompt: string;
  choices: Array<{ id: string; text: string }>;
  selected_choice_id: string | null;
  selected_choice_text: string | null;
  correct_choice_id: string;
  correct_choice_text: string | null;
  is_correct: boolean;
  is_idk: boolean;
  book_code: string;
  section: string;
  dimension_key: string;
  source_ref: string | null;
  explanation: string | null;
};
```

Design:

- Make the score change and BLI result the first visual signal.
- Add compact summary metrics for answered, correct, skipped, and accuracy.
- Add tabs or a segmented control: `All`, `Review missed`, `Skipped`.
- Each answer row should clearly show the user's answer, correct answer,
  reference, and explanation without exposing all rows as giant cards.
- Use an accordion/list pattern for review rows.
- Keep `Continue assessment` and `Dashboard` as the main actions.
- When an assessment reaches its target, replace the small floating results
  control with a prominent results action in the assessment card.

## 2. Progress Over Time

Add a compact progress module to the BLI dashboard.

For an existing user with no snapshots, backfill once:

```ts
await supabase.rpc("obs_backfill_assessment_snapshots", {
  p_user_id: session.user.id,
});
```

Then load:

```ts
const { data: history } = await supabase.rpc("obs_get_progress_history", {
  p_user_id: session.user.id,
  p_testament: activeTestament, // "OT" or "NT"
  p_limit: 50,
});
```

Rows are returned newest first:

```ts
type ProgressPoint = {
  attempt_id: string;
  captured_at: string;
  raw_bli: number;
  display_bli: number;
  bli_level: string;
  questions_answered: number;
  correct_answers: number;
  idk_answers: number;
  theta: number | null;
  theta_se: number | null;
  n_responses: number;
  score_change: number;
};
```

Reverse a copy for chronological chart rendering. Use a restrained line chart
or stepped constellation-like path that fits the existing starry dashboard.
Show date, displayed BLI, level, cumulative questions, and change on hover/tap.
Do not imply that ordinary answer-to-answer movement is statistically
significant.

## 3. Replace Fake Confidence with Evidence Strength

Remove the frontend formula based only on answer count. Load:

```ts
const { data } = await supabase.rpc("obs_get_bli_uncertainty", {
  p_user_id: session.user.id,
  p_scope: activeTestament, // "OT" or "NT"
});
const evidence = data?.[0] ?? null;
```

Response:

```ts
type BliEvidence = {
  scope: string;
  theta: number;
  theta_se: number;
  theta_lower_95: number;
  theta_upper_95: number;
  n_responses: number;
  evidence_level:
    | "Very limited"
    | "Limited"
    | "Developing"
    | "Strong"
    | "Very strong";
  evidence_description: string;
};
```

Display `Evidence` or `Score evidence`, the label, and response count. Put the
description in the existing tooltip/popover style.

Important: `theta_lower_95` and `theta_upper_95` are ability-scale values, not
200-800 BLI values. Do not display them as a BLI score range and do not label
them as a percentage.

## 4. Clickable Section, Book, Dimension, and Unit Details

Make existing dashboard scope graphics interactive. On click:

```ts
const { data: scope } = await supabase.rpc("obs_get_scope_summary", {
  p_user_id: session.user.id,
  p_scope_type: scopeType,
  p_scope_key: scopeKey,
});
```

Valid `p_scope_type` values:

- `TESTAMENT`: `OT` or `NT`
- `SECTION`: exact display label such as `Torah` or `Gospels & Acts`
- `BOOK`: canonical code such as `GEN` or `ROM`
- `DIMENSION`: canonical dimension key
- `UNIT`: learning-unit key such as `gen-12-50`

Response:

```ts
type ScopeSummary = {
  scope_type: string;
  scope_key: string;
  answered: number;
  correct: number;
  idk: number;
  accuracy: number | null;
  first_answered_at: string | null;
  last_answered_at: string | null;
  evidence_level:
    | "Needs more evidence"
    | "Low evidence"
    | "Moderate evidence"
    | "High evidence";
  books: Array<{
    book_code: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
  dimensions: Array<{
    dimension_key: string;
    answered: number;
    correct: number;
    idk: number;
    accuracy: number | null;
  }>;
};
```

Use a drawer or unframed detail panel, not a nested card wall. Show evidence
before accuracy when the sample is small. Include a focused assessment action
only where the current recommendation/retest rules permit it.

Record recommendation interactions without blocking navigation:

```ts
await supabase.rpc("obs_record_study_event", {
  p_user_id: session.user.id,
  p_unit_key: unitKey,
  p_event_type: "reading_started", // or another supported event
  p_attempt_id: attemptId ?? null,
  p_metadata: { source: "dashboard_recommendation" },
});
```

Supported event types:

- `recommendation_viewed`
- `reading_started`
- `reading_completed`
- `retest_started`
- `retest_completed`
- `recommendation_dismissed`

## 5. Migrate the NT Pilot to Persistent Adaptive Attempts

Do not fetch a batch with `nt_get_pilot_questions` for the new flow. Ensure a
Supabase session exists first. A signed-out visitor should use
`supabase.auth.signInAnonymously()` just like the OT assessment.

Start:

```ts
const { data, error } = await supabase.rpc("obs_start_nt_assessment", {
  p_section: selectedDivision ?? null,
  p_book_code: selectedBookCode ?? null,
  p_target_question_count: 20,
});
const attempt = data?.[0];
```

Start response:

```ts
{
  attempt_id: string;
  user_id: string;
  testament: "NT";
  scope_key: string;
  target_question_count: number;
  available_question_count: number;
}
```

Fetch one question:

```ts
const { data } = await supabase.rpc(
  "obs_get_next_nt_assessment_question",
  { p_attempt_id: attemptId }
);
const question = data?.[0] ?? null;
```

Question response does not contain the answer key:

```ts
{
  out_generated_question_id: string;
  prompt: string;
  question_type: string;
  choices: Array<{ id: string; text: string }>;
  book_code: string;
  book_name: string;
  nt_division: string;
  answered_count: number;
  target_question_count: number;
}
```

Submit:

```ts
const { data } = await supabase.rpc("obs_submit_nt_assessment_answer", {
  p_attempt_id: attemptId,
  p_generated_question_id: questionId,
  p_selected_choice_id: choiceId, // "__IDK__" is supported
});
const result = data?.[0];
```

Submit response:

```ts
{
  is_correct: boolean;
  is_idk: boolean;
  correct_choice_id: string;
  answered_count: number;
  correct_count: number;
  target_question_count: number;
  target_reached: boolean;
  remaining_count: number;
}
```

After feedback, fetch the next question. When `target_reached` is true, show the
real results action and use the same results route as OT. Persist only the
attempt ID in session storage for refresh recovery; Supabase is the source of
truth for answers and progress.

Resume/status RPC:

```ts
const { data } = await supabase.rpc("obs_get_nt_assessment_status", {
  p_attempt_id: attemptId,
});
```

## 6. Internal Question Quality Console

This is an internal-only page. Never put a Supabase service-role key in client
code or any `NEXT_PUBLIC_*` variable.

Implement server-only access using a protected Next.js route handler or server
component and a server environment variable named `SUPABASE_SERVICE_ROLE_KEY`.
Require an explicit admin allowlist before serving data.

Server-side RPC:

```ts
await adminSupabase.rpc("obs_admin_get_question_quality_queue", {
  p_review_status: null,
  p_needs_attention: true,
  p_book_code: null,
  p_dimension_key: null,
  p_limit: 100,
  p_offset: 0,
});
```

Review action:

```ts
await adminSupabase.rpc("obs_admin_set_question_review_status", {
  p_generated_question_id: questionId,
  p_review_status: "approved", // pending | approved | revise | quarantined
  p_review_notes: notes || null,
});
```

The queue includes metadata status, response count, percent correct, IDK count,
choice distribution, report count/categories, review status, and
`needs_attention`. Add filters for status, book, and dimension. Use a dense
work-focused table with a side review panel.

Quarantining removes a question from active serving by changing its type to the
existing `quarantined...` convention. Approving a question quarantined through
this new console restores its original type. Confirm before quarantine.

Coverage data is available server-side from:

```ts
adminSupabase.from("obs_admin_coverage_quality").select("*");
```

## Required States and Validation

- Handle missing sessions, unauthorized attempts, empty histories, and users
  with too little evidence.
- Never infer anonymous progress from old local counters when Supabase attempt
  data exists.
- Do not expose correct answers before a submission.
- Do not expose any admin view or service key to browser code.
- Keep OT behavior working while migrating NT.
- Test refresh recovery, anonymous-to-account migration, sign-out isolation,
  OT completion, NT completion, IDK answers, and mobile layout.
- Run the existing lint/build checks and visually inspect both assessment modes
  plus the dashboard before deployment.

---
