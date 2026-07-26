import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const PAGE = 10000;          // fetch pages for verses/refs
const UPSERT_BATCH = 1000;   // upsert batches for stats

function keyCV(ch, vs) {
  return `${ch}.${vs}`;
}

function keyES(entityId, sectionId) {
  return `${entityId}|${sectionId}`;
}

async function fetchAllBooks() {
  const { data, error } = await supabase
    .from('scripture_books')
    .select('book_code, testament')
    .order('canon_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchVersesMapForBook(book_code) {
  // Returns Map "chapter.verse" => section_id
  const map = new Map();
  let from = 0;

  while (true) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from('scripture_verses')
      .select('chapter, verse, section_id')
      .eq('book_code', book_code)
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (!row.chapter || !row.verse || !row.section_id) continue;
      map.set(keyCV(row.chapter, row.verse), row.section_id);
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return map;
}

async function fetchEntityRefsForBook(book_code) {
  // Returns array of { entity_id, chapter, verse }
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from('bible_entity_refs')
      .select('entity_id, chapter, verse')
      .eq('book_code', book_code)
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

async function upsertStatsBatch(batch) {
  const { error } = await supabase
    .from('bible_entity_section_stats')
    .upsert(batch, { onConflict: 'entity_id,section_id' });

  if (error) throw error;
}

async function clearExisting() {
  // Clear to make reruns deterministic (optional, but recommended right now)
  const { error } = await supabase
    .from('bible_entity_section_stats')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

  if (error) throw error;
}

async function main() {
  console.log('Link entities -> sections v1 starting…');

  const books = await fetchAllBooks();
  console.log(`Books loaded: ${books.length}`);

  console.log('Clearing existing bible_entity_section_stats…');
  await clearExisting();

  let totalUpserted = 0;
  let totalMatchedRefs = 0;
  let totalUnmatchedRefs = 0;

  for (const b of books) {
    const book_code = b.book_code;
    if (!book_code) continue;

    console.log(`\n[${book_code}] building verse map…`);
    const verseMap = await fetchVersesMapForBook(book_code);
    console.log(`[${book_code}] verses mapped: ${verseMap.size}`);

    console.log(`[${book_code}] loading entity refs…`);
    const refs = await fetchEntityRefsForBook(book_code);
    console.log(`[${book_code}] refs loaded: ${refs.length}`);

    // Aggregate occurrences per (entity_id, section_id)
    const agg = new Map();

    for (const r of refs) {
      const ch = r.chapter;
      const vs = r.verse;
      const entityId = r.entity_id;

      if (!entityId || !ch || !vs) {
        totalUnmatchedRefs++;
        continue;
      }

      const sectionId = verseMap.get(keyCV(ch, vs));
      if (!sectionId) {
        totalUnmatchedRefs++;
        continue;
      }

      totalMatchedRefs++;

      const k = keyES(entityId, sectionId);
      const prev = agg.get(k) || 0;
      agg.set(k, prev + 1);
    }

    // Upsert in batches
    const rows = Array.from(agg.entries()).map(([k, occurrences]) => {
      const [entity_id, section_id] = k.split('|');
      return { entity_id, section_id, occurrences };
    });

    console.log(`[${book_code}] distinct entity-section pairs: ${rows.length}`);

    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH);
      await upsertStatsBatch(batch);
      totalUpserted += batch.length;

      if ((i / UPSERT_BATCH) % 10 === 0 && rows.length > UPSERT_BATCH) {
        console.log(
          `[${book_code}] upserted ${Math.min(i + batch.length, rows.length)}/${rows.length}`
        );
      }
    }
  }

  console.log('\nDONE.');
  console.log(`Matched refs -> verses: ${totalMatchedRefs}`);
  console.log(`Unmatched refs:         ${totalUnmatchedRefs}`);
  console.log(`Rows upserted:          ${totalUpserted}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
