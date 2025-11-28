'use client';

import React, { useMemo, useRef, useState } from 'react';

type Role = 'Admin' | 'Editor' | 'Viewer';
type Member = { email: string; role: Role };

export default function TeamSettings() {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('Editor');
    const [bulk, setBulk] = useState('');
    const [filter, setFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState<'All' | Role>('All');
    const [team, setTeam] = useState<Member[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem('org_team') || '[]'); } catch { return []; }
    });
    const fileRef = useRef<HTMLInputElement>(null);

    const persist = (next: Member[]) => {
        setTeam(next);
        try { localStorage.setItem('org_team', JSON.stringify(next)); } catch { }
    };

    const invite = () => {
        if (!email) return;
        const next = [...team, { email: email.trim(), role }];
        persist(next);
        setEmail('');
    };

    const bulkInvite = () => {
        const tokens = bulk
            .split(/\n|,|;|\s+/)
            .map(t => t.trim())
            .filter(Boolean);
        if (tokens.length === 0) return;
        const set = new Set(team.map(m => m.email.toLowerCase()));
        const added: Member[] = [];
        for (const t of tokens) {
            if (!set.has(t.toLowerCase())) {
                added.push({ email: t, role: 'Viewer' });
                set.add(t.toLowerCase());
            }
        }
        if (added.length > 0) persist([...team, ...added]);
        setBulk('');
    };

    const importCSV = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
            const emails = rows.map(r => r.split(',')[0]?.trim()).filter(Boolean);
            const set = new Set(team.map(m => m.email.toLowerCase()));
            const added: Member[] = [];
            for (const e of emails) {
                if (!set.has(e.toLowerCase())) { added.push({ email: e, role: 'Viewer' }); set.add(e.toLowerCase()); }
            }
            if (added.length > 0) persist([...team, ...added]);
        };
        reader.readAsText(file);
    };

    const onPickCSV = () => fileRef.current?.click();
    const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const f = e.target.files?.[0];
        if (f) importCSV(f);
        e.currentTarget.value = '';
    };

    const updateRole = (i: number, r: Role) => {
        const next = team.slice(); next[i] = { ...next[i], role: r }; persist(next);
    };
    const remove = (i: number) => { const next = team.filter((_, idx) => idx !== i); persist(next); };

    const filtered = useMemo(() => {
        return team.filter(m => {
            const matchText = filter ? m.email.toLowerCase().includes(filter.toLowerCase()) : true;
            const matchRole = roleFilter === 'All' ? true : m.role === roleFilter;
            return matchText && matchRole;
        });
    }, [team, filter, roleFilter]);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Team</h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite member by email" className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                            <option>Admin</option><option>Editor</option><option>Viewer</option>
                        </select>
                        <button onClick={invite} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900">Invite</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        <label className="text-xs text-neutral-600">Bulk invite (comma, newline or CSV import)</label>
                        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} placeholder="alice@acme.com, bob@acme.com\ncharlie@acme.com" className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                        <div className="flex items-center gap-3">
                            <button onClick={bulkInvite} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50">Add</button>
                            <button onClick={onPickCSV} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50">Import CSV</button>
                            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                        <label className="block text-xs text-neutral-600 mb-1">Search</label>
                        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by email" className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-neutral-600 mb-1">Role</label>
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                            <option>All</option><option>Admin</option><option>Editor</option><option>Viewer</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="mt-3 rounded-xl border border-neutral-200 overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 text-xs text-neutral-600 bg-neutral-50">
                    <div className="col-span-6">Email</div>
                    <div className="col-span-4">Role</div>
                    <div className="col-span-2 text-right">Action</div>
                </div>
                {filtered.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 items-center px-4 py-2 border-t border-neutral-200 text-sm">
                        <div className="col-span-6 text-neutral-900">{m.email}</div>
                        <div className="col-span-4">
                            <select value={m.role} onChange={(e) => updateRole(team.indexOf(m), e.target.value as Role)} className="px-2 py-1 rounded-md border border-neutral-200 bg-white text-sm">
                                <option>Admin</option><option>Editor</option><option>Viewer</option>
                            </select>
                        </div>
                        <div className="col-span-2 text-right">
                            <button onClick={() => remove(team.indexOf(m))} className="px-3 py-1.5 rounded-md border border-neutral-200 text-sm hover:bg-neutral-50">Remove</button>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && <div className="px-4 py-6 text-sm text-neutral-500">No team members match your filters.</div>}
            </div>
        </div>
    );
}
