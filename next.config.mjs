/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native / heavy modules must stay outside the bundler.
  serverExternalPackages: ['better-sqlite3', 'sharp', 'puppeteer'],
  experimental: {
    serverActions: {
      // Photo uploads go through a route handler, but keep headroom.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
