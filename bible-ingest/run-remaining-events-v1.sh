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

# ---- Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi (the part you were in) ----
write_seed input/events/Mic_events_seed_v1.csv <<'EOF'
mic_01,Prophets,Mic,1,1,3,12,Judgment on Samaria and Judah,Sin is exposed and judgment announced.
mic_02,Prophets,Mic,4,1,5,15,Future Hope and Zion’s Restoration,Peace and restoration are promised.
mic_03,Prophets,Mic,6,1,7,20,Covenant Lawsuit and Hope,God calls for justice, mercy, and humility; hope remains.
EOF

write_seed input/events/Nam_events_seed_v1.csv <<'EOF'
nam_01,Prophets,Nam,1,1,3,19,Nineveh’s Fall Announced,God’s justice against Assyria brings comfort to his people.
EOF

write_seed input/events/Hab_events_seed_v1.csv <<'EOF'
hab_01,Prophets,Hab,1,1,2,20,Dialogue on Justice,Habakkuk questions; God answers regarding judgment and faith.
hab_02,Prophets,Hab,3,1,3,19,Prayer and Trust,The prophet prays and resolves to trust God in adversity.
EOF

write_seed input/events/Zep_events_seed_v1.csv <<'EOF'
zep_01,Prophets,Zep,1,1,2,15,Day of the Lord Warning,Judgment is proclaimed; repentance is urged.
zep_02,Prophets,Zep,2,1,3,20,Judgment and Restoration,God judges nations and promises purification and joy for a remnant.
EOF

write_seed input/events/Hag_events_seed_v1.csv <<'EOF'
hag_01,Prophets,Hag,1,1,1,15,Rebuild the Temple Called,God confronts misplaced priorities and calls for rebuilding.
hag_02,Prophets,Hag,2,1,2,23,Encouragement and Future Glory,God promises presence, future glory, and covenant faithfulness.
EOF

write_seed input/events/Zec_events_seed_v1.csv <<'EOF'
zec_01,Prophets,Zec,1,1,1,21,Return to the Lord; Early Visions,Calls to repentance and visions assure restoration.
zec_02,Prophets,Zec,2,1,6,15,Restoration and Priest-King Hope,God renews leadership and signals messianic hope.
zec_03,Prophets,Zec,7,1,8,23,True Fasting and Justice,God demands heartfelt obedience and justice, not ritualism.
zec_04,Prophets,Zec,9,1,14,21,Coming King and Final Deliverance,Messianic themes and future deliverance are proclaimed.
EOF

write_seed input/events/Mal_events_seed_v1.csv <<'EOF'
mal_01,Prophets,Mal,1,1,2,17,Corrupt Worship Rebuked,God confronts dishonor in worship and priestly failures.
mal_02,Prophets,Mal,3,1,3,18,The Lord Comes; Covenant Purified,God promises refining judgment and calls for faithfulness.
mal_03,Prophets,Mal,4,1,4,6,Day of the Lord and Elijah Promise,Final warning and promise prepare for future fulfillment.
EOF

# ---- ingest just these newly written files ----
for f in \
  input/events/Mic_events_seed_v1.csv \
  input/events/Nam_events_seed_v1.csv \
  input/events/Hab_events_seed_v1.csv \
  input/events/Zep_events_seed_v1.csv \
  input/events/Hag_events_seed_v1.csv \
  input/events/Zec_events_seed_v1.csv \
  input/events/Mal_events_seed_v1.csv
do
  echo "INGEST: $f"
  node ingest-events-by-book-v1.js --file "$f"
done

node export-ot-events-by-book-v2.js
