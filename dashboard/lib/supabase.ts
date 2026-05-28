/**
 * Supabase-klient-fabrik för dashboarden.
 *
 * Dashboarden kör som Next.js Node-runtime på Vercel. SUPABASE_URL och
 * SUPABASE_SERVICE_ROLE_KEY läses från env. service_role-nyckeln
 * bypassar RLS — den ska ALDRIG exponeras till klienten (browser).
 * För det skapas en separat anon/publishable-nyckel om vi behöver
 * client-side reads (gör vi inte i Fas 1).
 *
 * Vi vill inte skapa klienten vid module-load eftersom det skulle göra
 * `import`-tider känsliga för env-state (t.ex. i tester eller under
 * `next build` utan env). Därför lazy via factory.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error('SUPABASE_URL saknas i env.');
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas i env.');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return cached;
}

/** För tester: tvinga ny klient nästa anrop. */
export function __resetSupabaseClient(): void {
  cached = null;
}
