#!/usr/bin/env bash
set -euo pipefail
cd ~/bible-ingest

write_seed () {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path" <<'EOF'
event_key,curriculum_unit,book_code,start_chapter,start_verse,end_chapter,end_verse,event_title,event_summary
EOF
  cat >> "$path"
}

write_seed input/events/Rut_events_seed_v1.csv <<'EOF'
rut_01,Writings,Rut,1,1,1,22,Ruth’s Loss and Loyalty,Naomi returns to Bethlehem; Ruth clings to her and to Israel’s God.
rut_02,Writings,Rut,2,1,2,23,Ruth Gleans in Boaz’s Field,God provides through Boaz; Ruth finds favor and protection.
rut_03,Writings,Rut,3,1,3,18,Ruth Appeals to Boaz,Ruth seeks redemption; Boaz promises to act rightly.
rut_04,Writings,Rut,4,1,4,22,Redemption and Line of David,Boaz redeems Ruth; the family line leads to David.
EOF

write_seed input/events/Est_events_seed_v1.csv <<'EOF'
est_01,Writings,Est,1,1,1,22,Vashti Deposed,A royal conflict leads to a search for a new queen.
est_02,Writings,Est,2,1,2,23,Esther Becomes Queen,Esther is elevated; Mordecai uncovers a plot.
est_03,Writings,Est,3,1,3,15,Haman’s Decree,Haman plots genocide; a decree threatens the Jews.
est_04,Writings,Est,4,1,4,17,Esther Resolves to Intercede,Esther risks her life to approach the king.
est_05,Writings,Est,5,1,5,14,First Banquet and Rising Tension,Esther invites the king and Haman; Haman’s pride grows.
est_06,Writings,Est,6,1,6,14,Mordecai Honored,Providence reverses expectations; Haman must honor Mordecai.
est_07,Writings,Est,7,1,7,10,Haman Exposed and Executed,Esther reveals the plot; Haman is judged.
est_08,Writings,Est,8,1,8,17,New Decree of Deliverance,A counter-decree permits Jewish defense and relief.
est_09,Writings,Est,9,1,9,32,Deliverance and Purim,The Jews prevail; Purim is established.
est_10,Writings,Est,10,1,10,3,Mordecai Exalted,Mordecai’s rise closes the narrative of deliverance.
EOF

node ingest-events-by-book-v1.js --file input/events/Rut_events_seed_v1.csv
node ingest-events-by-book-v1.js --file input/events/Est_events_seed_v1.csv
node export-ot-events-by-book-v2.js
