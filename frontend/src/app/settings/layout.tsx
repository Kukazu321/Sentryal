import React from 'react';
import SettingsTabNav from './TabNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-[calc(100vh-80px)] bg-white">
            <SettingsTabNav />
            <div className="max-w-7xl mx-auto px-2 sm:px-8 py-6">
                {children}
            </div>
        </div>
    );
}
