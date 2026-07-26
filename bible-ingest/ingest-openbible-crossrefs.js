import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const FILE_NAME = 'cross_references 2.txt';
const FILE_PATH = path.join(process.cwd(), FILE_NAME);

const BATCH_SIZE = 2000;

// Parses one line of the OpenBible crossref file.
// Expected general forms (space-separated):
//   Gen.1.1  Zech.12.1  59
//   Gen.1.1  2 Pet.1.1  96       (note "2" and "Pet.1.1" split)
//   Gen.1.1  Ps.148.4-Ps.148.5  54
//
// Returns null if line is ignorable.
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;

  // Skip header lines (your file begins with "From Verse    To Verse    Votes ...")
  // If a line starts with "From" and contains "Verse" and "Votes", ignore it.
  if (/^From\b/i.test(trimmed) && /Verse/i.test(trimmed) && /Votes/i.test(trimmed)) {
    return null;
  }

  // Normalize whitespace into tokens
  const tokens = trimmed.split(/\s+/);

  // We need at least: from_ref, to_ref, votes. But to_ref may be 1-2 tokens.
  // The last token should be votes (integer, can be negative).
  const votesToken = tokens[tokens.length - 1];
  if (!/^-?\d+$/.test(votesToken)) {
    // Some lines may have trailing metadata or malformed content; skip safely.
    return null;
  }

  const votes = parseInt(votesToken, 10);

  // Remaining tokens between first and last form from_ref and to_ref (possibly 2 tokens).
  // Typically:
  //   [from] [to] [votes]  => 3 tokens total
  // Or:
  //   [from] [to_part1] [to_part2] [votes]  => 4 tokens total (e.g., "2" "Pet.1.1")
  // Rarely could be longer if book abbreviations contain spaces, but OpenBible uses this pattern.
  const middle = tokens.slice(0, tokens.length - 1);

  if (middle.length < 2) return null;

  const from_ref = middle[0];

  let to_ref;
  if (middle.length === 2) {
    to_ref = middle[1];
  } else {
    // Join everything after the first token into the to_ref, e.g. ["2","Pet.1.1"] -> "2 Pet.1.1"
    to_ref = middle.slice(1).join(' ');
  }

  // Basic sanity checks
  if (!from_ref.includes('.')) return null; // should look like Book.Ch.V
  if (!to_ref.includes('.')) return null;

  return { from_ref, to_ref, votes };
}

async function upsertBatch(rows) {
  if (rows.length === 0) return;

  // Upsert on unique index (from_ref, to_ref).
  // If row already exists, we overwrite votes (latest file wins).
  const { error } = await supabase
    .from('openbible_crossrefs_raw')
    .upsert(
      rows.map(r => ({
        from_ref: r.from_ref,
        to_ref: r.to_ref,
        votes: r.votes,
        source_file: FILE_NAME
      })),
      { onConflict: 'from_ref,to_ref' }
    );

  if (error) throw error;
}

async function main() {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`File not found: ${FILE_PATH}`);
  }

  console.log(`Reading: ${FILE_PATH}`);
  const raw = fs.readFileSync(FILE_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  let parsed = 0;
  let skipped = 0;
  let batch = [];
  let batches = 0;

  for (let i = 0; i < lines.length; i++) {
    const obj = parseLine(lines[i]);
    if (!obj) {
      skipped++;
      continue;
    }

    parsed++;
    batch.push(obj);

    if (batch.length >= BATCH_SIZE) {
      batches++;
      console.log(`Upserting batch ${batches} (rows=${batch.length})...`);
      await upsertBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    batches++;
    console.log(`Upserting batch ${batches} (rows=${batch.length})...`);
    await upsertBatch(batch);
  }

  console.log('DONE.');
  console.log(`Lines: ${lines.length}`);
  console.log(`Parsed rows: ${parsed}`);
  console.log(`Skipped lines: ${skipped}`);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

