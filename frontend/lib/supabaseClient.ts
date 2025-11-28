import { createClient, SupabaseClient } from '@supabase/supabase-js';
import createFakeSupabase from './fakeSupabase';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Use fake auth if explicitly set OR if Supabase env vars are missing
const useFake = process.env.NEXT_PUBLIC_USE_FAKE_AUTH === 'true' || !url || !anonKey;

let client: unknown;
let supabase: SupabaseClient | unknown;

// Safe auth storage: use in-memory on SSR, sessionStorage in browser, swallow quota errors.
const safeStorage = (() => {
    if (typeof window === 'undefined') {
        // SSR-safe shim (no real persistence server-side)
        const mem = new Map<string, string>();
        return {
            getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
            setItem: (k: string, v: string) => { mem.set(k, v); },
            removeItem: (k: string) => { mem.delete(k); },
        } as Storage;
    }
    let session: Storage | null = null;
    try {
        session = window.sessionStorage;
    } catch {
        session = null;
    }
    return {
        getItem: (key: string) => {
            try { return session?.getItem(key) ?? null; } catch { return null; }
        },
        setItem: (key: string, value: string) => {
            try { session?.setItem(key, value); } catch { /* ignore quota / disabled storage */ }
        },
        removeItem: (key: string) => {
            try { session?.removeItem(key); } catch { /* ignore */ }
        },
    } as Storage;
})();

if (useFake) {
    client = createFakeSupabase();
    supabase = client as unknown;
    if (typeof window !== 'undefined') {
        console.log('Using fake Supabase client (no env vars or NEXT_PUBLIC_USE_FAKE_AUTH=true)');
    }
} else {
    client = createClient(url!, anonKey!, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: safeStorage,
        },
    });
    supabase = client as SupabaseClient;
}

// Expose supabase globally in development for console access
if (typeof window !== 'undefined') {
    // Always expose in browser for easy access
    // Make sure to expose the actual client object, not just the reference
    (window as any).supabase = supabase;
    (window as any).supabaseClient = client;

    // Debug: log what we're exposing
    console.log('Supabase exposed to window:', {
        hasSupabase: !!(window as any).supabase,
        hasAuth: !!(window as any).supabase?.auth,
        isFake: useFake
    });
}

export { supabase };
export default client as unknown;
