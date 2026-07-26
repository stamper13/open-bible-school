import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const OUT_DIR = path.join(process.cwd(), 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });

function escCsv(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filepath, rows) {
  if (!rows || rows.length === 0) {
    fs.writeFileSync(filepath, '', 'utf8');
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(headers.map(escCsv).join(','));
  for (const r of rows) {
    lines.push(headers.map(h => escCsv(r[h])).join(','));
  }
  fs.writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');
}

async function fetchAllFromView(viewName, pageSize = 5000) {
  let all = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .range(from, to);

    if (error) throw error;

    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function main() {
  console.log('Export OT entity tiers v1…');

  // 1) Per-book tiers
  const bookView = 'ot_book_entity_tiers_v1';
  console.log(`Loading ${bookView}…`);
  const bookRows = await fetchAllFromView(bookView, 5000);
  console.log(`Rows: ${bookRows.length}`);
  const bookOut = path.join(OUT_DIR, `${bookView}.csv`);
  writeCsv(bookOut, bookRows);
  console.log('Wrote:', bookOut);

  // 2) Corpus/scope tiers (Torah / Former Prophets / etc)
  const scopeView = 'ot_scope_entity_tiers_v1';
  console.log(`Loading ${scopeView}…`);
  const scopeRows = await fetchAllFromView(scopeView, 5000);
  console.log(`Rows: ${scopeRows.length}`);
  const scopeOut = path.join(OUT_DIR, `${scopeView}.csv`);
  writeCsv(scopeOut, scopeRows);
  console.log('Wrote:', scopeOut);

  console.log('DONE.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
