# V7 Router And Scoring Philosophy

Status: draft for branch testing. This document clarifies the V7 direction
before migrations, auto-labeling, router changes, or score changes are made.
V7 should be tested in shadow mode before any user-facing BLI behavior changes.

## One Sentence

V7 should route broad-to-narrow and score hierarchically: broad evidence speaks
strongly about global BLI, while narrow evidence mostly refines local depth
unless repeated across scopes or earned by already-strong parent evidence.

## BLI Meaning

BLI is scored from 0 to 800. The closer a learner gets to 800, the more fine
textual detail they should be able to handle across the biblical corpus.

This means:

- Low BLI mostly represents broad and foundational recognition.
- Mid BLI represents reliable section and book-level understanding.
- High BLI represents broad literacy plus meaningful textual depth.
- Near-800 BLI requires success on increasingly narrow details across many
  books, units, dimensions, and passages.

High BLI is not merely "survey knowledge with high confidence." It requires
depth. But narrow details should not dominate global score before parent scopes
are established.

## Foundation

Foundational does not mean easy. A question is foundational when the knowledge
it measures supports larger understanding.

Foundation is shaped by four factors:

1. **Scope.** OT-wide, section, book, unit, chapter range, passage, or verse.
2. **Dimension.** Events/timeline, characters/lineage, geography/nations,
   law/commands, promise/prophecy, theological reasoning, or structure/cross
   reference.
3. **Event or concept importance.** Whether the event, command, promise,
   relationship, place, or theological claim carries later storyline weight.
4. **Dependency.** Whether later biblical material depends on knowing it.

Examples:

| Question Kind | Scope | Global Meaning |
|---|---|---|
| Which came first, Babel or Daniel in the lions' den? | OT-wide | High |
| Which prophetic book urges returned exiles to rebuild the temple? | Book/section | Medium-high |
| What is the main covenant movement in Genesis 12-50? | Unit | Medium |
| What does Genesis 15 contribute to the Abraham promise? | Passage | Medium if parent evidence is strong; local otherwise |
| What happens in Ezra 5? | Chapter detail | Low global meaning unless tied to a broader event/dimension |

## Ladder Levels

V7 metadata should classify every question by both routing granularity and
scoring scope.

Routing granularity:

| Level | Meaning |
|---|---|
| `ot_overview` | Canon-wide ordering, section boundaries, large storyline arcs |
| `section_overview` | Broad Torah / Former Prophets / Latter Prophets / Writings knowledge |
| `book_overview` | Book identity, placement, setting, main movement, dominant themes |
| `book_intersection` | Book x dimension evidence, such as Hosea geography or Exodus law |
| `unit_overview` | Major learning-unit evidence, such as Genesis 1-11 vs 12-50 |
| `chapter_range` | Smaller chapter-band evidence inside a unit |
| `chapter_detail` | Specific chapter knowledge |
| `verse_detail` | Specific verse or very narrow passage detail |

Scoring scope:

| Scope | Meaning |
|---|---|
| `ot` | Evidence directly relevant to whole-OT literacy |
| `section` | Evidence mainly about a canonical section |
| `book` | Evidence mainly about a biblical book |
| `unit` | Evidence mainly about a learning unit or chapter band |
| `chapter` | Evidence mainly about one chapter |
| `passage` | Evidence mainly about a short passage or verse-level detail |

The two are related but not identical. A question can be narrow in wording yet
globally meaningful if the event or dimension is foundational to later
Scripture.

## Routing Rules

### Broad To Narrow

The router should earn permission to go narrow.

It should not jump from one broad miss to a passage detail. It should test a
thesis at the next broader useful level:

1. section signal;
2. book-level confirmation across several books;
3. book x dimension evidence;
4. unit or chapter-range boundary;
5. chapter or passage detail.

### Weak Areas

Weakness gets priority, but one weak section, book, dimension, or question
shape must not trap the learner.

Caps should work as friction rather than as simple stop signs. A weak area may
receive more questions only when each additional item buys new evidence:

- a new book;
- a new dimension;
- a broader confirmation;
- a legitimate boundary test;
- or a depth probe whose parent scope already has enough evidence.

The 2026-08-24 assessment with 11 of 20 items in Latter Prophets is an example
of a valid weak signal becoming too concentrated for the learner experience.

### Strong Areas

Strong areas should receive occasional stress tests. This is the reverse of
weak-area widening:

- If Torah looks strong, ask a narrower Torah question.
- If the learner misses it, widen back up before lowering global confidence.
- A missed Genesis 15 detail should first ask: Is Genesis 12-50 weak? Is
  Genesis weak? Is Torah actually less strong? Or was this a local detail gap?

Strong areas should not dominate once confirmed, but they should not disappear.
They are where higher BLI ceilings are earned.

### Uncertainty Before Weakness

Weak areas matter, but uncertainty is usually more valuable than repeatedly
confirming the same weakness.

A cell with one miss is uncertain. A cell with several misses is confidently
weak. Those require different actions:

- uncertain: broaden or confirm;
- confidently weak: size the boundary, recommend, then move on;
- confidently strong: stress test occasionally, then reduce frequency.

## Scoring Rules

V7 scoring should initially run only as a shadow score beside current BLI.

### Broad Evidence

Broad correct answers should be strong global evidence. Broad misses should be
strong global anti-evidence.

### Narrow Evidence

Narrow correct answers should raise global BLI modestly at low and mid levels,
and more meaningfully at high levels where depth is the primary way to climb.

Narrow wrong answers should mostly lower local confidence unless repeated
across books, dimensions, or units. Repeated narrow failures across a scope may
roll upward as evidence that the parent scope is weaker than estimated.

### Depth And Ceiling

Fine details are not irrelevant. They are ceiling evidence.

The scoring model should allow:

- broad competence to move a learner into the middle bands;
- book and unit competence to stabilize higher bands;
- repeated narrow competence across scopes to move toward 800;
- isolated narrow misses to remain local.

### No Dependency Scoring

Dependency priors may route questions, but they must not award score or
propagate failure backward. Reading and rereading also remain antievidence for
routing, never score evidence.

## Metadata Requirement

V7 needs a first-class metadata layer because live question metadata is not
complete enough for reliable broad-to-narrow routing.

As of the 2026-08-24 inspection:

- all live questions in `obs_question_bank_with_dimensions` had a dimension;
- only a minority had explicit `payload.knowledge_granularity`;
- many questions had chapter clues or chapter-addressed prompts;
- the current score uses book weight and importance tier, but not explicit
  scoring-scope level.

The next schema should not rewrite the question bank. It should add a sidecar
table that can be populated by inference, reviewed, and joined by V7 functions.

## Non-Goals

V7 metadata must not:

- delete usable questions;
- change live router behavior by itself;
- change displayed BLI by itself;
- make narrow details meaningless;
- make broad survey recognition sufficient for high BLI;
- hide uncertainty.

## Launch Sequence

1. Add sidecar metadata schema.
2. Auto-label every question with confidence and review status.
3. Produce a low-confidence and suspicious-weight audit.
4. Human-review the riskiest labels.
5. Build V7 routing in shadow mode.
6. Run V6 vs V7 simulations.
7. Build hierarchical BLI as a shadow score.
8. Compare current BLI vs shadow BLI before any user-facing change.
