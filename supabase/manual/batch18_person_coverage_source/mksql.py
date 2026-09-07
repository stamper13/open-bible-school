import json
rows = json.load(open("rows.json"))
def q(s): return "'" + s.replace("'", "''") + "'"
parts = []
for r in rows:
    parts.append("  (%s::uuid, %s, %s, %s::jsonb)" % (
        q(r["id"]), q(r["question_type"]), q(r["dedupe_key"]),
        q(json.dumps(r["payload"], ensure_ascii=False))))
body = """-- Batch 18: person-coverage questions.
-- Fills gaps in the question bank's coverage of non-genealogical biblical
-- persons. Every fact was checked against the Berean Standard Bible before
-- the item was written; payload->>'reference' names the verse checked.
-- 55 four-choice MCQs + 5 sequence-order items, covering 65 people who had
-- no question of any kind in the live bank.

insert into public.ot_generated_questions
  (id, question_type, dedupe_key, payload)
values
%s
on conflict (id) do update set
  question_type = excluded.question_type,
  dedupe_key    = excluded.dedupe_key,
  payload       = excluded.payload;

select public.obs_refresh_router_question_facts();
select public.obs_refresh_router_candidate_facts();
""" % (",\n".join(parts))
open("batch18.sql","w").write(body)
# chunked variants for the MCP sql tool
CH = 10
for i in range(0, len(parts), CH):
    chunk = parts[i:i+CH]
    open("chunk_%02d.sql" % (i//CH), "w").write(
        "insert into public.ot_generated_questions (id, question_type, dedupe_key, payload)\nvalues\n"
        + ",\n".join(chunk)
        + "\non conflict (id) do update set question_type=excluded.question_type,"
          " dedupe_key=excluded.dedupe_key, payload=excluded.payload;")
print("wrote batch18.sql and %d chunks" % ((len(parts)+CH-1)//CH))
