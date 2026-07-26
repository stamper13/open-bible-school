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

const TIPNR_PATH = path.join(process.cwd(), 'input', 'stepbible', 'TIPNR.txt');

// TIPNR uses 3-letter book abbreviations like Exo, Lev, 1Sa, Mat, etc.
// We'll store them exactly as provided (book_code text).
function parseRefToken(token) {
  // token examples:
  //   "Exo.7.10a"
  //   "Heb.5.4"
  //   "1Ch.6.3a"
  // Sometimes trailing semicolons/spaces; caller strips.
  const m = token.match(/^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)([a-z])?$/);
  if (!m) return null;

  const book_code = m[1];
  const chapter = parseInt(m[2], 10);
  const verse = parseInt(m[3], 10);
  const verse_suffix = m[4] || null;

  return {
    book_code,
    chapter,
    verse,
    verse_suffix,
    ref: `${book_code}.${chapter}.${verse}${verse_suffix ?? ''}`,
  };
}

function splitTabsPreserve(line) {
  // TIPNR is tab-separated; keep empty fields
  return line.split('\t');
}

function detectEntityType(line) {
  // Header marker lines like: "$========== PERSON(s)"
  const t = line.trim().toUpperCase();
  if (t.includes('PERSON')) return 'person';
  if (t.includes('PLACE')) return 'place';
  if (t.includes('OTHER')) return 'other';
  return null;
}

function parseUniqueNameParts(uniqueName) {
  // Example: "Aaron@Exo.4.14=H0175A"
  // display_name = "Aaron"
  // tipnr_key = "H0175A"
  let display_name = uniqueName;
  const atIdx = uniqueName.indexOf('@');
  if (atIdx > 0) display_name = uniqueName.slice(0, atIdx).trim();

  let tipnr_key = null;
  const eqIdx = uniqueName.indexOf('=');
  if (eqIdx > -1 && eqIdx < uniqueName.length - 1) {
    tipnr_key = uniqueName.slice(eqIdx + 1).trim() || null;
  }

  return { display_name, tipnr_key };
}

