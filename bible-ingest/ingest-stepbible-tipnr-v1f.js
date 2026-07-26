
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TIPNR_PATH = path.join(process.cwd(), 'input', 'stepbible', 'TIPNR.txt');

/* ---------------- BOOK CODE MAP ---------------- */

const STEP_BOOK_TO_INTERNAL = {
  Gen:"GEN", Exo:"EXO", Lev:"LEV", Num:"NUM", Deu:"DEU",
  Jos:"JOS", Jdg:"JDG", Rut:"RUT",
  "1Sa":"1SA","2Sa":"2SA","1Ki":"1KI","2Ki":"2KI",
  "1Ch":"1CH","2Ch":"2CH", Ezr:"EZR", Neh:"NEH", Est:"EST",
  Job:"JOB", Psa:"PSA", Pro:"PRO", Ecc:"ECC", Sng:"SNG",
  Isa:"ISA", Jer:"JER", Lam:"LAM", Ezk:"EZK", Dan:"DAN",
  Hos:"HOS", Jol:"JOL", Amo:"AMO", Oba:"OBA", Jon:"JON",
  Mic:"MIC", Nah:"NAM", Hab:"HAB", Zep:"ZEP",
  Hag:"HAG", Zec:"ZEC", Mal:"MAL",
  Mat:"MAT", Mrk:"MRK", Luk:"LUK", Jhn:"JHN", Act:"ACT",
  Rom:"ROM","1Co":"1CO","2Co":"2CO", Gal:"GAL", Eph:"EPH",
  Php:"PHP", Col:"COL","1Th":"1TH","2Th":"2TH",
  "1Ti":"1TI","2Ti":"2TI", Tit:"TIT", Phm:"PHM",
  Heb:"HEB", Jas:"JAS","1Pe":"1PE","2Pe":"2PE",
  "1Jn":"1JN","2Jn":"2JN","3Jn":"3JN", Jud:"JUD", Rev:"REV"
};

function mapBook(code) {
  return STEP_BOOK_TO_INTERNAL[code] ?? null;
}

/* ---------------- PARSING HELPERS ---------------- */

function stripBOM(s) {
  return s.replace(/^[\uFEFF\u200B]+/, '');
}

function looksLikeUniqueName(s) {
  return /@([1-3]?[A-Za-z]{2,3})\.\d+\.\d+/.test(s);
}

function parseRef(token) {
  const m = token.match(/^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)/);
  if (!m) return null;

  const book = mapBook(m[1]);
  const chapter = parseInt(m[2], 10);
  const verse = parseInt(m[3], 10);

  if (!book || chapter < 1 || verse < 1) return null;

  return {
    book_code: book,
    chapter,
    verse,
    ref: `${book}.${chapter}.${verse}`
  };
}

/* ---------------- MAIN INGEST ---------------- */

async function main() {
  console.log("TIPNR ingest v1f starting…");
  const lines = fs.readFileSync(TIPNR_PATH, 'utf8').split(/\r?\n/);

  let entityType = null;
  let entityId = null;
  let entities = 0, forms = 0, refs = 0;
  let refBuffer = [];

  for (const raw of lines) {
    if (!raw) continue;
    const line = stripBOM(raw);

    if (line.startsWith('$==========')) {
      if (line.includes('PERSON')) entityType = 'person';
      else if (line.includes('PLACE')) entityType = 'place';
      else entityType = 'other';
      entityId = null;
      continue;
    }

    if (line.startsWith('#')) continue;

    if (!line.startsWith('\t') && looksLikeUniqueName(line)) {
      const cols = line.split('\t');
      const unique_name = cols[0].trim();

      const { data } = await supabase
        .from('bible_entities')
        .upsert({
          entity_type: entityType,
          unique_name,
          display_name: unique_name.split('@')[0]
        }, { onConflict: 'unique_name' })
        .select('id')
        .single();

      entityId = data.id;
      entities++;
      continue;
    }

    if (line.startsWith('\t') && entityId) {
      const cols = line.split('\t');
      const unique_tag = cols[1]?.trim();
      const refs_raw = cols[5]?.trim() ?? cols[4]?.trim();

      if (!unique_tag) continue;

      const { data: form } = await supabase
        .from('bible_entity_forms')
        .upsert({ entity_id: entityId, unique_tag },
          { onConflict: 'entity_id,unique_tag' })
        .select('id')
        .single();

      forms++;

      if (refs_raw) {
        for (const t of refs_raw.split(';')) {
          const r = parseRef(t.trim());
          if (!r) continue;

          refBuffer.push({
            form_id: form.id,
            entity_id: entityId,
            ...r
          });

          if (refBuffer.length >= 5000) {
            await supabase.from('bible_entity_refs')
              .upsert(refBuffer, { onConflict: 'form_id,ref' });
            refs += refBuffer.length;
            refBuffer = [];
          }
        }
      }
    }
  }

  if (refBuffer.length) {
    await supabase.from('bible_entity_refs')
      .upsert(refBuffer, { onConflict: 'form_id,ref' });
    refs += refBuffer.length;
  }

  console.log("DONE.");
  console.log("Entities:", entities);
  console.log("Forms:", forms);
  console.log("Refs:", refs);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
