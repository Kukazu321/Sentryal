'use client';

import React from 'react';
import Image from 'next/image';
import localFont from 'next/font/local';

const neueHaasRoman = localFont({
    src: '../../../public/fonts/NeueHaasDisplayRoman.ttf',
    display: 'swap',
});

export default function HeroSection() {
    return (
        <section className="relative min-h-screen w-full overflow-hidden">
            {/* Background image */}
            <div className="absolute inset-0">
                <Image
                    src="/media/herosection.jpeg"
                    alt="Oil pipeline with spill on the ground"
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover"
                />
                {/* Subtle dark overlay for text readability (removed white wash) */}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Navbar - Positioned absolute at top of hero */}
            <nav
                className="absolute top-0 left-0 right-0 z-40 px-5 sm:px-8 lg:px-16 xl:px-24 py-4 sm:py-5"
                style={{ backgroundColor: 'transparent' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    {/* Left: Logo */}
                    <div style={{ position: 'relative', width: '320px', height: '80px', marginLeft: '-128px' }} className="sm:w-96 sm:h-24 sm:-ml-40 lg:w-[28rem] lg:h-28 lg:-ml-48">
                        <Image
                            src="/media/logosentryaxnobg.png"
                            alt="Sentryal Logo"
                            fill
                            sizes="(max-width: 640px) 320px, (max-width: 1024px) 384px, 448px"
                            className="object-contain"
                            priority
                        />
                    </div>

                    {/* Right: Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} className="sm:gap-6 lg:gap-8">
                        <a
                            href="/auth/login"
                            style={{
                                fontFamily: neueHaasRoman.style.fontFamily,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                border: '1px solid rgba(255,255,255,0.85)',
                                paddingLeft: '28px',
                                paddingRight: '28px',
                                paddingTop: '12px',
                                paddingBottom: '12px',
                                fontSize: '16px',
                                fontWeight: '500',
                                color: 'white',
                                boxShadow: '0 0 0 rgba(0,0,0,0)',
                                transition: 'background-color 300ms, color 300ms, border-color 300ms',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            Sign In
                        </a>
                        <a
                            href="http://localhost:3000/auth/trial"
                            style={{
                                fontFamily: neueHaasRoman.style.fontFamily,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '8px',
                                backgroundColor: 'white',
                                paddingLeft: '32px',
                                paddingRight: '32px',
                                paddingTop: '12px',
                                paddingBottom: '12px',
                                fontSize: '16px',
                                fontWeight: '500',
                                color: 'black',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                transition: 'background-color 300ms',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                            Get Started Free
                        </a>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <div className="relative z-10 flex min-h-screen items-center lg:items-end">
                <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 lg:pb-24">
                    <div className="max-w-xl sm:max-w-2xl text-left text-white">
                        {/* Heading */}
                        <h1 className="text-[2.4rem] leading-[1.05] sm:text-[3rem] lg:text-[3.8rem] font-light tracking-tight">
                            <span className="block">Bank today.</span>
                            <span className="block">Better tomorrow.</span>
                        </h1>

                        {/* Subheading */}
                        <p className="mt-6 max-w-md text-sm sm:text-[0.9rem] lg:text-base text-white/80 leading-relaxed">
                            Unlock the power of seamless transactions and smart financial management at your fingertips.
                        </p>

                        {/* CTA button */}
                        <div className="mt-8">
                            <a
                                href="http://localhost:3000/auth/trial"
                                style={{ fontFamily: neueHaasRoman.style.fontFamily }}
                                className="inline-flex items-center justify-center rounded-lg bg-white px-10 py-4 text-[1.05rem] font-medium text-black shadow-lg shadow-black/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white hover:bg-neutral-100"
                            >
                                Get Started Free
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
