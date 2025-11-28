'use client';

import React, { useEffect, useMemo, useState } from 'react';

export default function PlanSettings() {
    const [selected, setSelected] = useState<'Starter' | 'Pro' | 'Enterprise'>('Starter');
    const [extraSeats, setExtraSeats] = useState(0);
    const [extraStorage, setExtraStorage] = useState(0); // in GB
    const [prioritySupport, setPrioritySupport] = useState(false);
    const [sla, setSla] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        try {
            const ls = typeof window !== 'undefined' ? window.localStorage : null;
            if (!ls) return;
            setSelected((ls.getItem('plan_selected') as any) || 'Starter');
            setExtraSeats(parseInt(ls.getItem('plan_addon_seats') || '0', 10));
            setExtraStorage(parseInt(ls.getItem('plan_addon_storage') || '0', 10));
            setPrioritySupport(ls.getItem('plan_addon_priority') === 'true');
            setSla(ls.getItem('plan_addon_sla') === 'true');
        } catch { }
    }, []);

    const basePrice = useMemo(() => {
        switch (selected) {
            case 'Starter': return 0;
            case 'Pro': return 199;
            case 'Enterprise': return NaN; // custom
        }
    }, [selected]);

    const totals = useMemo(() => {
        const seatPrice = 10; // $10 per extra seat
        const storagePrice = 0.25; // $0.25 per GB
        const priorityPrice = 49; // $49
        const slaPrice = 99; // $99
        const addons = (extraSeats * seatPrice) + (extraStorage * storagePrice) + (prioritySupport ? priorityPrice : 0) + (sla ? slaPrice : 0);
        const total = isNaN(basePrice) ? NaN : basePrice + addons;
        return { addons, total };
    }, [basePrice, extraSeats, extraStorage, prioritySupport, sla]);

    const save = () => {
        try {
            localStorage.setItem('plan_selected', selected);
            localStorage.setItem('plan_addon_seats', String(extraSeats));
            localStorage.setItem('plan_addon_storage', String(extraStorage));
            localStorage.setItem('plan_addon_priority', String(prioritySupport));
            localStorage.setItem('plan_addon_sla', String(sla));
            setMsg('Saved');
            setTimeout(() => setMsg(null), 1500);
        } catch {
            setMsg('Failed to save');
        }
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Plan</h1>
                <p className="text-sm text-neutral-600">Choose the plan that suits your usage.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map(p => (
                    <button key={p.name} onClick={() => setSelected(p.name as any)} className={`text-left rounded-xl border ${selected === p.name ? 'border-black' : 'border-neutral-200'} bg-white p-5 hover:border-neutral-900 transition`}>
                        <div className="flex items-baseline justify-between">
                            <h3 className="text-lg font-semibold text-neutral-900">{p.name}</h3>
                            <div className="text-neutral-900 font-semibold">{p.price}</div>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">{p.description}</p>
                        <ul className="mt-3 space-y-1 text-sm text-neutral-700 list-disc pl-5">
                            {p.features.map((f, i) => (<li key={i}>{f}</li>))}
                        </ul>
                    </button>
                ))}
            </div>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-neutral-900">Add-ons</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="block text-xs text-neutral-600 mb-1">Additional seats</label>
                            <input type="number" min={0} value={extraSeats} onChange={(e) => setExtraSeats(Math.max(0, parseInt(e.target.value || '0', 10)))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                            <div className="text-xs text-neutral-600 mt-1">$10 / seat</div>
                        </div>
                        <div>
                            <label className="block text-xs text-neutral-600 mb-1">Extra storage (GB)</label>
                            <input type="number" min={0} value={extraStorage} onChange={(e) => setExtraStorage(Math.max(0, parseInt(e.target.value || '0', 10)))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                            <div className="text-xs text-neutral-600 mt-1">$0.25 / GB</div>
                        </div>
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>Priority support</span>
                            <input type="checkbox" checked={prioritySupport} onChange={(e) => setPrioritySupport(e.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>SLA</span>
                            <input type="checkbox" checked={sla} onChange={(e) => setSla(e.target.checked)} />
                        </label>
                    </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-900">Summary</h3>
                    <div className="text-sm text-neutral-700">Plan: <span className="font-medium text-neutral-900">{selected}</span></div>
                    <div className="text-sm text-neutral-700">Base price: <span className="font-medium text-neutral-900">{isNaN(basePrice) ? 'Custom' : `$${basePrice}/mo`}</span></div>
                    <div className="text-sm text-neutral-700">Add-ons: <span className="font-medium text-neutral-900">${totals.addons.toFixed(2)}/mo</span></div>
                    <div className="pt-2 border-t border-neutral-200 text-lg font-semibold text-neutral-900">Total: {isNaN(totals.total) ? 'Contact sales' : `$${totals.total.toFixed(2)}/mo`}</div>
                    <div className="pt-2">
                        <button onClick={save} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900" disabled={selected === 'Enterprise'}>
                            {selected === 'Enterprise' ? 'Contact sales' : `Continue with ${selected}`}
                        </button>
                        {msg && <span className="ml-3 text-sm text-neutral-600">{msg}</span>}
                    </div>
                </div>
            </section>
        </div>
    );
}

const plans = [
    { name: 'Starter', price: '$0', description: 'Evaluate the platform', features: ['Up to 2 infrastructures', '5k points', 'Email support'] },
    { name: 'Pro', price: '$199/mo', description: 'For growing teams', features: ['50 infrastructures', '250k points', 'Priority support'] },
    { name: 'Enterprise', price: 'Custom', description: 'For large deployments', features: ['Unlimited', 'SLA', 'Dedicated support'] },
];
