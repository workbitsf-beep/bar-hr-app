import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "") || "https://workbit.it";
  const lastModified = new Date();

  return [
    { url: `${baseUrl}/login`, lastModified },
    { url: `${baseUrl}/privacy`, lastModified },
    { url: `${baseUrl}/terms`, lastModified },
    { url: `${baseUrl}/support`, lastModified },
    { url: `${baseUrl}/account-deletion`, lastModified },
  ];
}
