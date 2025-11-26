import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'export', // Static export for Capacitor compatibility
    transpilePackages: ['@couch-heroes/shared'],
    images: {
        unoptimized: true,
    },
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
};

export default nextConfig;