async function upsertEntity({ entity_type, unique_name, display_name, tipnr_key, header_fields }) {
  const { data, error } = await supabase
    .from('bible_entities')
    .upsert(
      {
        entity_type,
        unique_name,
        display_name,
        tipnr_key,
        header_fields,
      },
      { onConflict: 'unique_name' }
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function insertOrGetForm({ entity_id, unique_tag, hebrew_greek, esv_name, step_link, refs_raw }) {
  // Because we created a unique index on (entity_id, unique_tag),
  // we can upsert safely.
  const { data, error } = await supabase
    .from('bible_entity_forms')
    .upsert(
      {
        entity_id,
        unique_tag,
        hebrew_greek: hebrew_greek || null,
        esv_name: esv_name || null,
        step_link: step_link || null,
        refs_raw: refs_raw || null,
      },
      { onConflict: 'entity_id,unique_tag' }
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function upsertRefsBulk(rows) {
  // rows: [{entity_id, form_id, book_code, chapter, verse, verse_suffix, ref}, ...]
  if (!rows.length) return 0;
  const { error } = await supabase.from('bible_entity_refs').upsert(rows, { onConflict: 'form_id,ref' });
  if (error) throw error;
  return rows.length;
}

async function main() {
  console.log('TIPNR ingest v1 starting…');
  console.log('Reading:', TIPNR_PATH);

  const raw = fs.readFileSync(TIPNR_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  let currentType = null;
  let currentEntityId = null;
  let currentUniqueName = null;

  // Counters
  let entityCount = 0;
  let formCount = 0;
  let refCount = 0;

  // Batch refs to reduce API calls
  const REF_BATCH = 5000;
  let refBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) continue;

    // Identify section markers
    if (line.startsWith('$') && line.includes('==========')) {
      const t = detectEntityType(line);
      if (t) {
        currentType = t;
        currentEntityId = null;
        currentUniqueName = null;
      }
      continue;
    }

    // Skip comment lines
    if (line.startsWith('#')) continue;

    // Header record lines start with "$" followed by UniqueName (data record)
    if (line.startsWith('$') && !line.includes('==========')) {
      if (!currentType) continue; // ignore until we reach PERSON/PLACE/OTHER section

      const cols = splitTabsPreserve(line.slice(1)); // remove leading "$"
      // PERSON(s) header format (from file docs):
      // UniqueName | Description | Parents | Siblings | Partners | Offspring | Tribe/Nation...
      // PLACE header format:
      // UniqueName | OpenBible name=Near | Founder | People living there | GoogleMaps | PalOpenMaps/Nation | Geographical area
      // OTHER header format:
      // UniqueName | Description | ... (often blanks)

      const unique_name = (cols[0] || '').trim();
      if (!unique_name) continue;

      const { display_name, tipnr_key } = parseUniqueNameParts(unique_name);

      // Store all header columns as JSON array with labels by type (v1 simple).
      // We keep the raw columns so you can refine later without re-ingesting.
      const header_fields = {
        raw_columns: cols.map(c => (c ?? '').trim()),
      };

      currentEntityId = await upsertEntity({
        entity_type: currentType,
        unique_name,
        display_name,
        tipnr_key,
        header_fields,
      });

      currentUniqueName = unique_name;
      entityCount++;

      if (entityCount % 500 === 0) {
        console.log(`Entities upserted: ${entityCount} (line ${i + 1})`);
      }

      continue;
    }

    // Sub-record lines are indented with a leading TAB (empty first field)
    // In your sample they start with "\tAaron@Exo.4.14\tH0175=...\tAaron\tSTEP_LINK\tRefs..."
    if (line.startsWith('\t')) {
      if (!currentEntityId || !currentType || !currentUniqueName) continue;

      const cols = splitTabsPreserve(line);
      // For PERSON/OTHER subrecord format per docs:
      // (empty) | UniqueTag | Hebrew/Greek | ESV name | STEP link for Refs | Refs
      // For PLACE subrecord per docs:
      // (empty) | UniqueTag | Hebrew/Greek | ESV name | Refs | STEP link for Refs
      // NOTE: order differs for PLACE. We'll detect by whether cols[4] looks like a URL.

      const unique_tag = (cols[1] || '').trim();
      const hebrew_greek = (cols[2] || '').trim();
      const esv_name = (cols[3] || '').trim();

      let step_link = null;
      let refs_raw = null;

      const c4 = (cols[4] || '').trim();
      const c5 = (cols[5] || '').trim();

      const looksLikeUrl = (s) => /^https?:\/\//i.test(s);

      if (currentType === 'place') {
        // PLACE subrecord commonly: [4]=Refs, [5]=STEP link
        if (looksLikeUrl(c4) && !looksLikeUrl(c5)) {
          // Unexpected but handle gracefully
          step_link = c4 || null;
          refs_raw = c5 || null;
        } else {
          refs_raw = c4 || null;
          step_link = c5 || null;
        }
      } else {
        // PERSON/OTHER: [4]=STEP link, [5]=Refs
        if (looksLikeUrl(c4)) {
          step_link = c4 || null;
          refs_raw = c5 || null;
        } else if (looksLikeUrl(c5)) {
          // swapped
          step_link = c5 || null;
          refs_raw = c4 || null;
        } else {
          // neither looks like URL; keep raw
          refs_raw = c5 || c4 || null;
          step_link = null;
        }
      }

      if (!unique_tag) continue;

      const form_id = await insertOrGetForm({
        entity_id: currentEntityId,
        unique_tag,
        hebrew_greek,
        esv_name,
        step_link,
        refs_raw,
      });

      formCount++;

      // Parse refs into normalized rows
      if (refs_raw) {
        const tokens = refs_raw
          .split(';')
          .map(t => t.trim())
          .filter(Boolean);

        for (const tok of tokens) {
          // tokens may include spaces like "Exo.4.14" or "Exo.7.10a"
          // Sometimes trailing punctuation; strip commas
          const clean = tok.replace(/[,]+$/g, '').trim();
          const parsed = parseRefToken(clean);
          if (!parsed) continue;

          refBuffer.push({
            entity_id: currentEntityId,
            form_id,
            book_code: parsed.book_code,
            chapter: parsed.chapter,
            verse: parsed.verse,
            verse_suffix: parsed.verse_suffix,
            ref: parsed.ref,
          });

          if (refBuffer.length >= REF_BATCH) {
            refCount += await upsertRefsBulk(refBuffer);
            console.log(`  refs upserted so far: ${refCount}`);
            refBuffer = [];
          }
        }
      }

      if (formCount % 2000 === 0) {
        console.log(`Forms processed: ${formCount} (entities ${entityCount})`);
      }

      continue;
    }

    // Otherwise ignore preamble/other text
  }

  // flush ref buffer
  if (refBuffer.length) {
    refCount += await upsertRefsBulk(refBuffer);
    refBuffer = [];
  }

  console.log('DONE.');
  console.log(`Entities: ${entityCount}`);
  console.log(`Forms:    ${formCount}`);
  console.log(`Refs:     ${refCount}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
