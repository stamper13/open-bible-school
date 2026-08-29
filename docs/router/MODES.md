# Routing modes

Decided per learner by `obs_router_mode(user_id)`. Returns `cold_start`
whenever `obs_router_policy_config.campaign_enabled` is false, which is how v6
stays inert before rollout.

| Mode | When | Goal | Selector |
|---|---|---|---|
| `cold_start` | Fewer completed general assessments than `cold_start_completed_attempts` (default 1), or any canonical section is still below the evidence floor | Build the first picture | `obs_get_next_ot_baseline_question_fast` for the opening scan, then v6 dimension-debt rerank |
| `campaign` | A picture exists and some area is still insufficient | Locate, size, then move on | v6 campaign lane |
| `sweep` | Nothing insufficient is left worth drilling | Pay down long-game coverage debt | v6 dimension-debt rerank |

## Why cold_start keeps the fast selector

`obs_get_next_ot_baseline_question_fast` has no dimension-need term, no IRT
information term, no stage ladder, and no theta reference. That is a defect
when it routes most of an assessment -- measured difficulty currently *falls*
after success -- but it is genuinely good at the one job it was written for:
rotating sections to build the opening picture quickly. v6 caps it at the
first four scoring-eligible cold-start answers by default, then hands the
attempt to the richer ranker.

Before v6 it ran first on every attempt and only fell through when it returned
nothing, which meant it routed roughly the first 16 of 20 items on every
assessment. That is the single largest behavior change at activation.

## Campaign phases

A campaign is one thesis about one area, plus the boundary search that sizes
it. Two axes are searched, not one.

| Phase | Question it answers | Candidates it accepts | Exit |
|---|---|---|---|
| `confirm` | Was the entry miss real? | The exact cell | `campaign_confirm_answers` (default 2) answered |
| `widen_scope` | This chapter band, or the whole book? | Sibling unit, same book, same dimension | 2 further answers |
| `widen_sibling` | This book, or the section? | Other books in the section, same dimension | 2 further answers |
| `bracket_stage` | How deep does it go? | The confirmed cell, inside the stage window | A pass stage and a fail stage both confirmed |
| `closed` | -- | none | Bracketed, budget spent, or abandoned |

A campaign that finds no misses in `confirm` closes as `resolved_strong`. The
entry signal did not reproduce and there is nothing to size.

### Stage window

Foundational first. A campaign opens with `stage_floor = 1` and
`stage_ceiling = 1`. The ceiling rises only once a stage has actually been
*passed* inside the confirmed scope, so the router never opens a new area with
detail questions.

### Budgets

`evidence_budget` is sized from real bank depth at open time, not a constant. A
typical unit x dimension cell holds only 2-5 items in the current bank, so a
fixed budget would guarantee starvation and force the repeats principle 7
forbids.

### Anti-obsession caps

- `campaign_max_items_per_attempt` (default 12 of 20): one thesis can never eat
  a whole sitting; every assessment keeps some breadth.
- `campaign_max_attempts_spanned` (default 3): a campaign that cannot resolve
  in three sittings closes as `stale_abandoned`.
- `campaign_reopen_cooldown_days` (default 30): a closed cell is not
  re-litigated, unless a reread claim lands after it closed.

## Antievidence

A learner marking an area reread on the dashboard, or logging it in the reading
log, is evidence *against the router's thesis* -- not evidence of knowledge.

- Sources: `obs_reading_log_entries` (mapped to units by chapter overlap) and
  `obs_study_plan_events` rows of type `reading_completed` / `reading_started`.
- Effect: any cell whose newest answer predates the newest reread claim is
  `evidence_is_stale`. Stale cells report one sufficiency band lower, stop
  counting as confirmed weakness, and rank *first* for campaign targeting.
- A reread landing mid-campaign closes that campaign as
  `superseded_by_reread`, and targeting reopens on fresh terms.
- Rate limited to one claim per unit per hour, so repeated marks cannot hold a
  cell permanently stale and starve the rest of the ledger.
- It never moves a score. Ever. See `web/lib/readingLog.ts` for the same
  argument made to users.

## Target selection

`obs_next_campaign_target` ranks eligible cells:

1. `reread_retest` -- a reread claim obliges a retest, ahead of everything
2. `confirmed_weak` -- two or more answers, accuracy at or below threshold
3. `suspected_weak` -- weak on thin evidence
4. `unexplored`
5. then: foundational before dependent, canonical `sequence_order`, fewest
   answers (most uncertainty), deepest bank (most drillable)

Weakness and uncertainty are ranked separately on purpose. A cell with one miss
is *uncertain*; a cell with four misses is *confidently weak*. They are
different signals and want different treatment.
