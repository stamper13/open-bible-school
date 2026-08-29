# V7 Law Commands Metadata Review - 2026-08-26

## Purpose

Follow up on the 300-question V7 branch replay after the long-run section brake.

That replay improved section balance, but `law_commands` remained low:

- 21/300 questions;
- 7.0% share;
- same share as the prior 500-question replay.

No production routing was changed. The live app-facing RPC chain remains V6.

## Finding

A focused branch audit showed the law pool problem was mostly metadata review
state, not broken question content.

Law-command bank totals:

- total `law_commands` rows: 88;
- broad/mid rows, depth 1-3: 40;
- accepted broad/mid rows before this pass: 7;
- clean `needs_review` broad/mid rows: 33;
- chapter-addressed broad/mid rows: 0.

The 33 clean rows were demoted by V7 because their ladder metadata had:

- `review_status = 'needs_review'`;
- `review_notes = 'Low deterministic confidence from available structured metadata.'`;
- depth 1-3;
- no chapter-addressed prompt flag.

Representative prompts from the promoted set:

- "What was Israel's king commanded to write and read regularly?"
- "What rhythm does the manna story teach Israel to observe?"
- "What command summarizes the holiness emphasis in Leviticus?"
- "Why were Israelites commanded to wear tassels on their garments?"
- "What did the LORD command Joshua to meditate on day and night?"

These are appropriate broad/mid law-command evidence rows. They should not be
penalized as risky metadata simply because the deterministic backfill was
conservative.

## Change Added

Added:

- `supabase/migrations/20260826161000_v7_law_commands_metadata_review.sql`
- `supabase/rollback/20260826161000_v7_law_commands_metadata_review_rollback.sql`
- `supabase/verify/20260826161000_v7_law_commands_metadata_review_verify.sql`

The migration:

- updates only `obs_question_ladder_metadata`;
- promotes exactly 33 clean broad/mid `law_commands` rows from `needs_review`
  to `reviewed`;
- marks `metadata_source = 'manual'`;
- raises metadata confidence to at least `0.8600`;
- leaves chapter-addressed law detail rows demoted;
- does not change question content;
- does not change scoring;
- does not route live learners to V7.

## Branch Verification

Applied only to the V7 Supabase branch:

`v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

Verifier result:

- `PASS: V7 law metadata review verifier completed under rollback`

The verifier confirmed:

- exactly 33 law rows carry the V7 law coverage review marker;
- no clean broad/mid law rows remain in `needs_review`;
- chapter-addressed law detail rows remain demoted;
- the live next-question RPC still does not call V7;
- displayed BLI still does not use V7 ladder metadata.

## Probe Note

I attempted a lightweight post-promotion synthetic pool probe, but the Supabase
MCP SQL parser rejected the synthetic attempt insert before SQL execution. The
partial scaffold was cleaned immediately:

- synthetic auth users remaining: 0;
- synthetic attempts remaining: 0;
- synthetic answers remaining: 0;
- helper table dropped: true.

Because the migration verifier passed and the prior 300-question replay already
established the pre-promotion baseline, the right next validation is a clean
300-question replay after this metadata pass.

## Recommendation

Do not activate V7 broadly yet.

Run one more 300-question branch replay after this law metadata pass. The pass
should show whether `law_commands` rises now that clean broad/mid law rows are
not review-demoted. If law improves while section balance holds, the next step
is an opt-in V7 activation wrapper for smoke testing.
