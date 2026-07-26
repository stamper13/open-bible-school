import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const INPUT_DIR = path.join(process.cwd(), 'input', 'bsb-sfm');

function listSfmFiles() {
  return fs
    .readdirSync(INPUT_DIR)
    .filter(f => f.toUpperCase().endsWith('.SFM'))
    .map(f => path.join(INPUT_DIR, f));
}

function readFileUtf8(fullPath) {
  return fs.readFileSync(fullPath, 'utf8');
}

function parseBookCode(raw) {
  const lines = raw.split(/\r?\n/);
  const idLine = lines.find(l => l.startsWith('\\id '));
  if (!idLine) throw new Error('No \\id line found');
  const match = idLine.match(/^\\id\s+([A-Z0-9]{3})\b/);
  if (!match) throw new Error('Could not parse book code from \\id line: ' + idLine);
  return match[1];
}

function stripInlineFootnotesAndRefs(s) {
  s = s.replace(/\\f\s+[^]*?\\f\*/g, '');
  s = s.replace(/\\x\s+[^]*?\\x\*/g, '');
  return s;
}

function cleanVerseText(s) {
  s = stripInlineFootnotesAndRefs(s);
  s = s.replace(/\\(m|b|q1|q2|q3|q4|r)\b/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function parseBook(raw) {
  const bookCode = parseBookCode(raw);
  const lines = raw.split(/\r?\n/);

  let chapter = null;
  let currentHeading = { level: 0, text: null };

  const sections = [];
  const verses = [];

  let openSection = null;
  let currentVerse = null;

  function flushVerse() {
    if (!currentVerse) return;
    const text_clean = cleanVerseText(currentVerse.textParts.join(' '));
    verses.push({
      chapter: currentVerse.chapter,
      verse: currentVerse.verse,
      text_clean
    });
    currentVerse = null;
  }

  function closeOpenSection(endChapter, endVerse) {
    if (!openSection) return;
    openSection.end_chapter = endChapter;
    openSection.end_verse = endVerse;
    sections.push(openSection);
    openSection = null;
  }

  function openNewSection(level, text, startChapter, startVerse) {
    openSection = {
      book_code: bookCode,
      heading_level: level,
      heading_text: text,
      start_chapter: startChapter,
      start_verse: startVerse,
      end_chapter: startChapter,
      end_verse: startVerse
    };
  }

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;

    if (line.startsWith('\\c ')) {
      flushVerse();
      const m = line.match(/^\\c\s+(\d+)/);
      if (m) chapter = parseInt(m[1], 10);
      continue;
    }

    const sMatch = line.match(/^\\s(\d+)\s+(.*)$/);
    if (sMatch) {
      flushVerse();
      currentHeading = { level: parseInt(sMatch[1], 10), text: sMatch[2].trim() };
      continue;
    }

    const vMatch = line.match(/^\\v\s+(\d+)\s*(.*)$/);
    if (vMatch) {
      flushVerse();
      if (!chapter) chapter = 1;

      const verseNum = parseInt(vMatch[1], 10);
      const after = (vMatch[2] || '').trim();

      if (!openSection) {
        openNewSection(currentHeading.level, currentHeading.text, chapter, verseNum);
      } else {
        if (
          openSection.heading_level !== currentHeading.level ||
          openSection.heading_text !== currentHeading.text
        ) {
          const prevEndVerse = Math.max(1, verseNum - 1);
          closeOpenSection(chapter, prevEndVerse);
          openNewSection(currentHeading.level, currentHeading.text, chapter, verseNum);
        }
      }

      currentVerse = { chapter, verse: verseNum, textParts: [] };
      if (after) currentVerse.textParts.push(after);
      continue;
    }

    if (line.startsWith('\\')) {
      if (currentVerse) {
        const cont = line.replace(/^\\[a-z0-9]+\s*/i, '').trim();
        if (cont) currentVerse.textParts.push(cont);
      }
      continue;
    }

    if (currentVerse) currentVerse.textParts.push(line);
  }

  flushVerse();

  if (verses.length > 0) {
    const last = verses[verses.length - 1];
    closeOpenSection(last.chapter, last.verse);
  }

  return { bookCode, sections, verses };
}

function verseInSection(v, s) {
  if (v.chapter < s.start_chapter) return false;
  if (v.chapter > s.end_chapter) return false;
  if (v.chapter === s.start_chapter && v.verse < s.start_verse) return false;
  if (v.chapter === s.end_chapter && v.verse > s.end_verse) return false;
  return true;
}

async function assertBookExists(bookCode) {
  const { data, error } = await supabase
    .from('scripture_books')
    .select('book_code')
    .eq('book_code', bookCode)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Book code ${bookCode} not found in scripture_books`);
}

async function deleteExistingBookData(bookCode) {
  const delVerses = await supabase.from('scripture_verses').delete().eq('book_code', bookCode);
  if (delVerses.error) throw delVerses.error;

  const delSections = await supabase.from('scripture_sections').delete().eq('book_code', bookCode);
  if (delSections.error) throw delSections.error;
}

async function insertSections(sections) {
  const { data, error } = await supabase
    .from('scripture_sections')
    .insert(sections)
    .select('id, heading_level, heading_text, start_chapter, start_verse, end_chapter, end_verse');
  if (error) throw error;
  return data;
}

async function insertVerses(bookCode, verses, insertedSections) {
  const rows = [];
  for (const v of verses) {
    const match = insertedSections.find(s => verseInSection(v, s));
    if (!match) throw new Error(`No matching section for ${bookCode} ${v.chapter}:${v.verse}`);
    rows.push({
      book_code: bookCode,
      chapter: v.chapter,
      verse: v.verse,
      section_id: match.id,
      text_clean: v.text_clean
    });
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('scripture_verses').insert(chunk);
    if (error) throw error;
  }
}

async function ingestOneFile(fullPath) {
  const raw = readFileUtf8(fullPath);
  const { bookCode, sections, verses } = parseBook(raw);

  await assertBookExists(bookCode);

  await deleteExistingBookData(bookCode);
  const insertedSections = await insertSections(sections);
  await insertVerses(bookCode, verses, insertedSections);

  return { bookCode, sectionCount: insertedSections.length, verseCount: verses.length };
}

async function main() {
  const files = listSfmFiles();
  if (files.length === 0) throw new Error('No .SFM files found in input/bsb-sfm');

  console.log(`Found ${files.length} .SFM files.`);

  const successes = [];
  const failures = [];

  for (const f of files) {
    const base = path.basename(f);
    try {
      console.log(`\n=== Ingesting ${base} ===`);
      const result = await ingestOneFile(f);
      console.log(`OK: ${result.bookCode} sections=${result.sectionCount} verses=${result.verseCount}`);
      successes.push({ file: base, ...result });
    } catch (err) {
      console.error(`FAIL: ${base}`);
      console.error(err?.message || err);
      failures.push({ file: base, error: err?.message || String(err) });
    }
  }

  console.log('\n===== SUMMARY =====');
  console.log('Successes:', successes.length);
  console.log('Failures:', failures.length);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('-', f.file, '=>', f.error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
