import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "") || "https://workbit.it";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/privacy", "/terms", "/support", "/account-deletion"],
      disallow: ["/api/", "/dashboard/", "/billing/", "/onboarding/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
