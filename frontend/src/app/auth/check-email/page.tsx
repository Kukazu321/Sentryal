'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase as imported } from '../../../../lib/supabaseClient';

const supabase: any = imported as any;

export default function CheckEmail() {
    const router = useRouter();
    const params = useSearchParams();
    const emailParam = params?.get('email') || '';
    const [email, setEmail] = useState(emailParam);
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!email) {
            try { setEmail(localStorage.getItem('lastSignupEmail') || ''); } catch { }
        }
    }, [email]);

    const resend = async () => {
        if (!email) return;
        setStatus('sending');
        setError(null);
        try {
            const redirectTo = `${window.location.origin}/auth/callback`;
            const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
            if (error) throw error;
            setStatus('sent');
        } catch (e: any) {
            setError(e?.message || 'Failed to resend email');
            setStatus('error');
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 520, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Verify your email</h1>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: '20px' }}>
                    We sent a confirmation link to <strong style={{ color: '#111827' }}>{email || 'your email'}</strong>. Open it to finish creating your account.
                </p>
                {error && (
                    <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
                )}
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button onClick={resend} disabled={status === 'sending'} style={{ background: '#000', color: 'white', padding: '10px 12px', borderRadius: 8, fontWeight: 600 }}>
                        {status === 'sending' ? 'Resending…' : status === 'sent' ? 'Sent ✓' : 'Resend email'}
                    </button>
                    <button onClick={() => router.push('/auth/login')} style={{ border: '1px solid #e5e7eb', padding: '10px 12px', borderRadius: 8 }}>Back to login</button>
                </div>
                <div style={{ marginTop: 16, color: '#6b7280', fontSize: 12 }}>
                    Tip: the link expires quickly. If it expires, click Resend.
                </div>
            </div>
        </div>
    );
}
