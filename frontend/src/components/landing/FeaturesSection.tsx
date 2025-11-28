'use client';

import React, { useEffect } from 'react';
import NextImage from 'next/image'; // Renommé pour éviter le conflit avec le DOM Image
import { motion, AnimatePresence } from 'framer-motion';
import localFont from 'next/font/local';

const neueHaasRoman = localFont({
    src: '../../../public/fonts/NeueHaasDisplayRoman.ttf',
    display: 'swap',
});

const FEATURES = [
    { number: '01.', title: 'Ground Dynamics Visualization', description: 'Full control, instant issue, and real-time tracking – built for modern teams.', image: '/media/herosection.jpeg' },
    { number: '02.', title: 'Predictive Monitoring', description: 'Anticipate problems before they happen with AI-powered predictions.', image: '/media/cardgauche.jpg' },
    { number: '03.', title: 'Risk & Safety Management', description: 'Comprehensive risk assessment and safety protocols integrated.', image: '/media/carddroite.jpg' },
    { number: '04.', title: 'Data Integration', description: 'Seamlessly connect with your existing systems and workflows.', image: '/media/herosection.jpeg' }
];

export default function FeaturesSection() {
    const [activeIndex, setActiveIndex] = React.useState(0);

    // Preload all images to avoid any loading delay
    useEffect(() => {
        FEATURES.forEach((feature) => {
            const img = new window.Image(); // Utilise window.Image pour éviter le conflit avec l'import Next.js
            img.src = feature.image;
        });
    }, []);

    const handleFeatureClick = (idx: number) => {
        setActiveIndex(idx);
    };

    const fadeTransition = {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as const
    };

    return (
        <section className="w-full bg-white px-5 sm:px-8 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-28">
            <div className="max-w-7xl mx-auto">
                {/* Header with Title, Description and Button */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 sm:gap-8 mb-12 sm:mb-16 lg:mb-20">
                    <div className="flex-1">
                        <h2 className="text-[1.8rem] sm:text-[2.2rem] lg:text-[2.8rem] font-light leading-tight text-black tracking-tight mb-4 sm:mb-6">
                            Control your money in seconds.
                        </h2>
                        <p className="max-w-2xl text-sm sm:text-base lg:text-[1.05rem] text-gray-600 leading-relaxed">
                            Open accounts, transfer funds, and pay bills instantly – no branches, no waiting. Get more done daily with a beautifully simple interface.
                        </p>
                    </div>
                    <a
                        href="http://localhost:3000/auth/trial"
                        style={{ fontFamily: neueHaasRoman.style.fontFamily }}
                        className="flex-shrink-0 inline-flex items-center justify-center rounded-lg bg-black px-8 py-3 sm:px-10 sm:py-4 text-sm sm:text-base font-medium text-white shadow-lg shadow-black/30 transition-colors duration-300 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 whitespace-nowrap"
                    >
                        Get Started Free
                    </a>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-end"> {/* Changé items-center en items-end pour aligner en bas */}
                    {/* Left: Features List */}
                    <div className="space-y-0">
                        {FEATURES.map((feature, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleFeatureClick(idx)}
                                className="cursor-pointer py-6 sm:py-7 lg:py-8 border-b border-gray-200 last:border-b-0 transition-all duration-300 group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs sm:text-sm font-light text-gray-400">{feature.number}</span>
                                            <motion.h3
                                                className="text-lg sm:text-xl lg:text-[1.3rem] font-light"
                                                animate={{ color: activeIndex === idx ? '#000000' : '#6B7280' }}
                                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                            >
                                                {feature.title}
                                            </motion.h3>
                                        </div>
                                        <motion.p
                                            className="text-base sm:text-lg lg:text-[1.05rem] leading-relaxed font-light text-gray-600"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{
                                                opacity: activeIndex === idx ? 1 : 0,
                                                height: activeIndex === idx ? 'auto' : 0
                                            }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                        >
                                            {feature.description}
                                        </motion.p>
                                    </div>
                                    <motion.div
                                        className="flex-shrink-0 text-lg sm:text-xl"
                                        animate={{
                                            rotate: activeIndex === idx ? 90 : 0,
                                            color: activeIndex === idx ? '#000000' : '#D1D5DB'
                                        }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                    >
                                        →
                                    </motion.div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: Image */}
                    <div className="relative w-full aspect-square sm:aspect-auto lg:h-[650px] rounded-2xl overflow-hidden shadow-lg">
                        <AnimatePresence> {/* Pas de mode="wait" pour overlap et zéro blanc */}
                            <motion.div
                                key={activeIndex}
                                className="absolute inset-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={fadeTransition}
                            >
                                <NextImage // Utilise NextImage au lieu de Image
                                    src={FEATURES[activeIndex].image}
                                    alt="Features visualization"
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 45vw"
                                    className="object-cover"
                                    quality={90}
                                    loading="eager"
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    );
}