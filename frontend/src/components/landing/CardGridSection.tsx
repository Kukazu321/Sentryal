'use client';

import React from 'react';
import Image from 'next/image';
import localFont from 'next/font/local';

const neueHaasLight = localFont({
    src: '../../../public/fonts/NeueHaasDisplayLight.ttf',
    display: 'swap',
});

const CARDS = [
    { image: '/media/herosection.jpeg', title: 'Real-time monitoring', description: 'Track deformations instantly' },
    { image: '/media/herosection.jpeg', title: 'Identify issues early', description: 'Identify dangerous shifts at millimeter-scale' },
    { image: '/media/herosection.jpeg', title: 'Grow fast, stay safe', description: 'Expand coverage while maintaining security' }
];

export default function CardGridSection() {
    return (
        <section style={{ backgroundColor: '#F7F7F7', fontFamily: neueHaasLight.style.fontFamily }} className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-28">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12 sm:mb-16 lg:mb-20">
                    <h2 className="text-[1.8rem] sm:text-[2.2rem] lg:text-[2.8rem] font-light leading-tight text-black tracking-tight mb-4 sm:mb-6">
                        <span className="block">Command the Ground.</span>
                        <span className="block">Control the Future.</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
                    {CARDS.map((card, idx) => (
                        <div key={idx} className="relative group overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 h-80 sm:h-96 lg:h-[28rem]">
                            <Image src={card.image} alt={card.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" quality={90} />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/35 transition-all duration-300" />
                            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 lg:p-8">
                                <h3 className="text-2xl sm:text-3xl lg:text-[1.75rem] font-light text-white mb-2 sm:mb-3">{card.title}</h3>
                                <p className="text-sm sm:text-base lg:text-[0.95rem] text-white/90 leading-relaxed font-light">{card.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
