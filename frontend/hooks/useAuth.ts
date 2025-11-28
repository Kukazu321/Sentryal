import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase as importedSupabase } from '../lib/supabaseClient';
const supabase: any = importedSupabase as any;

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const sanitizeSession = (sess: Session | null) => {
            if (!sess) return null;
            const token = (sess as any).access_token as string | undefined;
            const maxReasonableLength = 5000; // safeguard: normal Supabase JWT << this
            if (token && token.length > maxReasonableLength) {
                console.error('Supabase session access_token is unreasonably large, treating as corrupted and resetting session', {
                    length: token.length,
                    prefix: token.slice(0, 32),
                });
                return null;
            }
            return sess;
        };

        const init = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                console.log('getSession result:', data, error);
                if (!mounted) return;
                const safeSession = sanitizeSession(data?.session ?? null);
                if (safeSession) {
                    setSession(safeSession);
                    setUser(safeSession.user as any);
                } else {
                    setSession(null);
                    setUser(null);
                }
            } catch (err) {
                console.error('Session init error:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        init();

        const { data: listener } = supabase.auth.onAuthStateChange((_event: any, sess: Session | null) => {
            console.log('Auth state changed:', _event, sess);
            if (!mounted) return;
            const safeSession = sanitizeSession(sess);
            setSession(safeSession ?? null);
            setUser(safeSession?.user ?? null);
        });

        return () => {
            mounted = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (listener as any)?.subscription?.unsubscribe?.();
        };
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo }
        });
        return error;
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error;
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    }, []);

    return { user, session, loading, signUp, signIn, signOut };
}
