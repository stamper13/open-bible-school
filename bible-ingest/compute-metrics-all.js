import 'dotenv/config';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function runNodeScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptName, ...args], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log('Fetching book codes from scripture_books…');

  const { data, error } = await supabase
    .from('scripture_books')
    .select('book_code, canon_order')
    .order('canon_order', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No rows in scripture_books.');

  const bookCodes = data.map(r => r.book_code);
  console.log(`Found ${bookCodes.length} books.`);
  console.log('Running compute-metrics.js for each book…');

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < bookCodes.length; i++) {
    const code = bookCodes[i];
    console.log(`\n[${i + 1}/${bookCodes.length}] compute-metrics.js ${code}`);
    try {
      await runNodeScript('compute-metrics.js', [code]);
      ok++;
    } catch (e) {
      console.error(`FAILED for ${code}:`, e.message);
      fail++;
      failures.push({ book_code: code, error: e.message });
      // continue
    }
  }

  console.log('\n===== SUMMARY =====');
  console.log('Successes:', ok);
  console.log('Failures:', fail);
  if (failures.length) {
    console.log('Failures detail:');
    for (const f of failures) console.log(`- ${f.book_code}: ${f.error}`);
    process.exitCode = 1;
  } else {
    console.log('All books processed successfully.');
  }
}

main().catch(err => {
  console.error('\nERROR:', err);
  process.exit(1);
});

