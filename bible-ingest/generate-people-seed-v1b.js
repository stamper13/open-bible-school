import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const VERSE_TEXT_COL = 'text_clean';

const STOP = new Set([
  'The','A','An','And','But','Or','Nor','For','So','Yet',
  'I','You','He','She','We','They','It','His','Her','Him','Their','Our','My',
  'In','On','At','By','To','From','With','Without','Into','Over','Under','After','Before',
  'Lord','LORD','God','Amen'
]);

const tokenRe = /\b[A-Z][A-Za-z’'-]{1,}\b/g;

function normalizeName(s) {
  return s.replace(/’/g, "'").trim();
}

function normalizedKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function fetchPage(offset, limit) {
  const { data, error } = await supabase
    .from('scripture_verses')
    .select(`id, book_code, chapter, verse, ${VERSE_TEXT_COL}`)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
}

async function main() {
  console.log('Scanning scripture_verses for candidate person names…');

  const counts = new Map();
  const PAGE = 5000;

  const { count, error: countErr } = await supabase
    .from('scripture_verses')
    .select('id', { count: 'exact', head: true });

  if (countErr) throw countErr;
  const total = count ?? 0;

  console.log('Total verses:', total);

  for (let start = 0; start < total; start += PAGE) {
    const rows = await fetchPage(start, PAGE);

    for (const r of rows) {
      const text = (r[VERSE_TEXT_COL] || '').toString();
      if (!text) continue;

      const matches = text.match(tokenRe);
      if (!matches) continue;

      for (const raw of matches) {
        const name = normalizeName(raw);
        if (!name) continue;
        if (STOP.has(name)) continue;
        if (name.length < 3) continue;

        let entry = counts.get(name);
        if (!entry) {
          entry = { count: 0, books: new Set() };
          counts.set(name, entry);
        }
        entry.count += 1;
        entry.books.add(r.book_code);
      }
    }

    if ((start / PAGE) % 10 === 0) {
      console.log(`  scanned ${Math.min(start + PAGE, total)}/${total} verses`);
    }
  }

  const ranked = Array.from(counts.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      book_count: v.books.size,
      key: normalizedKey(name)
    }))
    .sort((a, b) => (b.book_count - a.book_count) || (b.count - a.count) || a.name.localeCompare(b.name));

  const topN = 2000;
  const csv = ['name,count,book_count,normalized_key'];
  for (const r of ranked.slice(0, topN)) {
    csv.push(`"${r.name.replace(/"/g, '""')}",${r.count},${r.book_count},${r.key}`);
  }
  fs.writeFileSync('people-candidates.csv', csv.join('\n'));
  console.log(`Wrote people-candidates.csv (top ${topN})`);

  const seedN = 1200;
  const chosen = ranked.slice(0, seedN);

  const sql = [];
  sql.push('-- AUTO-GENERATED DRAFT SEED');
  sql.push('begin;');
  sql.push('');
  sql.push('insert into public.people (canonical_name, normalized_key) values');

  for (let i = 0; i < chosen.length; i++) {
    const n = chosen[i].name.replace(/'/g, "''");
    const k = chosen[i].key.replace(/'/g, "''");
    sql.push(`('${n}', '${k}')${i === chosen.length - 1 ? ';' : ','}`);
  }

  sql.push('');
  sql.push(`
insert into public.people_aliases (person_id, alias, alias_norm, match_strategy)
select
  p.id,
  p.canonical_name,
  lower(p.canonical_name),
  case when position(' ' in p.canonical_name) > 0 then 'phrase' else 'exact' end
from public.people p
where p.normalized_key in (
${chosen.map(c => `'${c.key}'`).join(',\n')}
);
  `.trim());

  sql.push('');
  sql.push('commit;');

  fs.writeFileSync('seed-people.sql', sql.join('\n'));
  console.log(`Wrote seed-people.sql (top ${seedN})`);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
