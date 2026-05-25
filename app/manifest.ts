import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Festivo — Фестивалите на България",
    short_name: "Festivo",
    description: "Открий, планирай и посети фестивалите на България на едно място.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#7c2d12",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/festivo-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
