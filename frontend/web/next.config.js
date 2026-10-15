//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Product imagery is served from the CDN / object store, not the app bundle.
    // Admin-managed content (home page banners and section tiles) adds hosts the
    // storefront has no control over - marketing pastes whatever CDN URL they are
    // given - so that one pattern is deliberately open rather than enumerated.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
