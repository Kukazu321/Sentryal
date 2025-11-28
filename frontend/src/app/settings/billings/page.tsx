'use client';

import React, { useEffect, useMemo, useState } from 'react';

export default function BillingsPage() {
    const [nameOnCard, setNameOnCard] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cvv, setCvv] = useState('');
    const [contactMode, setContactMode] = useState<'existing' | 'other'>('existing');
    const [otherEmail, setOtherEmail] = useState('');
    const [billingName, setBillingName] = useState('');
    const [billingCompany, setBillingCompany] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [stateRegion, setStateRegion] = useState('');
    const [zip, setZip] = useState('');
    const [country, setCountry] = useState('');
    const [vat, setVat] = useState('');
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    useEffect(() => {
        try {
            const ls = typeof window !== 'undefined' ? window.localStorage : null;
            if (!ls) return;
            setBillingName(ls.getItem('billing_name') || '');
            setBillingCompany(ls.getItem('billing_company') || '');
            setAddress1(ls.getItem('billing_address1') || '');
            setAddress2(ls.getItem('billing_address2') || '');
            setCity(ls.getItem('billing_city') || '');
            setStateRegion(ls.getItem('billing_state') || '');
            setZip(ls.getItem('billing_zip') || '');
            setCountry(ls.getItem('billing_country') || '');
            setVat(ls.getItem('billing_vat') || '');
            setNameOnCard(ls.getItem('billing_card_name') || '');
            setExpiry(ls.getItem('billing_card_expiry') || '');
            setCardNumber(ls.getItem('billing_card_number') || '');
            setCvv(ls.getItem('billing_card_cvv') || '');
            setContactMode((ls.getItem('billing_contact_mode') as any) || 'existing');
            setOtherEmail(ls.getItem('billing_contact_other') || '');
        } catch { }
    }, []);

    const contactEmail = useMemo(() => {
        if (typeof window === 'undefined') return 'me@sentryax.com';
        const existing = localStorage.getItem('contact_email') || 'me@sentryax.com';
        return contactMode === 'existing' ? existing : otherEmail || existing;
    }, [contactMode, otherEmail]);

    const saveBilling = () => {
        try {
            localStorage.setItem('billing_name', billingName);
            localStorage.setItem('billing_company', billingCompany);
            localStorage.setItem('billing_address1', address1);
            localStorage.setItem('billing_address2', address2);
            localStorage.setItem('billing_city', city);
            localStorage.setItem('billing_state', stateRegion);
            localStorage.setItem('billing_zip', zip);
            localStorage.setItem('billing_country', country);
            localStorage.setItem('billing_vat', vat);
            localStorage.setItem('billing_card_name', nameOnCard);
            localStorage.setItem('billing_card_expiry', expiry);
            localStorage.setItem('billing_card_number', cardNumber);
            localStorage.setItem('billing_card_cvv', cvv);
            localStorage.setItem('billing_contact_mode', contactMode);
            localStorage.setItem('billing_contact_other', otherEmail);
            setSavedMsg('Saved');
            setTimeout(() => setSavedMsg(null), 2000);
        } catch {
            setSavedMsg('Failed to save');
        }
    };

    const downloadInvoice = (row: any) => {
        const content = `Invoice: ${row.invoice}\nDate: ${row.date}\nAmount: ${row.amount}\nStatus: ${row.status}\nTracking: ${row.tracking}\nAddress: ${row.address}\nBilled to: ${billingName} (${billingCompany})\nVAT: ${vat}\nEmail: ${contactEmail}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${row.invoice}_${row.date.replace(/\s+/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Billings</h1>
                <p className="text-sm text-neutral-600">Update your billing details and address.</p>
            </header>

            <section className="space-y-6">
                <div>
                    <h2 className="text-sm font-semibold text-neutral-800 mb-2">Payment Method</h2>
                    <p className="text-sm text-neutral-600">Update your billing details and address.</p>
                </div>

                <div className="grid gap-6">
                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Card Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">Name on your Card</label>
                                <input value={nameOnCard} onChange={(e) => setNameOnCard(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="John Smith" />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">Expiry</label>
                                <input value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="02 / 2028" />
                            </div>
                            <div className="sm:col-span-1">
                                <label className="block text-xs text-neutral-600 mb-1">Card Number</label>
                                <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="8269 9620 9292 2538" />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">CVV</label>
                                <input value={cvv} onChange={(e) => setCvv(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="•••" />
                            </div>
                        </div>
                        <button className="mt-4 text-sm font-medium text-neutral-800 inline-flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-300">+</span>
                            Add another card
                        </button>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Contact email</h3>
                        <p className="text-sm text-neutral-600 mb-3">Where should invoices be sent?</p>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="radio" checked={contactMode === 'existing'} onChange={() => setContactMode('existing')} />
                                <span>Send to the existing email</span>
                                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{contactEmail}</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="radio" checked={contactMode === 'other'} onChange={() => setContactMode('other')} />
                                <span>Add another email address</span>
                            </label>
                            {contactMode === 'other' && (
                                <input value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="finance@sentryax.com" />
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Billing address</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">Full name</label>
                                <input value={billingName} onChange={(e) => setBillingName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="John Smith" />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">Company</label>
                                <input value={billingCompany} onChange={(e) => setBillingCompany(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Sentryax" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-neutral-600 mb-1">Address line 1</label>
                                <input value={address1} onChange={(e) => setAddress1(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="123 Rue de Paris" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-neutral-600 mb-1">Address line 2</label>
                                <input value={address2} onChange={(e) => setAddress2(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Building, floor, etc." />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">City</label>
                                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Paris" />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">State / Region</label>
                                <input value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Île-de-France" />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">ZIP / Postal code</label>
                                <input value={zip} onChange={(e) => setZip(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="75001" />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-600 mb-1">Country</label>
                                <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="France" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs text-neutral-600 mb-1">VAT / Tax ID</label>
                                <input value={vat} onChange={(e) => setVat(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="FR12345678901" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <button onClick={saveBilling} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900">Save billing details</button>
                            {savedMsg && <span className="text-sm text-neutral-600">{savedMsg}</span>}
                        </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Billing History</h3>
                        <div className="overflow-hidden rounded-lg border border-neutral-200">
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-50 text-neutral-600">
                                    <tr>
                                        <th className="text-left px-4 py-2 font-medium">Invoice</th>
                                        <th className="text-left px-4 py-2 font-medium">Date</th>
                                        <th className="text-left px-4 py-2 font-medium">Amount</th>
                                        <th className="text-left px-4 py-2 font-medium">Status</th>
                                        <th className="text-left px-4 py-2 font-medium">Tracking & Address</th>
                                        <th className="text-left px-4 py-2 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-t border-neutral-200">
                                            <td className="px-4 py-2">{r.invoice}</td>
                                            <td className="px-4 py-2 text-neutral-600">{r.date}</td>
                                            <td className="px-4 py-2">{r.amount}</td>
                                            <td className="px-4 py-2">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(r.status)}`}>{r.status}</span>
                                            </td>
                                            <td className="px-4 py-2 text-neutral-700"><a className="underline" href="#">{r.tracking}</a><div className="text-xs text-neutral-500">{r.address}</div></td>
                                            <td className="px-4 py-2"><button onClick={() => downloadInvoice(r)} className="px-3 py-1.5 rounded-md border border-neutral-200 text-xs hover:bg-neutral-50">Download</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

const rows = [
    { id: 1, invoice: 'Account Sale', date: 'Apr 14, 2004', amount: '$3,050', status: 'Pending', tracking: 'LMS80450575CN', address: '333 Main Road, Sunderland' },
    { id: 2, invoice: 'Account Sale', date: 'Jun 24, 2008', amount: '$1,050', status: 'Cancelled', tracking: 'AZ358943053US', address: '96 Orange Road, Peterborough' },
    { id: 3, invoice: 'Netflix Subscription', date: 'Feb 28, 2004', amount: '$800', status: 'Refund', tracking: '3S336105604US', address: '2 New Street, Harrogate' },
];

function statusClass(s: string) {
    switch (s) {
        case 'Pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'Cancelled':
            return 'bg-red-100 text-red-700';
        case 'Refund':
            return 'bg-green-100 text-green-700';
        default:
            return 'bg-neutral-100 text-neutral-700';
    }
}
