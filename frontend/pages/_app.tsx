import React from 'react';
import '../src/app/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/AuthProvider';
import localFont from 'next/font/local';

const neue = localFont({
  src: '../public/fonts/NeueHaasDisplayLight.ttf',
  variable: '--font-neue',
  display: 'swap', // on conserve swap ; on masque l'affichage jusqu'à ce que la font soit chargée
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      {/* la className fournie par next/font applique la font-family via CSS généré */}
      <div className={neue.className}>
        <Component {...pageProps} />
      </div>
    </AuthProvider>
  );
}