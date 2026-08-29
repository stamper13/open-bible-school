# Router philosophy

The canonical statement of what the assessment router is for. Before v6 this
lived only in migration header comments, which meant reading twenty files in
date order to reconstruct it. Migration comments still explain *why a specific
change was made*; this file explains *what the router is trying to do*.

## The one-sentence version

The router's job is to buy evidence efficiently. The score's job is to report
that evidence honestly, with its uncertainty visible.

## What the router is

A set of `SECURITY DEFINER` Postgres functions, called as Supabase RPCs. The
frontend never chooses a question; it asks "what is next for this attempt" and
renders the answer. Every change ships as a numbered migration with a paired
`supabase/verify/` script, a preflight that aborts when prerequisites are
missing, and a definition backup into `obs_schema_backups`.

## Two eras

**Breadth era (v3-v5).** Build a first picture. Balance sections, balance
dimensions, cap concentration, screen before drilling. Correct for a learner
the router knows nothing about, but incomplete if a fast selector shadows the
ranker for most of the sitting.

**Evidence-campaign era (v6).** Once a picture exists, balance stops being the
goal. The router locates the most foundational area where its knowledge is
insufficient, sizes that area, then moves to the next one. Coverage becomes a
long-game ledger rather than a per-assessment constraint.

V6 also repairs the cold-start split: the fast selector is capped to the
opening section scan, and the remaining cold-start items are routed through a
wider v5 pool where dimension debt can outrank the old route-bucket precedence
for ordinary ranked candidates.

Both eras are live. Which one applies is decided per learner, per attempt, by
`obs_router_mode`. See [MODES.md](MODES.md).

## Principles

1. **Foundational first.** Weakness in Torah matters more than weakness in the
   Minor Prophets, because later material depends on it. Ordering comes from
   `obs_learning_units.is_foundation` then `sequence_order`. Dependency priors
   are directional and routing-only: they may start an upstream book at a
   verification item, and a miss immediately returns it to foundation. No
   dependency inference ever awards score or propagates failure backward.

2. **Screen, then deepen.** Book orientation is a gate, not disposable easy
   evidence. In breadth mode a pass earns a depth follow-up and a miss moves
   on. In campaign mode a miss is the entry point for a campaign instead.

3. **Diagnose, confirm, move on.** Two misses in one dimension lower that
   dimension only, ask one confirmation item, then deprioritise it. Strong
   performance elsewhere must never force hard items where the learner is
   already struggling.

4. **Recovery is not a ratchet.** Sustained success raises the target back up.
   Downshifts are directional: a missed item may route to the requested stage
   or easier, never to a harder adjacent stage.

5. **Size the weakness, do not just find it.** Finding a miss is cheap.
   Knowing whether it is one chapter band, one book, or one dimension across a
   whole section is what makes a recommendation actionable. This is a
   two-axis boundary search -- scope and stage -- not a ranking weight.

6. **One thesis at a time.** At most one open campaign per learner, enforced by
   a partial unique index. Without that constraint the router thrashes between
   theses and can only ever produce breadth.

7. **Never repeat while unseen items remain.** With ~1,171 OT items and a
   typical learner having seen ~160, an exact repeat inside the cooldown is a
   defect, not a supply problem. Sizing an area needs *distinct* evidence.

8. **Concentration caps are absolute.** Five items per book per general
   assessment, with a softer three-item penalty. A pending confirmation may
   bypass the soft penalty; nothing bypasses the hard cap.

9. **Reading is not knowing.** Logging or marking a passage as reread never
   moves a score. It is antievidence: it invalidates the router's standing
   thesis and obliges a retest. See [MODES.md](MODES.md#antievidence).

10. **Evidence thresholds are visible.** Under 15 answers a section score is
    Provisional; 15-29 Developing; 30+ Established. Score fidelity and item
    validity are separate release gates and neither substitutes for the other.
    See [../validation/BLI_SCORE_FIDELITY_GATES.md](../validation/BLI_SCORE_FIDELITY_GATES.md).

## Known tension

Campaign mode deliberately unbalances section coverage within an assessment.
The fidelity harness measures section-band recovery, which that will depress if
measured per attempt. The gate must be evaluated on *cumulative* learner
evidence, not per-attempt evidence, or v6 will fail its own release criteria
for doing exactly what it was designed to do. This is not hypothetical -- treat
it as a blocking item before activation.

## Honest limits

The validation profiles are deterministic synthetic learners, not psychometric
validation. Before claiming calibrated adaptivity the project still needs
production response-volume monitoring, item calibration review, and periodic
replay against a staging clone.
