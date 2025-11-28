"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function OnboardingModal({ open, onClose }: Props) {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    useEffect(() => {
        if (!open) setStep(1);
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-neutral-200">
                <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between">
                    <div className="text-lg font-semibold text-neutral-900">Welcome to Sentryal</div>
                    <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">Skip</button>
                </div>

                {step === 1 && (
                    <div className="px-6 py-6 space-y-4">
                        <div className="text-neutral-900 text-xl font-bold">Set up in minutes</div>
                        <div className="text-neutral-600 text-sm">You just created your account. Let’s configure only what’s essential to start monitoring.</div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold">Continue</button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="px-6 py-6 space-y-4">
                        <div className="text-neutral-900 text-xl font-bold">Add your first infrastructure</div>
                        <div className="text-neutral-600 text-sm">Choose how you want to define the area to monitor.</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <Link href="/onboarding?mode=draw" onClick={onClose} className="block rounded-xl border border-neutral-200 hover:border-neutral-900 p-4 transition-colors">
                                <div className="text-neutral-900 font-semibold">Draw on map</div>
                                <div className="text-neutral-500 text-sm mt-1">Create a polygon directly on satellite view.</div>
                            </Link>
                            <Link href="/onboarding?mode=shp" onClick={onClose} className="block rounded-xl border border-neutral-200 hover:border-neutral-900 p-4 transition-colors">
                                <div className="text-neutral-900 font-semibold">Upload shapefile</div>
                                <div className="text-neutral-500 text-sm mt-1">Import a .shp or .zip with your area.</div>
                            </Link>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                            <button onClick={() => setStep(1)} className="text-sm px-3 py-2 rounded-lg border border-neutral-200">Back</button>
                            <button onClick={() => setStep(3)} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold">Continue</button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="px-6 py-6 space-y-4">
                        <div className="text-neutral-900 text-xl font-bold">You are all set</div>
                        <div className="text-neutral-600 text-sm">Create your first infrastructure now. You can always access onboarding later from the dashboard.</div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Link href="/onboarding?mode=draw" onClick={onClose} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold">Create infrastructure</Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
