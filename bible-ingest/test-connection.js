import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function main() {
  const { data, error } = await supabase
    .from('scripture_books')
    .select('book_code', { count: 'exact', head: true });

  if (error) {
    console.error('Supabase query error:', error);
    process.exit(1);
  }

  console.log('Connection OK. scripture_books row count =', data?.length ?? '(head query)');
  // For head:true queries, Supabase returns no rows; the count is in response headers internally.
  console.log('If no error printed above, credentials and connectivity are good.');
}

main().catch((e) => {
  console.error('Unexpected failure:', e);
  process.exit(1);
});

