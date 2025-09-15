import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LandSafe",
    short_name: "LandSafe",
    description: "Track and manage flights with progress, connections & more.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B1221",
    theme_color: "#0B1221",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
