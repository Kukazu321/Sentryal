'use client';

import React, { useMemo, useState } from 'react';
import { useAuthContext } from '../../../../context/AuthProvider';
import { supabase as importedSupabase } from '../../../../lib/supabaseClient';

const supabase: any = importedSupabase as any;

function strength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 5);
}

function suggestions(pw: string) {
    const s: string[] = [];
    if (pw.length < 12) s.push('Use at least 12 characters');
    if (!/[A-Z]/.test(pw)) s.push('Add an uppercase letter');
    if (!/[a-z]/.test(pw)) s.push('Add a lowercase letter');
    if (!/[0-9]/.test(pw)) s.push('Add a number');
    if (!/[^A-Za-z0-9]/.test(pw)) s.push('Add a symbol');
    return s;
}

export default function PasswordSettings() {
    const { user } = useAuthContext();
    const [current, setCurrent] = useState('');
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [showCur, setShowCur] = useState(false);
    const [show1, setShow1] = useState(false);
    const [show2, setShow2] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sessionsMsg, setSessionsMsg] = useState<string | null>(null);

    const sValue = useMemo(() => strength(p1), [p1]);
    const sText = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][sValue] || 'Very weak';
    const sPct = Math.max(10, (sValue / 5) * 100);
    const sColor = sValue >= 4 ? 'bg-green-500' : sValue >= 3 ? 'bg-yellow-500' : 'bg-red-500';
    const tips = useMemo(() => suggestions(p1), [p1]);

    const update = async () => {
        if (!user) return setMsg("Vous n'êtes pas connecté. Reconnectez-vous puis réessayez.");
        if (!current) return setMsg('Enter your current password');
        if (p1.length < 12) return setMsg('Minimum 12 characters');
        if (!/[A-Z]/.test(p1) || !/[a-z]/.test(p1) || !/[0-9]/.test(p1) || !/[^A-Za-z0-9]/.test(p1)) return setMsg('Use upper, lower, number and symbol');
        if (p1 !== p2) return setMsg('Passwords do not match');
        if (current === p1) return setMsg('New password must be different');
        try {
            setLoading(true); setMsg(null);
            const email = user.email as string;
            const reauth = await supabase.auth.signInWithPassword({ email, password: current });
            if (reauth.error) { setMsg('Current password is incorrect'); return; }
            const { error } = await supabase.auth.updateUser({ password: p1 });
            if (error) throw error;
            setMsg('Password updated');
            setCurrent(''); setP1(''); setP2('');
        } catch (e: any) { setMsg(e?.message || 'Error'); } finally { setLoading(false); }
    };

    const signOutOtherSessions = async () => {
        setSessionsMsg('Other sessions cleared (demo)');
        setTimeout(() => setSessionsMsg(null), 3000);
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Password</h1>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Current password</label>
                    <div className="relative">
                        <input type={showCur ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm pr-20" />
                        <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-neutral-600 hover:text-neutral-900">{showCur ? 'Hide' : 'Show'}</button>
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">New password</label>
                    <div className="relative">
                        <input type={show1 ? 'text' : 'password'} value={p1} onChange={(e) => setP1(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm pr-20" />
                        <button type="button" onClick={() => setShow1(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-neutral-600 hover:text-neutral-900">{show1 ? 'Hide' : 'Show'}</button>
                    </div>
                    <div className="mt-2">
                        <div className="h-2 w-full bg-neutral-100 rounded">
                            <div className={`h-2 rounded ${sColor}`} style={{ width: `${sPct}%` }} />
                        </div>
                        <div className="text-xs text-neutral-600 mt-1">Strength: {sText}</div>
                        {tips.length > 0 && (
                            <ul className="mt-1 text-xs text-neutral-600 list-disc pl-5 space-y-0.5">
                                {tips.map((t, i) => (<li key={i}>{t}</li>))}
                            </ul>
                        )}
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Confirm password</label>
                    <div className="relative">
                        <input type={show2 ? 'text' : 'password'} value={p2} onChange={(e) => setP2(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm pr-20" />
                        <button type="button" onClick={() => setShow2(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-neutral-600 hover:text-neutral-900">{show2 ? 'Hide' : 'Show'}</button>
                    </div>
                    {p2 && p1 !== p2 && <div className="text-xs text-red-600 mt-1">Passwords do not match</div>}
                </div>
            </div>
            <div className="flex items-center justify-end">
                <button onClick={update} disabled={loading || !user} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900 disabled:opacity-60">Update Password</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="text-sm text-neutral-600">2FA and device management coming soon.</div>
                <div className="flex items-center gap-3">
                    <button onClick={signOutOtherSessions} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50">Sign out other sessions</button>
                    {sessionsMsg && <span className="text-sm text-neutral-600">{sessionsMsg}</span>}
                </div>
            </div>
            {msg && <div className="text-sm text-neutral-700">{msg}</div>}
        </div>
    );
}
