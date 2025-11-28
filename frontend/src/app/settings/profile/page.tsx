'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '../../../../context/AuthProvider';
import { supabase as importedSupabase } from '../../../../lib/supabaseClient';

const supabase: any = importedSupabase as any;

function initialsFromEmail(email?: string | null) {
    if (!email) return 'U';
    const name = email.split('@')[0];
    const parts = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ');
    const first = (parts[0] || 'U')[0] || 'U';
    const second = (parts[1] || '')[0] || '';
    return (first + second).toUpperCase();
}

export default function ProfileSettings() {
    const { user, session } = useAuthContext();
    const [fullName, setFullName] = useState('');
    const [company, setCompany] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [location, setLocation] = useState('');
    const [website, setWebsite] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarName, setAvatarName] = useState('');
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const ls = typeof window !== 'undefined' ? window.localStorage : null;
            if (!ls) return;
            setFullName(ls.getItem('profile_full_name') || '');
            setCompany(ls.getItem('profile_company') || '');
            setUsername(ls.getItem('profile_username') || '');
            setPhone(ls.getItem('profile_phone') || '');
            setJobTitle(ls.getItem('profile_job_title') || '');
            setLocation(ls.getItem('profile_location') || '');
            setWebsite(ls.getItem('profile_website') || '');
            setLinkedin(ls.getItem('profile_linkedin') || '');
            setBio(ls.getItem('profile_bio') || '');
            setAvatarUrl(ls.getItem('profile_avatar') || '');
            setAvatarName(ls.getItem('profile_avatar_name') || '');
        } catch { }
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!session) return;
            setLoading(true);
            try {
                let userId = user?.id as string | undefined;
                if (!userId) {
                    try { userId = (await supabase.auth.getUser()).data?.user?.id; } catch { }
                }
                if (!userId) { setLoading(false); return; }
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, username, company, phone, job_title, location, website, linkedin, bio, avatar_url')
                    .eq('id', userId)
                    .maybeSingle();
                if (error) {
                    setLoading(false);
                    return;
                }
                if (!data) {
                    // No row yet: don't auto-create to avoid 401 when session is not hydrated.
                    // Keep fields empty; creation will happen on explicit Save.
                    setLoading(false);
                    return;
                }
                setFullName(data.full_name || '');
                setUsername(data.username || '');
                setCompany(data.company || '');
                setPhone(data.phone || '');
                setJobTitle(data.job_title || '');
                setLocation(data.location || '');
                setWebsite(data.website || '');
                setLinkedin(data.linkedin || '');
                setBio(data.bio || '');
                setAvatarUrl(data.avatar_url || '');
                try {
                    localStorage.setItem('profile_full_name', data.full_name || '');
                    localStorage.setItem('profile_company', data.company || '');
                    localStorage.setItem('profile_username', data.username || '');
                    localStorage.setItem('profile_phone', data.phone || '');
                    localStorage.setItem('profile_job_title', data.job_title || '');
                    localStorage.setItem('profile_location', data.location || '');
                    localStorage.setItem('profile_website', data.website || '');
                    localStorage.setItem('profile_linkedin', data.linkedin || '');
                    localStorage.setItem('profile_bio', data.bio || '');
                    localStorage.setItem('profile_avatar', data.avatar_url || '');
                } catch { }
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, session?.access_token]);

    const onPickAvatar = () => fileRef.current?.click();

    const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            setAvatarUrl(dataUrl);
            setAvatarName(f.name);
            try {
                localStorage.setItem('profile_avatar', dataUrl);
                localStorage.setItem('profile_avatar_name', f.name);
            } catch { }
        };
        reader.readAsDataURL(f);
    };

    const removeAvatar = () => {
        setAvatarUrl('');
        setAvatarName('');
        try {
            localStorage.removeItem('profile_avatar');
            localStorage.removeItem('profile_avatar_name');
        } catch { }
    };

    const save = async () => {
        const ts = new Date().toISOString();
        // Log point de départ
        console.groupCollapsed(`[PROFILE_SAVE] ${ts} - Start`);
        console.log('[PROFILE_SAVE] user', {
            hasUser: !!user,
            id: user?.id,
            email: user?.email,
        });
        console.log('[PROFILE_SAVE] session', {
            hasSession: !!session,
            accessTokenPrefix: (session as any)?.access_token?.slice(0, 16) || null,
            accessTokenLength: (session as any)?.access_token?.length || 0,
        });
        try {
            if (!user || !session) {
                console.warn('[PROFILE_SAVE] Missing user or session');
                setMsg("Vous n'êtes pas connecté. Veuillez vous reconnecter puis réessayer.");
                return;
            }
            setLoading(true);
            setMsg(null);

            const row = {
                id: user.id,
                full_name: fullName || null,
                username: username || null,
                company: company || null,
                phone: phone || null,
                job_title: jobTitle || null,
                location: location || null,
                website: website || null,
                linkedin: linkedin || null,
                bio: bio || null,
                avatar_url: avatarUrl || null,
            };

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
            const token = (session as any)?.access_token as string | undefined;

            console.log('[PROFILE_SAVE] env/config', {
                supabaseUrl,
                hasAnonKey: !!anonKey,
                anonKeyPrefix: anonKey ? anonKey.slice(0, 16) : null,
                tokenPrefix: token ? token.slice(0, 16) : null,
                tokenLength: token?.length || 0,
            });

            if (!supabaseUrl || !anonKey || !token) {
                console.error('[PROFILE_SAVE] Invalid config or session', {
                    supabaseUrl,
                    hasAnonKey: !!anonKey,
                    hasToken: !!token,
                });
                setMsg("Session ou configuration Supabase invalide. Réessaie après reconnexion.");
                return;
            }

            const url = `${supabaseUrl}/rest/v1/profiles?on_conflict=id&apikey=${encodeURIComponent(anonKey)}`;
            const body = JSON.stringify(row);

            console.log('[PROFILE_SAVE] request', {
                method: 'POST',
                url,
                headers: {
                    apikeyPrefix: anonKey.slice(0, 16),
                    authorizationPrefix: `Bearer ${token.slice(0, 16)}...`,
                    contentType: 'application/json',
                    prefer: 'resolution=merge-duplicates,return=representation',
                },
                bodyLength: body.length,
                bodyPreview: body.slice(0, 256),
            });

            let resp: Response;
            try {
                resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'apikey': anonKey,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=representation'
                    },
                    body,
                });
            } catch (networkError: any) {
                console.error('[PROFILE_SAVE] Network error during fetch', {
                    name: networkError?.name,
                    message: networkError?.message,
                    stack: networkError?.stack,
                });
                setMsg(networkError?.message || 'Erreur réseau pendant la sauvegarde.');
                return;
            }

            console.log('[PROFILE_SAVE] response meta', {
                ok: resp.ok,
                status: resp.status,
                statusText: resp.statusText,
                type: resp.type,
                redirected: resp.redirected,
                url: resp.url,
            });

            const text = await resp.text();
            console.log('[PROFILE_SAVE] response body raw', text);

            if (!resp.ok) {
                if (resp.status === 401) {
                    console.warn('[PROFILE_SAVE] 401 Unauthorized');
                    setMsg('Session expirée. Recharge la page ou reconnecte‑toi, puis réessaie.');
                    return;
                }
                const lower = text.toLowerCase();
                if (lower.includes('duplicate key') || lower.includes('duplicate')) {
                    console.warn('[PROFILE_SAVE] Duplicate username');
                    setMsg('Username déjà pris.');
                    return;
                }
                if (lower.includes('row-level security')) {
                    console.warn('[PROFILE_SAVE] RLS blocked');
                    setMsg("Accès refusé par la politique de sécurité. Vérifie que tu es bien connecté et que l'ID correspond à auth.uid().");
                    return;
                }
                console.error('[PROFILE_SAVE] Non-OK response, throwing', {
                    status: resp.status,
                    body: text,
                });
                throw new Error(text || 'Failed to save profile');
            }

            console.log('[PROFILE_SAVE] Success, updating localStorage');
            // Écriture locale après succès uniquement (cohérence UI)
            try {
                localStorage.setItem('profile_full_name', fullName);
                localStorage.setItem('profile_company', company);
                localStorage.setItem('profile_username', username);
                localStorage.setItem('profile_phone', phone);
                localStorage.setItem('profile_job_title', jobTitle);
                localStorage.setItem('profile_location', location);
                localStorage.setItem('profile_website', website);
                localStorage.setItem('profile_linkedin', linkedin);
                localStorage.setItem('profile_bio', bio);
            } catch (lsError) {
                console.warn('[PROFILE_SAVE] localStorage error (non bloquant)', lsError);
            }
            try {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('profile:updated', { detail: { avatar_url: avatarUrl } }));
                }
            } catch {}
            setMsg('Saved');
        } catch (e: any) {
            console.error('[PROFILE_SAVE] Caught error in outer try/catch', {
                name: e?.name,
                message: e?.message,
                stack: e?.stack,
            });
            setMsg(e?.message || 'Error');
        } finally {
            console.groupEnd();
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">My details</h1>
            </header>

            <section className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden grid place-content-center text-neutral-700">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-sm font-medium">{initialsFromEmail(user?.email)}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onPickAvatar} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50">Upload new</button>
                        {avatarUrl && (
                            <button onClick={removeAvatar} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50">Remove</button>
                        )}
                        {avatarName && <span className="text-sm text-neutral-600 truncate max-w-[12rem]">{avatarName}</span>}
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Full name</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="John Smith" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Email</label>
                    <input readOnly value={user?.email || ''} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Username</label>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="john" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Phone</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="+33 6 12 34 56 78" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Job title</label>
                    <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Operations Manager" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Location</label>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Paris, FR" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Website</label>
                    <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="https://example.com" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">LinkedIn</label>
                    <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="https://linkedin.com/in/username" />
                </div>
                
                <div className="sm:col-span-2">
                    <label className="block text-xs text-neutral-600 mb-1">Bio</label>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Short bio" />
                </div>
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Company</label>
                    <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Sentryax" />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={loading || !user || !session} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900 disabled:opacity-60">Save Changes</button>
                {(!session && user) && <span className="text-sm text-neutral-500">Connexion en cours…</span>}
                {msg && <span className="text-sm text-neutral-600">{msg}</span>}
            </div>
        </div>
    );
}
