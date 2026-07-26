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

function parseRefToken(token) {
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
  return line.split('\t');
}

function detectEntityTypeFromMarkerLine(lineTrimmed) {
  const t = lineTrimmed.toUpperCase();
  if (t.includes('PERSON')) return 'person';
  if (t.includes('PLACE')) return 'place';
  if (t.includes('OTHER')) return 'other';
  return null;
}

function parseUniqueNameParts(uniqueName) {
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

async function upsertForm({ entity_id, unique_tag, hebrew_greek, esv_name, step_link, refs_raw }) {
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
  if (!rows.length) return 0;
  const { error } = await supabase.from('bible_entity_refs').upsert(rows, { onConflict: 'form_id,ref' });
  if (error) throw error;
  return rows.length;
}

async function main() {
  console.log('TIPNR ingest v1b starting…');
  console.log('Reading:', TIPNR_PATH);

  const raw = fs.readFileSync(TIPNR_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  let currentType = null;
  let currentEntityId = null;
  let currentUniqueName = null;

  let entityCount = 0;
  let formCount = 0;
  let refCount = 0;

  const REF_BATCH = 5000;
  let refBuffer = [];

  let sawAnyMarker = false;
  let sawAnyDataHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const ltrim = line.trimStart();

    // Marker blocks like "$========== PERSON(s)"
    if (ltrim.startsWith('$') && ltrim.includes('==========')) {
      const t = detectEntityTypeFromMarkerLine(ltrim);
      if (t) {
        currentType = t;
        currentEntityId = null;
        currentUniqueName = null;
        sawAnyMarker = true;
      }
      continue;
    }

    // Skip comments
    if (ltrim.startsWith('#')) continue;

    // Data header record lines begin with "$" (not the "==========")
    if (ltrim.startsWith('$') && !ltrim.includes('==========')) {
      if (!currentType) continue;

      const cols = splitTabsPreserve(ltrim.slice(1)); // remove "$"
      const unique_name = (cols[0] || '').trim();
      if (!unique_name) continue;

      const { display_name, tipnr_key } = parseUniqueNameParts(unique_name);

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
      sawAnyDataHeader = true;

      if (entityCount % 500 === 0) {
        console.log(`Entities upserted: ${entityCount} (line ${i + 1})`);
      }

      continue;
    }

    // Subrecord lines: start with TAB in original file (do NOT ltrim here)
    if (line.startsWith('\t')) {
      if (!currentEntityId || !currentType || !currentUniqueName) continue;

      const cols = splitTabsPreserve(line);

      const unique_tag = (cols[1] || '').trim();
      const hebrew_greek = (cols[2] || '').trim();
      const esv_name = (cols[3] || '').trim();

      let step_link = null;
      let refs_raw = null;

      const c4 = (cols[4] || '').trim();
      const c5 = (cols[5] || '').trim();

      const looksLikeUrl = (s) => /^https?:\/\//i.test(s);

      if (currentType === 'place') {
        // PLACE subrecord usually: [4]=Refs, [5]=STEP link
        refs_raw = c4 || null;
        step_link = c5 || null;

        // If swapped, fix
        if (looksLikeUrl(refs_raw) && !looksLikeUrl(step_link)) {
          const tmp = refs_raw;
          refs_raw = step_link;
          step_link = tmp;
        }
      } else {
        // PERSON/OTHER: [4]=STEP link, [5]=Refs
        step_link = looksLikeUrl(c4) ? (c4 || null) : null;
        refs_raw = step_link ? (c5 || null) : (c5 || c4 || null);

        // If swapped, fix
        if (!step_link && looksLikeUrl(c5)) {
          step_link = c5 || null;
          refs_raw = c4 || null;
        }
      }

      if (!unique_tag) continue;

      const form_id = await upsertForm({
        entity_id: currentEntityId,
        unique_tag,
        hebrew_greek,
        esv_name,
        step_link,
        refs_raw,
      });

      formCount++;

      if (refs_raw) {
        const tokens = refs_raw
          .split(';')
          .map(t => t.trim())
          .filter(Boolean);

        for (const tok of tokens) {
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

    // ignore everything else (preamble text)
  }

  if (refBuffer.length) {
    refCount += await upsertRefsBulk(refBuffer);
    refBuffer = [];
  }

  console.log('----- DIAGNOSTICS -----');
  console.log('Saw PERSON/PLACE/OTHER markers:', sawAnyMarker);
  console.log('Saw any header data records ($UniqueName...):', sawAnyDataHeader);

  console.log('DONE.');
  console.log(`Entities: ${entityCount}`);
  console.log(`Forms:    ${formCount}`);
  console.log(`Refs:     ${refCount}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
