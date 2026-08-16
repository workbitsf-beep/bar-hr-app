import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Workbit",
    short_name: "Workbit",
    description: "Gestione turni, timbrature, richieste e comunicazioni in Workbit.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f7f3ff",
    theme_color: "#f7f3ff",
    lang: "it-IT",
    categories: ["business", "productivity"],
    launch_handler: {
      client_mode: "navigate-existing",
    },
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Profilo",
        short_name: "Profilo",
        url: "/dashboard",
        icons: [{ src: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Turni",
        short_name: "Turni",
        url: "/dashboard/calendar",
        icons: [{ src: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
