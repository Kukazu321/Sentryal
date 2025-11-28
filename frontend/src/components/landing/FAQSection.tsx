'use client';

import React from 'react';
import localFont from 'next/font/local';
import { motion } from 'framer-motion';

const neueHaasRoman = localFont({
    src: '../../../public/fonts/NeueHaasDisplayRoman.ttf',
    display: 'swap',
});

const FAQ_ITEMS = [
    {
        question: 'Is Meridian secure?',
        answer: 'Absolutely. We use bank-level encryption and industry-standard security protocols to ensure your data and transactions are protected at all times.'
    },
    {
        question: 'Who is Meridian for?',
        answer: 'Meridian is designed for businesses and organizations that need reliable, scalable solutions for their operations and growth.'
    },
    {
        question: 'Do you charge any hidden fees?',
        answer: 'No. We believe in transparent pricing. All costs are clearly outlined upfront with no surprise charges.'
    },
    {
        question: 'How long does it take to set up?',
        answer: 'Setup typically takes less than 5 minutes. Our intuitive interface and guided onboarding make it quick and easy to get started.'
    },
    {
        question: 'Can I connect my existing bank accounts?',
        answer: 'Yes. We support seamless integration with most major banking institutions through secure API connections.'
    }
];

function FAQAccordion() {
    const [openIndex, setOpenIndex] = React.useState(0);

    const fadeTransition = {
        duration: 0.3,
        ease: 'easeInOut' as const
    };

    return (
        <div className="space-y-0">
            {FAQ_ITEMS.map((item, index) => (
                <div key={index}>
                    <button
                        onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                        className="w-full flex items-center justify-between py-6 sm:py-7 lg:py-8 text-left transition-all duration-300 ease-out hover:opacity-70"
                    >
                        <h3 className="text-lg sm:text-xl lg:text-[1.25rem] font-medium text-black pr-4 flex-1">
                            {item.question}
                        </h3>
                        <motion.div
                            className="flex-shrink-0 text-3xl font-medium text-black"
                            animate={{ rotate: openIndex === index ? 45 : 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            {openIndex === index ? '×' : '+'}
                        </motion.div>
                    </button>
                    <div className="h-px bg-gray-200" />
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                            opacity: openIndex === index ? 1 : 0,
                            height: openIndex === index ? 'auto' : 0
                        }}
                        transition={fadeTransition}
                        className="overflow-hidden"
                    >
                        <div className="py-5 sm:py-6 lg:py-7">
                            <p className="text-base sm:text-lg lg:text-[1.05rem] text-gray-600 leading-relaxed font-light">
                                {item.answer}
                            </p>
                        </div>
                    </motion.div>
                </div>
            ))}
        </div>
    );
}

export default function FAQSection() {
    return (
        <section className="w-full bg-white px-5 sm:px-8 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-28">
            <div className="max-w-7xl mx-auto">
                {/* FAQ Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
                    {/* Left: Title and Button */}
                    <div className="lg:col-span-1 w-full">
                        <h2 className="text-[1.8rem] sm:text-[2.2rem] lg:text-[3rem] font-light leading-[1.1] text-black tracking-tight mb-8 line-clamp-2 w-full">
                            Questions all resolved in one place
                        </h2>
                        <a
                            href="http://localhost:3000/auth/trial"
                            style={{ fontFamily: neueHaasRoman.style.fontFamily }}
                            className="inline-flex items-center justify-center rounded-lg bg-black px-8 py-3 sm:px-10 sm:py-4 text-sm sm:text-base font-medium text-white shadow-lg shadow-black/30 transition-colors duration-300 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 whitespace-nowrap"
                        >
                            Get Started Free
                        </a>
                    </div>

                    {/* Right: FAQ Accordion */}
                    <div className="lg:col-span-1">
                        <FAQAccordion />
                    </div>
                </div>
            </div>
        </section>
    );
}