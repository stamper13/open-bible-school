import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function requireArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

function parseIntOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseCsvLine(line) {
  // Minimal CSV parser (handles quoted cells)
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function loadCsvRows(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j] ?? '';
    rows.push(obj);
  }
  return rows;
}

async function upsertEvents(rows) {
  if (!rows.length) return 0;

  const payload = rows.map(r => ({
    book_code: (r.book_code || '').trim(),
    start_chapter: parseIntOrNull(r.start_chapter),
    start_verse: parseIntOrNull(r.start_verse),
    end_chapter: parseIntOrNull(r.end_chapter),
    end_verse: parseIntOrNull(r.end_verse),
    event_title: (r.event_title || '').trim(),
    event_type: (r.event_type || '').trim() || null,
  })).filter(r =>
    r.book_code &&
    r.start_chapter && r.start_verse &&
    r.end_chapter && r.end_verse &&
    r.event_title
  );

  if (!payload.length) return 0;

  // Conflict key must match your table's unique constraint.
  // Assumption: unique(book_code, start_chapter, start_verse, end_chapter, end_verse, event_title)
  const { error } = await supabase
    .from('bible_events')
    .upsert(payload, {
      onConflict: 'book_code,start_chapter,start_verse,end_chapter,end_verse,event_title'
    });

  if (error) throw error;
  return payload.length;
}

async function main() {
  const seedFile = requireArg('--file');
  if (!seedFile) {
    console.log('Usage: node ingest-events-by-book-v1.js --file input/events/Exo_events_seed_v1.csv');
    process.exit(1);
  }

  const abs = path.isAbsolute(seedFile) ? seedFile : path.join(process.cwd(), seedFile);

  console.log('Events ingest by book v1 starting…');
  console.log('Reading:', abs);

  const rows = loadCsvRows(abs);
  const count = await upsertEvents(rows);

  console.log(`DONE. Upserted events: ${count}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
