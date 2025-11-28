'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase as imported } from '../../../../lib/supabaseClient';

const supabase: any = imported as any;

function AuthCallbackInner() {
    const router = useRouter();
    const params = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handle = async () => {
            try {
                // Case 1: OTP/PKCE redirect (?code=...)
                const code = params?.get('code');
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    router.replace('/dashboard?onboarding=1');
                    return;
                }

                // Case 2: Hash fragment (#access_token=...)
                if (typeof window !== 'undefined' && window.location.hash) {
                    const hash = new URLSearchParams(window.location.hash.substring(1));
                    const err = hash.get('error');
                    if (err) {
                        const desc = hash.get('error_description') || err;
                        setError(desc.replace(/\+/g, ' '));
                        return;
                    }
                }

                // Fallback: if session exists, go dashboard
                const { data } = await supabase.auth.getSession();
                if (data?.session) {
                    router.replace('/dashboard?onboarding=1');
                } else {
                    // No session, go to login
                    router.replace('/auth/login');
                }
            } catch (e: any) {
                setError(e?.message || 'Authentication failed.');
            }
        };
        handle();
    }, [params, router]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 520, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Signing you in…</h1>
                {error ? (
                    <div>
                        <div style={{ color: '#b91c1c', fontSize: 14, marginBottom: 8 }}>{error}</div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>Your confirmation link may have expired. Go back and request a new email.</div>
                        <div style={{ marginTop: 12 }}>
                            <a href="/auth/check-email" style={{ textDecoration: 'underline' }}>Resend confirmation</a>
                        </div>
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: '#6b7280' }}>Please wait…</div>
                )}
            </div>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
            <AuthCallbackInner />
        </Suspense>
    );
}
