'use client';

import React from 'react';
import localFont from 'next/font/local';

const neueHaasRoman = localFont({
    src: '../../../public/fonts/NeueHaasDisplayRoman.ttf',
    display: 'swap',
});

const FOOTER_COLUMNS = [
    {
        title: 'Subtitle',
        links: ['Link', 'Link', 'Link']
    },
    {
        title: 'Subtitle',
        links: ['Link', 'Link', 'Link']
    },
    {
        title: 'Subtitle',
        links: ['Link', 'Link', 'Link']
    },
    {
        title: 'Subtitle',
        links: ['Link', 'Link', 'Link'],
        hideOnMobile: true
    }
];

export default function CTAFooterSection() {
    return (
        <section className="w-full bg-white px-5 sm:px-8 lg:px-16 xl:px-24 py-20 sm:py-24 lg:py-32">
            <div className="max-w-7xl mx-auto">
                {/* Header with CTA */}
                <div className="text-center mb-16 sm:mb-20 lg:mb-24">
                    <h2 className="text-[2rem] sm:text-[2.5rem] lg:text-[3.2rem] font-light leading-tight text-black tracking-tight mb-6 sm:mb-8 lg:mb-10">
                        <span className="block">Protect the invisible</span>
                        <span className="block">Before the <span className="text-gray-400">Catastrophe</span></span>
                    </h2>

                    <a
                        href="http://localhost:3000/auth/trial"
                        style={{ fontFamily: neueHaasRoman.style.fontFamily }}
                        className="inline-flex items-center justify-center rounded-lg bg-black px-8 py-3 sm:px-10 sm:py-4 text-sm sm:text-base font-medium text-white shadow-lg shadow-black/30 transition-colors duration-300 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 whitespace-nowrap mt-6 sm:mt-8 lg:mt-10"
                    >
                        Get Started Free
                    </a>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-200 mb-12 sm:mb-16 lg:mb-20" />

                {/* Footer Links Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
                    {FOOTER_COLUMNS.map((column, idx) => (
                        <div key={idx} className={column.hideOnMobile ? 'hidden lg:block' : ''}>
                            <h4 className="text-sm font-medium text-gray-900 mb-4 sm:mb-5">
                                {column.title}
                            </h4>
                            <ul className="space-y-2 sm:space-y-3">
                                {column.links.map((link, linkIdx) => (
                                    <li key={linkIdx}>
                                        <a href="#" className="text-sm text-gray-600 hover:text-black transition-colors duration-200">
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
