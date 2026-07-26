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

const OUT_DIR = path.join(process.cwd(), 'output', 'ot_events_by_book');

// OT in standard Protestant order (39)
const OT_BOOKS = [
  'Gen','Exo','Lev','Num','Deu',
  'Jos','Jdg','Rut',
  '1Sa','2Sa','1Ki','2Ki','1Ch','2Ch',
  'Ezr','Neh','Est',
  'Job','Psa','Pro','Ecc','Sng',
  'Isa','Jer','Lam','Ezk','Dan',
  'Hos','Joe','Amo','Oba','Jon','Mic','Nam','Hab','Zep','Hag','Zec','Mal'
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function csvEscape(v) {
  const s = (v ?? '').toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, rows) {
  const header = ['book_code','start_chapter','start_verse','end_chapter','end_verse','event_title','event_type'];
  const lines = [header.join(',')];

  for (const r of rows) {
    const line = [
      r.book_code,
      r.start_chapter,
      r.start_verse,
      r.end_chapter,
      r.end_verse,
      csvEscape(r.event_title),
      csvEscape(r.event_type ?? '')
    ].join(',');
    lines.push(line);
  }

  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

async function fetchEventsForBook(book_code) {
  const { data, error } = await supabase
    .from('bible_events')
    .select('book_code,start_chapter,start_verse,end_chapter,end_verse,event_title,event_type')
    .eq('book_code', book_code)
    .order('start_chapter', { ascending: true })
    .order('start_verse', { ascending: true })
    .order('end_chapter', { ascending: true })
    .order('end_verse', { ascending: true })
    .order('event_title', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function main() {
  console.log('Export OT events by book v2…');
  ensureDir(OUT_DIR);

  const master = [];

  for (const book of OT_BOOKS) {
    const rows = await fetchEventsForBook(book);
    for (const r of rows) master.push(r);

    const outPath = path.join(OUT_DIR, `${book}_events_v2.csv`);
    writeCsv(outPath, rows);
    console.log(`Wrote ${outPath} (${rows.length} events)`);
  }

  const masterPath = path.join(OUT_DIR, 'ot_events_master_v2.csv');
  writeCsv(masterPath, master);
  console.log(`Wrote ${masterPath} (master: ${master.length} events)`);
  console.log('DONE.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
