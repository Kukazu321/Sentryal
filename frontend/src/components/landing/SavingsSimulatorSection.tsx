'use client';

import React from 'react';
import localFont from 'next/font/local';

const neueHaasRoman = localFont({
    src: '../../../public/fonts/NeueHaasDisplayRoman.ttf',
    display: 'swap',
});

function SavingsSimulator() {
    const [years, setYears] = React.useState(1);
    const savingsData = [
        { label: 'Sentryal', value: 585 * years, color: 'bg-black' },
        { label: 'Drone Survey', value: 240 * years, color: 'bg-gray-400' },
        { label: 'Hovall', value: 225 * years, color: 'bg-gray-300' },
        { label: 'Manual Inspection', value: 150 * years, color: 'bg-gray-200' },
    ];
    const maxValue = Math.max(...savingsData.map(d => d.value));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-lg p-6 sm:p-7 lg:p-8">
                    <div className="mb-8">
                        <label className="block text-sm font-light text-gray-600 mb-2">Monitored asset value</label>
                        <p className="text-3xl sm:text-4xl lg:text-5xl font-light text-black">$10M</p>
                    </div>
                    <div>
                        <label className="block text-sm font-light text-gray-600 mb-6">Saved for <span className="font-medium text-black">{years} year{years > 1 ? 's' : ''}</span></label>
                        <div className="relative">
                            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full -translate-y-1/2" />
                            <div className="absolute top-1/2 h-1 bg-black rounded-full -translate-y-1/2 transition-all duration-300" style={{ width: `${((years - 1) / 4) * 100}%` }} />
                            <div className="absolute top-1/2 left-0 right-0 flex justify-between -translate-y-1/2 px-0">
                                {[1, 2, 3, 4, 5].map((dot) => (
                                    <div key={dot} className={`w-5 h-5 rounded-full transition-all duration-300 ${dot < years ? 'bg-black border-2 border-black' : dot === years ? 'bg-white border-2 border-black' : 'bg-gray-300 border-2 border-gray-300'}`} />
                                ))}
                            </div>
                            <input type="range" min="1" max="5" value={years} onChange={(e) => setYears(parseInt(e.target.value))} className="relative w-full h-12 bg-transparent rounded-full appearance-none cursor-pointer z-10" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-2">
                <div className="space-y-6 sm:space-y-8">
                    {savingsData.map((item, index) => (
                        <div key={index}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-light text-gray-600">{item.label}</span>
                                <span className="text-lg font-light text-black">${item.value}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div className={`${item.color} h-full transition-all duration-300`} style={{ width: `${(item.value / maxValue) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SavingsSimulatorSection() {
    return (
        <section className="w-full bg-white px-5 sm:px-8 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-28">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 sm:gap-8 mb-12 sm:mb-16 lg:mb-20">
                    <div className="flex-1">
                        <h2 className="text-[1.8rem] sm:text-[2.2rem] lg:text-[2.8rem] font-light leading-tight text-black tracking-tight mb-4 sm:mb-6">
                            Long-Term Savings by Monitoring Method
                        </h2>
                        <p className="max-w-2xl text-sm sm:text-base lg:text-[1.05rem] text-gray-600 leading-relaxed">
                            See how much risk and cost you could reduce with Sentryal compared to traditional monitoring solutions.
                        </p>
                    </div>
                </div>
                <SavingsSimulator />
            </div>
        </section>
    );
}
