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

// OT book codes (standard 39)
const OT_BOOKS = [
  'Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut',
  '1Sa','2Sa','1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est',
  'Job','Psa','Pro','Ecc','Sng',
  'Isa','Jer','Lam','Ezk','Dan',
  'Hos','Joe','Amo','Oba','Jon','Mic','Nam','Hab','Zep','Hag','Zec','Mal',
];

// Where to write output
const OUT_DIR = path.join(process.cwd(), 'output', 'ot_events_by_book');

// Candidate section/pericope table names (script will auto-pick the first valid)
const CANDIDATE_SECTION_TABLES = [
  'scripture_sections',
  'bible_sections',
  'sections',
  'section_ranges',
  'scripture_pericopes',
  'pericopes',
  'ot_sections',
  'section_titles',
];

// Helpers
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function refStr(book, c, v, suffix) {
  if (!book || !c || !v) return '';
  return `${book}.${c}.${v}${suffix ?? ''}`;
}

async function safeSelectOne(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return { ok: false, error };
  const row = (data && data[0]) ? data[0] : null;
  return { ok: true, row };
}

function hasAnyKey(row, keys) {
  if (!row) return false;
  const kset = new Set(Object.keys(row));
  return keys.some(k => kset.has(k));
}

function pickKey(row, keys) {
  if (!row) return null;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) return k;
  }
  return null;
}

async function detectSectionTable() {
  for (const t of CANDIDATE_SECTION_TABLES) {
    const probe = await safeSelectOne(t);
    if (!probe.ok) continue;

    const row = probe.row;

    // Must have a book code column and start/end coordinates
    const bookKey = pickKey(row, ['book_code','book','bookId','bookid']);
    const startChapKey = pickKey(row, ['start_chapter','chapter_start','startChapter','start_ch']);
    const startVerseKey = pickKey(row, ['start_verse','verse_start','startVerse','start_vs']);
    const endChapKey = pickKey(row, ['end_chapter','chapter_end','endChapter','end_ch']);
    const endVerseKey = pickKey(row, ['end_verse','verse_end','endVerse','end_vs']);

    if (!bookKey || !startChapKey || !startVerseKey || !endChapKey || !endVerseKey) continue;

    // Title is optional but strongly preferred
    const titleKey = pickKey(row, ['title','section_title','name','heading']);
    const idKey = pickKey(row, ['id','section_id','uuid']);

    return {
      table: t,
      keys: { bookKey, startChapKey, startVerseKey, endChapKey, endVerseKey, titleKey, idKey },
      sampleRowKeys: Object.keys(row),
    };
  }

  throw new Error(
    `Could not auto-detect a sections/pericopes table. Tried: ${CANDIDATE_SECTION_TABLES.join(', ')}`
  );
}

async function fetchAllRows({ table, select, filters = [], order = [] }) {
  // Supabase returns max 1000-ish; we page using range()
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);

    for (const f of filters) {
      // f: { op:'eq'|'in'|'gte'|'lte'|'not', col, val }
      if (f.op === 'eq') q = q.eq(f.col, f.val);
      else if (f.op === 'in') q = q.in(f.col, f.val);
      else if (f.op === 'gte') q = q.gte(f.col, f.val);
      else if (f.op === 'lte') q = q.lte(f.col, f.val);
      else if (f.op === 'not') q = q.not(f.col, f.val.op, f.val.value);
      else throw new Error(`Unsupported filter op: ${f.op}`);
    }

    for (const o of order) {
      // o: { col, asc:true/false }
      q = q.order(o.col, { ascending: o.asc });
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) break;
    all = all.concat(data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function isOTBookCode(b) {
  return OT_BOOKS.includes(b);
}

async function main() {
  console.log('Export OT events by book v1…');
  ensureDir(OUT_DIR);

  const detected = await detectSectionTable();
  const { table, keys } = detected;

  console.log('Detected sections table:', table);
  console.log('Detected key map:', keys);

  // Build select list: keep it small but useful
  const selectCols = new Set();
  if (keys.idKey) selectCols.add(keys.idKey);
  selectCols.add(keys.bookKey);
  selectCols.add(keys.startChapKey);
  selectCols.add(keys.startVerseKey);
  selectCols.add(keys.endChapKey);
  selectCols.add(keys.endVerseKey);
  if (keys.titleKey) selectCols.add(keys.titleKey);

  // Also include any common “scope/testament” column if present so we can filter
  // (we detect by presence on sample row keys)
  const sampleKeys = new Set(detected.sampleRowKeys);
  const scopeKey = ['scope','testament','canon','collection'].find(k => sampleKeys.has(k)) || null;
  if (scopeKey) selectCols.add(scopeKey);

  const select = Array.from(selectCols).join(',');

  // Fetch ALL candidate rows for OT books.
  // Filtering by book_code IN OT list is reliable and avoids relying on “testament” fields.
  const rows = await fetchAllRows({
    table,
    select,
    filters: [{ op: 'in', col: keys.bookKey, val: OT_BOOKS }],
    order: [
      { col: keys.bookKey, asc: true },
      { col: keys.startChapKey, asc: true },
      { col: keys.startVerseKey, asc: true },
      { col: keys.endChapKey, asc: true },
      { col: keys.endVerseKey, asc: true },
    ],
  });

  console.log(`Fetched rows (OT books): ${rows.length}`);

  // Group by book
  const byBook = new Map();
  for (const r of rows) {
    const book = r[keys.bookKey];
    if (!isOTBookCode(book)) continue;

    if (!byBook.has(book)) byBook.set(book, []);
    byBook.get(book).push(r);
  }

  // Write master CSV
  const masterPath = path.join(OUT_DIR, 'ot_events_master_v1.csv');
  const header = [
    'book_code',
    'event_id',
    'event_title',
    'start_chapter',
    'start_verse',
    'end_chapter',
    'end_verse',
    'start_ref',
    'end_ref',
  ];

  const masterLines = [header.join(',')];

  for (const book of OT_BOOKS) {
    const list = byBook.get(book) || [];
    const bookPath = path.join(OUT_DIR, `${book}_events_v1.csv`);

    const lines = [header.join(',')];

    for (const r of list) {
      const event_id = keys.idKey ? r[keys.idKey] : '';
      const title = keys.titleKey ? r[keys.titleKey] : '';
      const sc = r[keys.startChapKey];
      const sv = r[keys.startVerseKey];
      const ec = r[keys.endChapKey];
      const ev = r[keys.endVerseKey];

      const start_ref = refStr(book, sc, sv, null);
      const end_ref = refStr(book, ec, ev, null);

      const rowOut = [
        book,
        event_id,
        title,
        sc,
        sv,
        ec,
        ev,
        start_ref,
        end_ref,
      ].map(csvEscape).join(',');

      lines.push(rowOut);
      masterLines.push(rowOut);
    }

    fs.writeFileSync(bookPath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${bookPath} (${list.length} events)`);
  }

  fs.writeFileSync(masterPath, masterLines.join('\n'), 'utf8');
  console.log(`Wrote ${masterPath} (master)`);
  console.log('DONE.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
