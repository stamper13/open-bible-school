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

const CSV_PATH = path.join(process.cwd(), 'input', 'events', 'Gen_events_seed_v1.csv');

function parseCsvNoCommasInFields(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(s => s.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length !== header.length) {
      throw new Error(`CSV format error on line ${i + 1}: expected ${header.length} cols, got ${parts.length}`);
    }
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = parts[c];
    rows.push(obj);
  }
  return rows;
}

function toInt(x, field) {
  const n = parseInt(x, 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid int for ${field}: ${x}`);
  return n;
}

async function main() {
  console.log('Genesis events ingest v1 starting…');
  console.log('Reading:', CSV_PATH);

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = parseCsvNoCommasInFields(raw);

  const rows = parsed.map(r => ({
    book_code: r.book_code,
    start_chapter: toInt(r.start_chapter, 'start_chapter'),
    start_verse: toInt(r.start_verse, 'start_verse'),
    end_chapter: toInt(r.end_chapter, 'end_chapter'),
    end_verse: toInt(r.end_verse, 'end_verse'),
    event_title: r.event_title,
    event_type: r.event_type || null,
  }));

  // Basic sanity checks
  for (const r of rows) {
    if (!r.book_code || !r.event_title) throw new Error('Missing book_code or event_title');
    if (r.start_chapter < 1 || r.start_verse < 1 || r.end_chapter < 1 || r.end_verse < 1) {
      throw new Error(`Bad ref (must be >= 1): ${JSON.stringify(r)}`);
    }
  }

  const { error } = await supabase
    .from('bible_events')
    .upsert(rows, {
      onConflict: 'book_code,start_chapter,start_verse,end_chapter,end_verse,event_title',
    });

  if (error) throw error;

  console.log(`DONE. Upserted events: ${rows.length}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
