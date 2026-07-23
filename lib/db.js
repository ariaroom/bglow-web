import { createClient } from '@supabase/supabase-js';

// Server-side only. The service role key bypasses RLS, so this module must
// never be imported into anything that ships to the browser.
let client;

export function db() {
    if (client) return client;

    const url = process.env.SUPABASE_URL;

    // Supabase renamed its keys: `service_role` (JWT) -> Secret key (sb_secret_…).
    // Accept either env var name so both old and new projects work.
    const key =
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            'Missing SUPABASE_URL or SUPABASE_SECRET_KEY (a.k.a. SUPABASE_SERVICE_ROLE_KEY)'
        );
    }

    // The publishable/anon key is subject to RLS and cannot write holds. Catching
    // it here turns a baffling "row-level security" failure into a clear message.
    if (key.startsWith('sb_publishable_')) {
        throw new Error(
            'SUPABASE_SECRET_KEY holds a publishable key. Use the Secret key ' +
            '(sb_secret_…) — it is server-only and must never reach the browser.'
        );
    }

    client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    return client;
}
