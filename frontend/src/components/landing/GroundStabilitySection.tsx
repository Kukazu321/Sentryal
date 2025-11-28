'use client';

import React from 'react';
import Image from 'next/image';

const CARDS = [
    {
        id: 'left',
        bgColor: '#E4E9F5',
        image: '/media/cardgauche.jpg',
        alt: 'Engineered infrastructure monitoring',
        text: 'Engineered to safeguard critical operations and infrastructure from millimeter-scale ground movements that could cause catastrophic damage.'
    },
    {
        id: 'right',
        bgColor: '#EEECEB',
        image: '/media/carddroite.jpg',
        alt: 'Spatial monitoring and terrain analysis',
        text: 'Continuous, millimeter-precise spatial monitoring that turns subtle ground movements into actionable foresight of critical changes.'
    }
];

export default function GroundStabilitySection() {
    return (
        <section className="w-full bg-white px-5 sm:px-8 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-28">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12 sm:mb-16 lg:mb-20">
                    <h2 className="text-[1.8rem] sm:text-[2.2rem] lg:text-[2.8rem] font-light leading-tight text-black tracking-tight mb-4 sm:mb-6">
                        <span className="block">Redefining how the world</span>
                        <span className="block">monitors ground stability.</span>
                    </h2>
                    <p className="mt-6 sm:mt-8 max-w-2xl mx-auto text-sm sm:text-base lg:text-[1.05rem] text-gray-600 leading-relaxed">
                        Setting a new standard for understanding and managing ground stability across critical infrastructure, providing insight into how subtle terrain changes affect safety and operations.
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
                    {CARDS.map((card) => (
                        <div
                            key={card.id}
                            className="flex flex-col rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
                            style={{ backgroundColor: card.bgColor }}
                        >
                            <div className="relative w-full aspect-[3/2] sm:aspect-video lg:aspect-[4/3]">
                                <Image
                                    src={card.image}
                                    alt={card.alt}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 45vw"
                                    className="object-cover"
                                    quality={90}
                                />
                            </div>
                            <div className="p-6 sm:p-8 lg:p-10 flex-1 flex items-center justify-center">
                                <p className="text-lg sm:text-xl lg:text-[1.5rem] text-gray-800 leading-relaxed font-light text-center">
                                    {card.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
