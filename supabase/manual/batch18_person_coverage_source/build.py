#!/usr/bin/env python3
"""Build batch18 person-coverage questions -> validated JSON + SQL.

Replicates the two write-time DB guards locally so nothing is sent that
the database would reject:
  * qb_length_tell_verdict(payload)
  * obs_distractor_quality_verdict(payload, question_type)
"""
import json, sys, uuid, hashlib
from questions import MCQS, ORDERS

BATCH = "20260906_batch18_person_coverage"
RELATIONS = {
    "same_event", "same_generation", "same_book", "near_chronology",
    "same_role", "same_theme", "same_location", "same_law_category",
    "same_speech_context", "other_reviewed",
}
LETTERS = ["A", "B", "C", "D"]


def stable_uuid(slug):
    h = hashlib.sha1(("obs:batch18:" + slug).encode()).hexdigest()
    return str(uuid.UUID(h[:32]))


def length_tell_verdict(choices, correct_id):
    lens = [(c["id"] == correct_id, len(c["text"])) for c in choices]
    n_corr = sum(1 for is_c, _ in lens if is_c)
    n_dist = sum(1 for is_c, _ in lens if not is_c)
    if n_corr != 1 or n_dist < 2:
        return "not_applicable"
    all_avg = sum(l for _, l in lens) / len(lens)
    clen = max(l for is_c, l in lens if is_c)
    dl = [l for is_c, l in lens if not is_c]
    dmax, dmin, davg = max(dl), min(dl), sum(dl) / len(dl)
    if all_avg < 20:
        return "na_short_tokens"
    if clen > 1.4 * davg:  return "severe_long"
    if clen < 0.6 * davg:  return "severe_short"
    if clen > dmax and clen >= 1.10 * davg: return "mild_long"
    if clen < dmin and clen <= 0.90 * davg: return "mild_short"
    if clen > dmax or clen < dmin: return "marginal"
    return "ok"


def distractor_verdict(payload):
    choices = payload["choices"]
    correct = payload["correct_choice_id"]
    if payload.get("distractor_contract_version") != 1:
        return "invalid_contract_version"
    if str(payload.get("distractor_quality_reviewed")).lower() != "true":
        return "unreviewed"
    dists = [c for c in choices if c["id"] != correct]
    if len(choices) != 4 or len(dists) != 3:
        return "invalid_choice_set"
    metas = [c.get("meta", {}).get("distractor") for c in dists]
    if any(not isinstance(m, dict) for m in metas):
        return "missing_distractor_metadata"
    if sum(1 for m in metas if m.get("plausibility") in ("high", "medium")) != 3:
        return "implausible_distractor_present"
    if sum(1 for m in metas if m.get("plausibility") == "high") < 2:
        return "too_few_high_plausibility_distractors"
    if sum(1 for m in metas if str(m.get("misconception_code", "")).strip()) != 3:
        return "missing_misconception_code"
    if sum(1 for m in metas if m.get("relation") in RELATIONS) != 3:
        return "invalid_distractor_relation"
    return "pass"


def build_mcq(q, index):
    """Rotate the correct-answer position so it is not inherited from authoring order."""
    slot = index % 4
    texts = [None] * 4
    texts[slot] = (q["answer"], None)
    di = 0
    for i in range(4):
        if texts[i] is None:
            texts[i] = (q["distractors"][di][0], q["distractors"][di][1:])
            di += 1
    choices = []
    for letter, (text, meta) in zip(LETTERS, texts):
        c = {"id": letter, "text": text}
        if meta is not None:
            plaus, code, rel = meta
            c["meta"] = {"distractor": {
                "plausibility": plaus, "misconception_code": code, "relation": rel}}
        choices.append(c)
    correct_id = LETTERS[slot]
    qid = stable_uuid(q["slug"])
    payload = {
        "prompt": q["prompt"],
        "choices": choices,
        "correct_choice_id": correct_id,
        "correct_answer": q["answer"],
        "explanation": q["explanation"],
        "book_code": q["book"],
        "chapter": q["chapter"],
        "reference": q["reference"],
        "dimension_key": q["dim"],
        "dimension": q["dim"].split("_")[0],
        "question_id": qid,
        "question_layer": "bank_growth",
        "question_format": "standard",
        "source_batch": BATCH,
        "coverage_targets": q["covers"],
        # The OT router drops a candidate when another question with the same
        # stem_family was already answered in the attempt. Keying on the person
        # stops two items about the same figure stacking - which also closes a
        # cross-item leak where one item's answer appears as the other's option.
        "stem_family": "characters|%s" % q["covers"][0].lower().replace(" ", "_"),
        "difficulty_estimate": q["difficulty"],
        "irt_b": q["irt_b"],
        "importance_conceptual": q["imp_c"],
        "importance_context": q["imp_x"],
        "position_rebalanced": True,
        "distractor_contract_version": 1,
        "distractor_quality_reviewed": True,
    }
    return qid, "batch18_characters_probe_%s_mcq_v1" % q["slug"], payload


