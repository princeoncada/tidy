import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tidy",
    short_name: "Tidy",
    description:
      "A lightweight personal todo workspace for fast lists, tags, and focused task planning.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon-clean.png", sizes: "512x512", type: "image/png" }],
  };
}
