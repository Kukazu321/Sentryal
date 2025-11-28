'use client';

import React, { useEffect, useMemo, useState } from 'react';

export default function NotificationsSettings() {
    const [email, setEmail] = useState(true);
    const [sms, setSms] = useState(false);
    const [slack, setSlack] = useState(false);
    const [frequency, setFrequency] = useState<'immediate' | 'daily' | 'weekly'>('immediate');
    const [quietStart, setQuietStart] = useState('22:00');
    const [quietEnd, setQuietEnd] = useState('07:00');
    const [weekendsOnly, setWeekendsOnly] = useState(false);
    const [sevCritical, setSevCritical] = useState(true);
    const [sevHigh, setSevHigh] = useState(true);
    const [sevMedium, setSevMedium] = useState(false);
    const [sevLow, setSevLow] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        try {
            const ls = typeof window !== 'undefined' ? window.localStorage : null;
            if (!ls) return;
            setEmail(ls.getItem('notif_email') !== 'false');
            setSms(ls.getItem('notif_sms') === 'true');
            setSlack(ls.getItem('notif_slack') === 'true');
            setFrequency((ls.getItem('notif_frequency') as any) || 'immediate');
            setQuietStart(ls.getItem('notif_quiet_start') || '22:00');
            setQuietEnd(ls.getItem('notif_quiet_end') || '07:00');
            setWeekendsOnly(ls.getItem('notif_quiet_weekends') === 'true');
            setSevCritical(ls.getItem('notif_sev_critical') !== 'false');
            setSevHigh(ls.getItem('notif_sev_high') !== 'false');
            setSevMedium(ls.getItem('notif_sev_medium') === 'true');
            setSevLow(ls.getItem('notif_sev_low') === 'true');
        } catch { }
    }, []);

    const save = () => {
        try {
            localStorage.setItem('notif_email', String(email));
            localStorage.setItem('notif_sms', String(sms));
            localStorage.setItem('notif_slack', String(slack));
            localStorage.setItem('notif_frequency', String(frequency));
            localStorage.setItem('notif_quiet_start', quietStart);
            localStorage.setItem('notif_quiet_end', quietEnd);
            localStorage.setItem('notif_quiet_weekends', String(weekendsOnly));
            localStorage.setItem('notif_sev_critical', String(sevCritical));
            localStorage.setItem('notif_sev_high', String(sevHigh));
            localStorage.setItem('notif_sev_medium', String(sevMedium));
            localStorage.setItem('notif_sev_low', String(sevLow));
            setMsg('Saved');
            setTimeout(() => setMsg(null), 1500);
        } catch {
            setMsg('Failed to save');
        }
    };

    const sendTest = () => {
        setMsg('Test notification sent');
        setTimeout(() => setMsg(null), 1200);
    };

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Notifications</h1>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                    <span>Email notifications</span>
                    <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                    <span>SMS notifications</span>
                    <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                    <span>Slack notifications</span>
                    <input type="checkbox" checked={slack} onChange={(e) => setSlack(e.target.checked)} />
                </label>
                <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Frequency</label>
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                        <option value="immediate">Immediate</option>
                        <option value="daily">Daily Digest</option>
                        <option value="weekly">Weekly Digest</option>
                    </select>
                </div>
            </div>

            <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
                <h3 className="text-sm font-semibold text-neutral-900">Quiet hours</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                    <div>
                        <label className="block text-xs text-neutral-600 mb-1">Start</label>
                        <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-neutral-600 mb-1">End</label>
                        <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-sm mt-6 sm:mt-0">
                        <input type="checkbox" checked={weekendsOnly} onChange={(e) => setWeekendsOnly(e.target.checked)} /> Apply only on weekends
                    </label>
                </div>
                <p className="text-xs text-neutral-600">Critical alerts ignore quiet hours.</p>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-semibold text-neutral-900">Severity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                        <span>Critical</span>
                        <input type="checkbox" checked={sevCritical} onChange={(e) => setSevCritical(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                        <span>High</span>
                        <input type="checkbox" checked={sevHigh} onChange={(e) => setSevHigh(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                        <span>Medium</span>
                        <input type="checkbox" checked={sevMedium} onChange={(e) => setSevMedium(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                        <span>Low</span>
                        <input type="checkbox" checked={sevLow} onChange={(e) => setSevLow(e.target.checked)} />
                    </label>
                </div>
            </section>

            <div className="flex items-center gap-3">
                <button onClick={save} className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-900">Save Notifications</button>
                <button onClick={sendTest} className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50">Send test</button>
                {msg && <span className="text-sm text-neutral-600">{msg}</span>}
            </div>
        </div>
    );
}
