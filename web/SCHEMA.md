# Supabase Data Model

This documents the Supabase backend (project `idyavsqksxtgogpfwlei`) for
anyone who needs to read or change it. The database does not document
itself well yet — this file exists to close that gap. See `README.md` for
the app and `COLLABORATING.md` for environment setup.

**Last verified:** 2026-08-20, against 55 public tables / 153 public functions /
31 public views, by tracing every `.rpc()` and `.from()` call in this repo's
`app/`, `lib/`, `components/`, `scripts/`, and `tests/` directories back into
the schema. The live Supabase migration ledger had 194 rows, latest
`20260820123333 restore_ot_submit_chain`.
See "How to re-verify this" at the bottom before trusting anything here on
a much later date.

## Glossary

- **BLI** — Bible Literacy Index. The app's core proficiency score. Stored
  internally as `raw_bli` (0–100), shown to users as `display_bli` (0–800,
  `= round(raw * 8)`, see `lib/bli.ts`). Levels: Unfamiliar → Acquainted →
  Familiar → Literate → Studied → Learned → Scholar.
- **`obs_` prefix** — the current schema generation, apparently "Open Bible
  School." Functions and tables *without* this prefix predate it. Their
  presence is not a reliable signal of relevance — some unprefixed
  functions are current (`credential_exams`, `question_reports`), some are
  dead leftovers from before the `obs_` rewrite. Don't assume either way;
  check the canonical RPC list below or re-run the grep.
- **theta** — IRT (item response theory) ability estimate, the underlying
  statistical model that BLI and question routing are built on.
- **router** — the adaptive logic that picks the next question. Has gone
  through several major rewrites (see "Versioning" below); the current one
  is `obs_rank_ot_assessment_candidates_v5`.
- **dimension** — one of 7 knowledge categories a question is tagged with
  (`characters_lineage`, `events_timeline`, `geography_nations`,
  `law_commands`, `promise_prophecy`, `theological_reasoning`,
  `structure_cross_ref`). See `obs_bli_dimensions`.

## The canonical RPC surface

These are the **only** functions this app actually calls (verified by
grepping every `.rpc("...")` in the repo). If you're trying to understand
what the backend does, start here — not by browsing the function list in
the Supabase dashboard, which includes ~120 other functions that are either
internal helpers, admin/manual tooling, or dead code (see below).

| Function | Purpose |
|---|---|
| `obs_get_bli_scores_v2` | **Canonical scoring contract.** The only BLI-reading RPC the app calls. Several older BLI functions (`compute_bli`, `obs_get_testament_bli_scores`, `get_user_section_scores`) were removed 2026-08-18 — if you find a reference to them in old notes/docs, they no longer exist. |
| `obs_get_bli_section_followup_v1` | Which section to route the user to next, based on weakest evidence. |
| `obs_get_bli_uncertainty` | Posterior confidence interval on the theta estimate. |
| `obs_get_next_ot_assessment_question` | Entry point for "give me the next OT question." Delegates internally to either the adaptive baseline router or the focused-retest selector. |
| `obs_get_next_nt_assessment_question` | Same, for New Testament (much smaller pilot feature). |
| `obs_start_or_resume_ot_assessment_v2` | Starts/resumes an OT assessment attempt. `_v2` is the app-facing RPC, but its ordinary OT path delegates internally to `obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)`. That unsuffixed function is still load-bearing even though the frontend never calls it directly. |
| `obs_start_nt_assessment` | Starts an NT assessment attempt. |
| `obs_submit_ot_assessment_response_v2` | Grades and persists an OT answer. `_v2` is the app-facing RPC, but the live submit chain still delegates internally through `obs_submit_ot_assessment_response(uuid,uuid,text)` and `submit_assessment_answer_v1(uuid,uuid,uuid,text)`. Do not drop any link in this chain unless the live function body has been checked. |
| `obs_submit_nt_assessment_answer` | Same, for NT. |
| `obs_submit_section_sort_answers` | Grades the drag/drop "put these in order" question type. |
| `obs_skip_broken_assessment_question` | User-facing "this question is broken" skip + auto-quarantine. |
| `obs_get_user_recommendation_v2` | "What should I study next" recommendation engine. `_v2` is current; the unsuffixed original was removed 2026-08-18. `obs_get_user_recommendation_pre_ladder` also still exists and is *not* called directly — check before touching it. |
| `obs_get_current_focus_path`, `obs_get_ladder_state_v1` | Support the recommendation/study-path UI. |
| `obs_get_attempt_summary`, `obs_get_attempt_review` | Post-assessment results screens. |
| `obs_get_scope_summary`, `obs_get_nt_assessment_status`, `obs_get_progress_history` | Dashboard/progress data. |
| `obs_get_public_question_metadata` | Answer-free question metadata for the knowledge-map visualization. |
| `obs_get_random_starfield_passage` | Powers the `BlackHoleEvent` mini-game. |
| `obs_record_study_event` | Logs reading-log / study activity. |
| `obs_issue_anonymous_transfer_token`, `obs_claim_anonymous_transfer` | Guest-to-account progress transfer. Restored in `supabase/migrations/20260820054500_restore_anonymous_transfer_rpcs.sql` with the private token table hardened in `20260820060000_harden_anonymous_transfer_token_table.sql`. |
| `obs_admin_get_question_quality_queue`, `obs_admin_set_question_review_status` | Admin console only (`app/api/admin/`), gated by `SUPABASE_SERVICE_ROLE_KEY` + email allowlist — bypasses RLS entirely. |
| `obs_backfill_assessment_snapshots` | Ops/maintenance RPC, not part of normal user flow. |

