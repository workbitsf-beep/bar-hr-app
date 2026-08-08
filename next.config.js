// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  output: "standalone",
  cacheMaxMemorySize: 16 * 1024 * 1024,
  async headers() {
    return [
      {
        source: "/:asset(next|vercel|globe|file|window).svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
