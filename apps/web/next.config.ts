import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'export', // Static export for Capacitor compatibility
    transpilePackages: ['@couch-heroes/shared'],
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
};

export default nextConfig;