def build_order(q, index):
    choices = [{"id": i, "text": t} for i, t in q["items"]]
    qid = stable_uuid(q["slug"])
    payload = {
        "prompt": q["prompt"],
        "choices": choices,
        "correct_order": q["order"],
        "correct_choice_id": q["order"][0],
        "correct_answer": " -> ".join(
            dict((i, t) for i, t in q["items"])[i] for i in q["order"]),
        "explanation": q["explanation"],
        "book_code": q["book"],
        "chapter": q["chapter"],
        "reference": q["reference"],
        "dimension_key": "events_timeline",
        "dimension": "events",
        "question_id": qid,
        "question_layer": "bank_growth",
        "question_format": "sequence_order",
        "source_batch": BATCH,
        "coverage_targets": q["covers"],
        "stem_family": "sequence|%s|%s" % (q["book"], q["slug"]),
        "difficulty_estimate": q["difficulty"],
        "irt_b": q["irt_b"],
        "importance_conceptual": q["imp_c"],
        "importance_context": q["imp_x"],
        "baseline_eligible": False,
        # The length-tell guard compares the "correct choice" against its
        # "distractors". An ordering item has neither: all four items are
        # shown and must be arranged, so relative length carries no signal
        # a test-wise examinee could exploit. Recorded exception per the
        # choice_length_balance rubric.
        "length_tell_reviewed": True,
        "length_tell_exception_reason": "order_response_has_no_single_correct_option",
    }
    return qid, "sequence_order_v1", payload


def main():
    rows, problems = [], []
    for i, q in enumerate(MCQS):
        qid, qtype, payload = build_mcq(q, i)
        lv = length_tell_verdict(payload["choices"], payload["correct_choice_id"])
        dv = distractor_verdict(payload)
        if lv in ("severe_long", "severe_short", "mild_long", "mild_short"):
            problems.append("%s length_tell=%s" % (q["slug"], lv))
        if dv != "pass":
            problems.append("%s distractor=%s" % (q["slug"], dv))
        if len(set(c["text"] for c in payload["choices"])) != 4:
            problems.append("%s duplicate choice text" % q["slug"])
        rows.append({"id": qid, "question_type": qtype, "payload": payload,
                     "dedupe_key": "batch18|%s|%s" % (q["book"], q["slug"]),
                     "_lv": lv})
    for i, q in enumerate(ORDERS):
        qid, qtype, payload = build_order(q, i)
        if len(payload["choices"]) != 4:
            problems.append("%s order needs exactly 4 items" % q["slug"])
        if sorted(payload["correct_order"]) != sorted(c["id"] for c in payload["choices"]):
            problems.append("%s correct_order/choices mismatch" % q["slug"])
        rows.append({"id": qid, "question_type": qtype, "payload": payload,
                     "dedupe_key": "batch18|%s|%s" % (q["book"], q["slug"]),
                     "_lv": "order"})

    if problems:
        print("VALIDATION FAILURES (%d):" % len(problems))
        for p in problems: print("  " + p)
        sys.exit(1)

    from collections import Counter
    print("built %d rows (%d mcq, %d order)" % (len(rows), len(MCQS), len(ORDERS)))
    print("length_tell:", dict(Counter(r["_lv"] for r in rows)))
    covered = set()
    for r in rows: covered.update(r["payload"]["coverage_targets"])
    print("distinct people targeted: %d" % len(covered))
    print(", ".join(sorted(covered)))
    for r in rows: r.pop("_lv")
    with open("rows.json", "w") as f:
        json.dump(rows, f, indent=1)
    print("\nwrote rows.json")


if __name__ == "__main__":
    main()
