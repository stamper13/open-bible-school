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

function readJudeFile() {
  const files = fs.readdirSync(INPUT_DIR);
  const judeFile = files.find(f =>
    f.toUpperCase().includes('JUD') && f.toUpperCase().endsWith('.SFM')
  );
  if (!judeFile) throw new Error('Could not find a Jude SFM file');
  const fullPath = path.join(INPUT_DIR, judeFile);
  console.log('Reading file:', fullPath);
  return fs.readFileSync(fullPath, 'utf8');
}

function parseBookCode(raw) {
  const lines = raw.split(/\r?\n/);
  const idLine = lines.find(l => l.startsWith('\\id '));
  if (!idLine) throw new Error('No \\id line found');
  const match = idLine.match(/^\\id\s+([A-Z0-9]{3})\b/);
  if (!match) throw new Error('Could not parse book code from \\id line: ' + idLine);
  return { bookCode: match[1], idLine };
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
  const { bookCode } = parseBookCode(raw);
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

  function openNewSection(level, text, startChapter, startVerse, bookCode) {
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
        openNewSection(currentHeading.level, currentHeading.text, chapter, verseNum, bookCode);
      } else {
        if (
          openSection.heading_level !== currentHeading.level ||
          openSection.heading_text !== currentHeading.text
        ) {
          const prevEndVerse = Math.max(1, verseNum - 1);
          closeOpenSection(chapter, prevEndVerse);
          openNewSection(currentHeading.level, currentHeading.text, chapter, verseNum, bookCode);
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
  // Jude is 1 chapter, but do it generally.
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
  // Delete verses first (FK restrict from verses -> sections)
  const delVerses = await supabase
    .from('scripture_verses')
    .delete()
    .eq('book_code', bookCode);

  if (delVerses.error) throw delVerses.error;

  const delSections = await supabase
    .from('scripture_sections')
    .delete()
    .eq('book_code', bookCode);

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
    if (!match) {
      throw new Error(`No matching section for ${bookCode} ${v.chapter}:${v.verse}`);
    }

    rows.push({
      book_code: bookCode,
      chapter: v.chapter,
      verse: v.verse,
      section_id: match.id,
      text_clean: v.text_clean
    });
  }

  // Insert in chunks to avoid payload limits
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('scripture_verses').insert(chunk);
    if (error) throw error;
  }
}

async function main() {
  const raw = readJudeFile();
  const { bookCode, sections, verses } = parseBook(raw);

  console.log('Parsed book code:', bookCode);
  console.log('Will write sections:', sections.length, 'verses:', verses.length);

  await assertBookExists(bookCode);

  console.log('Deleting any existing rows for book:', bookCode);
  await deleteExistingBookData(bookCode);

  console.log('Inserting sections...');
  const insertedSections = await insertSections(sections);
  console.log('Inserted sections:', insertedSections.length);

  console.log('Inserting verses...');
  await insertVerses(bookCode, verses, insertedSections);
  console.log('Inserted verses:', verses.length);

  console.log('DONE.');
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
