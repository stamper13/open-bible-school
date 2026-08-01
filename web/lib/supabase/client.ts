import { createClient } from '@supabase/supabase-js'

// Next.js inlines NEXT_PUBLIC_* at build time, so these must be read as static
// property accesses — a dynamic lookup would not be substituted.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Fail fast and by name. Without these the app cannot talk to Supabase at all,
// and the alternative is an opaque "Failed to fetch" on the first query.
// Only the variable names are reported — never their values.
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    supabaseUrl ? null : 'NEXT_PUBLIC_SUPABASE_URL',
    supabaseAnonKey ? null : 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter((name): name is string => name !== null)

  throw new Error(
    `Supabase is not configured. Missing ${missing.join(' and ')}. ` +
      'Set these in web/.env.local for local development, or in the Vercel ' +
      'project environment variables for a deployment. ' +
      'SUPABASE_SERVICE_ROLE_KEY is server-only and must never be exposed as a NEXT_PUBLIC_* variable.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