The app also queries a handful of tables/views **directly** (no RPC):
`assessment_answers`, `question_reports`, `scripture_books`,
`obs_reading_log_entries`, `obs_starfield_rewards`, and the
`obs_admin_*_audit*` views (admin console only).

## Versioning — the trap to know about

This schema has been through at least two full rewrites without fully
retiring the previous generation. You will regularly find `foo`, `foo_v2`,
sometimes `foo_v4`/`foo_v5` all still present in the database. **The
function name alone does not tell you which is current.** Some are marked
in their own comment (`obj_description`) as `LEGACY` or `DEPRECATED` — read
those first with:

```sql
select proname, obj_description(oid) from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'the_name_you_are_checking';
```

But most aren't commented at all. The only reliable check is: **does
anything in this repo actually call it?**

```bash
grep -rn "the_function_name" app lib components scripts tests
```

If that's empty, also check whether another *live* function calls it
internally (some routing/helper functions are only reached indirectly —
`obs_get_next_focused_question_v2` for example is never called directly by
the app, only from inside `obs_get_next_ot_assessment_question`). Don't
drop something just because the frontend doesn't call it by name — verify
the full chain, including triggers (`information_schema.triggers`, check
both `public` and `auth` schemas) and `CHECK` constraints
(`pg_get_constraintdef`), which invoke functions invisibly on every
write.

On 2026-08-18, 14 functions were removed in a cleanup pass. That pass was
too narrow: it checked app callers, triggers, and constraints, but missed
function-to-function calls inside live function bodies. The ordinary OT
start path was restored from repository source in
`supabase/migrations/20260818180000_restore_obs_start_or_resume_ot_assessment.sql`.
The OT submit path was restored on 2026-08-20 in
`supabase/migrations/20260820123333_restore_ot_submit_chain.sql`.
That restore deliberately uses repo source for `submit_assessment_answer_v2`
and `obs_submit_ot_assessment_response`, and restores
`submit_assessment_answer_v1` only as a compatibility delegate to v2. The
companion verification script asserts the full live chain:
browser `_v2` → internal response delegate → `obs_submit_ot_assessment_answer`
→ v1 shim → v2 grading/theta writer.

## Table categories

The schema is not one uniform thing. Roughly:

- **Live core** — `users`, `assessment_attempts`, `assessment_answers`,
  `ot_generated_questions`, `cross_references`, `credential_exams`, the
  `obs_bli_*` / `obs_router_*` support tables. Actively read/written by the
  RPC surface above.
- **A paused, unfinished feature** — `bible_entities`, `bible_events`,
  `scripture_sections`, `scripture_verses`, and related tables. Still
  empty, but heavily foreign-key-interlinked with each other and with
  `cross_references` (which *does* have 69k real rows, loaded ~Aug 2026).
  This looks like a knowledge-graph feature whose data layer was built but
  whose UI/generation layer was either abandoned or never finished. Treat
  this as a product decision (finish it or remove it), not something to
  quietly drop.
- **Admin / content-QA tooling** — `obs_length_tell_review_queue`,
  `obs_semantic_distractor_reviews`, `obs_router_shadow_log`,
  `obs_relationship_question_reviews`, etc. Real data, but populated and
  read through direct SQL / the admin console rather than the deployed
  app's normal user flow. Don't mistake "not called by `.rpc()`" for "dead"
  here — check the admin routes in `app/api/admin/` first.

## What was removed on 2026-08-18

For history: this schema originally had ~100 tables, ~169 functions, and
40 views. A verified cleanup pass removed 45 tables, 18 functions, and 9
views that had zero rows/callers, no foreign-key dependents, and no
reference anywhere in this repo (including triggers and `CHECK`
constraints). Two tables (`obs_map_basemaps`, `obs_semantic_distractor_reviews`)
also had Row Level Security disabled, fully exposing them to the public
`anon` key; RLS is now enabled on both. Nothing user-facing changed —
everything removed was independently confirmed unreachable through
multiple channels before deletion.

## How to re-verify this document

This file will go stale. To check whether it still matches reality:

```bash
# 1. What does the app actually call?
grep -rhoE '\.rpc\(\s*["\x27][a-zA-Z0-9_]+["\x27]' app lib components scripts tests | sort -u
grep -rhoE '\.from\(\s*["\x27][a-zA-Z0-9_]+["\x27]' app lib components scripts tests | sort -u
```

For the live RPC existence contract, run
`supabase/verify/frontend_rpc_contract_verify.sql` against the target database.

Then cross-reference that list against `pg_proc`/`pg_tables` in Supabase
(via the dashboard SQL editor or MCP). Anything in the database but not in
either grep result needs the fuller check described in "Versioning" above
before you conclude it's dead — triggers and CHECK constraints call
functions invisibly.
