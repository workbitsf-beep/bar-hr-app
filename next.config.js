// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  output: "standalone",
  cacheMaxMemorySize: 16 * 1024 * 1024,
  // Timbrature, the PDF report and the consultant's attendance became one
  // page, Presenze (30 Oct 2026). Old links, notifications included, land there.
  async redirects() {
    return [
      { source: "/dashboard/timelogs", destination: "/dashboard/presenze", permanent: false },
      { source: "/dashboard/export", destination: "/dashboard/presenze", permanent: false },
      { source: "/dashboard/consulente/revisione", destination: "/dashboard/presenze", permanent: false },
      { source: "/dashboard/consulente/:path*", destination: "/dashboard/presenze/:path*", permanent: false },
    ];
  },
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
