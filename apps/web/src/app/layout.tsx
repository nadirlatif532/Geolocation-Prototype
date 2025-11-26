import type { Metadata } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

const orbitron = Orbitron({
    subsets: ['latin'],
    variable: '--font-orbitron',
});

export const metadata: Metadata = {
    title: 'Couch Heroes - Geolocation MMO',
    description: 'Hybrid web/mobile geolocation companion app for MMO adventures',
    manifest: '/manifest.json',
    themeColor: '#0a0a0a',
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} ${orbitron.variable} antialiased`}>
                {children}
            </body>
        </html>
    );
}
