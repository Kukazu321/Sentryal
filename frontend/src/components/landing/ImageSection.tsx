'use client';

import React from 'react';
import Image from 'next/image';

export default function ImageSection() {
    return (
        <section className="w-full bg-white px-5 sm:px-8 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-28" style={{ backgroundColor: '#F7F7F7' }}>
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12 sm:mb-16 lg:mb-20">
                    <h2 className="text-[1.8rem] sm:text-[2.2rem] lg:text-[2.8rem] font-light leading-tight text-black tracking-tight mb-4 sm:mb-6">
                        Artificial Intelligence Meets the Earth
                    </h2>
                    <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-[1.05rem] text-gray-600 leading-relaxed">
                        Machine learning and geospatial analytics working together to understand the planet's smallest movements, and their most significant consequences.
                    </p>
                </div>
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-lg">
                    <Image
                        src="/media/herosection.jpeg"
                        alt="AI meets earth"
                        fill
                        sizes="100vw"
                        className="object-cover"
                        quality={90}
                    />
                </div>
            </div>
        </section>
    );
}
