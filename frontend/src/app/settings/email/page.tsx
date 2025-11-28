'use client';

import React, { useEffect, useState } from 'react';

export default function EmailSettings() {
    const [billingEmail, setBillingEmail] = useState('');
    const [productEmail, setProductEmail] = useState(true);
    const [marketingEmail, setMarketingEmail] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        try {
            const ls = typeof window !== 'undefined' ? window.localStorage : null;
            if (!ls) return;
            setBillingEmail(ls.getItem('email_billing') || '');
            setProductEmail(ls.getItem('email_product') !== 'false');
            setMarketingEmail(ls.getItem('email_marketing') === 'true');
        } catch { }
    }, []);

    const save = () => {
        try {
            localStorage.setItem('email_billing', billingEmail);
            localStorage.setItem('email_product', String(productEmail));
            localStorage.setItem('email_marketing', String(marketingEmail));
            setMsg('Saved');
            setTimeout(() => setMsg(null), 1500);
        } catch {
            setMsg('Failed to save');
        }
    };

    const sendTest = async () => {
        setMsg(`Test email sent to ${billingEmail || 'your billing email'}`);
        setTimeout(() => setMsg(null), 1500);
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Email</h1>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-neutral-600 mb-1">Billing contact email</label>
                    <input value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="finance@sentryax.com" />
                </div>
                <div className="flex items-end gap-3">
                    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={productEmail} onChange={(e) => setProductEmail(e.target.checked)} /> Product updates</label>
                    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={marketingEmail} onChange={(e) => setMarketingEmail(e.target.checked)} /> Marketing</label>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={save} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900">Save</button>
                <button onClick={sendTest} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50">Send test</button>
                {msg && <span className="text-sm text-neutral-600">{msg}</span>}
            </div>
        </div>
    );
}
