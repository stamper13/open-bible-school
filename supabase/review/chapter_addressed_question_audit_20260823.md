# Chapter-Addressed Question Audit - 2026-08-23

Live Supabase audit of routable multiple-choice questions in
`obs_question_bank_with_units`.

## Summary

- Total routable MCQ questions: 1,491
- Broader `what/who/where/which ... in [Book] [chapter]` prompts: 123
- Direct `what happens ... [Book] [chapter]` prompts: 9
- Stage distribution inside the 123-question bucket:
  - Stage 1: 6
  - Stage 2: 52
  - Stage 3: 65

## Priority Buckets

- `A_rewrite_first_what_happens`: 9
  - Stage 1: 2
  - Stage 2: 4
  - Stage 3: 3
- `B_reword_or_downgrade_chapter_addressed`: 105
  - Stage 1: 3
  - Stage 2: 44
  - Stage 3: 58
- `C_keep_or_minor_reword_meaning`: 2
  - Stage 3: 2
- `C_keep_sequence`: 7
  - Stage 1: 1
  - Stage 2: 4
  - Stage 3: 2

## Actual Usage

- `A_rewrite_first_what_happens`: 9 bank rows, 4 total served answers
- `B_reword_or_downgrade_chapter_addressed`: 105 bank rows, 76 total served
  answers across 35 distinct questions
- `C_keep_or_minor_reword_meaning`: 2 bank rows, 2 total served answers
- `C_keep_sequence`: 7 bank rows, 9 total served answers

## Hot Units

- Genesis 12-50 is the clearest hotspot. It has 17 broader chapter-addressed
  prompts, including repeatedly served items in the active campaign area.
- Other clusters:
  - Exodus 1-20: 13
  - Exodus 21-40: 11
  - Deuteronomy 5-30: 9
  - Nehemiah: 7

## Highest-Priority Examples

- `57b17063` - Stage 1 - Ezra 1-10 - `What happens when the second temple is completed in Ezra 6?`
- `280e3de0` - Stage 1 - Nehemiah 1-13 - `What happens when Ezra reads the law to the gathered people in Nehemiah 8?`
- `97ea8bdc` - Stage 1 - Exodus 1-20 - `What is given in Exodus 20 at Sinai?`
- `678c77e6` - Stage 1 - Exodus 1-20 - `What provision does God give Israel in Exodus 16?`
- `0db6da10` - Stage 1 - Jeremiah 1-31 - `What makes the new covenant in Jeremiah 31 different from the Mosaic covenant?`
- `d6fde2eb` - Stage 2 - Genesis 12-50 - `What major event happens in Genesis 23?`
- `c5300a5a` - Stage 2 - Genesis 12-50 - `Whom does God command Abraham to offer in Genesis 22?`
- `8b7d8f32` - Stage 2 - Genesis 12-50 - `Who blesses the twelve sons in Genesis 49?`
- `cb1b8278` - Stage 3 - Genesis 12-50 - `What happens to Sarah in Genesis 20?`

## Recommendation

Do not delete these as a group. Many are testing real biblical content, but
the prompt framing leans too heavily on chapter-number recall.

First patch should:

1. Keep the underlying content where it is valuable.
2. Mark A/B bucket items with a `quality_flag` such as
   `chapter_addressed_rewrite_needed`.
3. Prevent flagged A/B items from being used as foundation or early campaign
   evidence unless no better item exists.
4. Rewrite the Genesis 12-50 hotspot first into event/sequence/significance
   language.

Example rewrites:

- `What major event happens in Genesis 23?`
  - Better: `After Sarah dies, what does Abraham secure in Canaan?`
- `Who blesses the twelve sons in Genesis 49?`
  - Better: `Near the end of Genesis, who gives prophetic blessings over the twelve sons?`
- `Whom does God command Abraham to offer in Genesis 22?`
  - Better: `In the testing of Abraham, whom does God command him to offer?`
