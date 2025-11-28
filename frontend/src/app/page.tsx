'use client';

import React from 'react';
import localFont from 'next/font/local';
import HeroSection from '@/components/landing/HeroSection';
import GroundStabilitySection from '@/components/landing/GroundStabilitySection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ImageSection from '@/components/landing/ImageSection';
import SavingsSimulatorSection from '@/components/landing/SavingsSimulatorSection';
import CardGridSection from '@/components/landing/CardGridSection';
import FAQSection from '@/components/landing/FAQSection';
import CTAFooterSection from '@/components/landing/CTAFooterSection';

const neueHaasLight = localFont({
    src: '../../public/fonts/NeueHaasDisplayLight.ttf',
    display: 'swap',
});

const rangeInputStyles = `
    input[type='range']::-webkit-slider-thumb {
        appearance: none; width: 32px; height: 32px; border-radius: 50%;
        background: white; border: 4px solid black; cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    input[type='range']::-moz-range-thumb {
        width: 32px; height: 32px; border-radius: 50%;
        background: white; border: 4px solid black; cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    input[type='range']::-moz-range-track {
        background: transparent; border: none;
    }
`;

export default function HomePage() {
    return (
        <main className={`${neueHaasLight.className} overflow-x-hidden`}>
            <style dangerouslySetInnerHTML={{ __html: rangeInputStyles }} />
            <HeroSection />
            <GroundStabilitySection />
            <FeaturesSection />
            <ImageSection />
            <SavingsSimulatorSection />
            <CardGridSection />
            <FAQSection />
            <CTAFooterSection />
        </main>
    );
}
