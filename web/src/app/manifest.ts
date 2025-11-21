import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "C++ Reference Viewer",
    short_name: "C++ Ref",
    description: "A modern offline viewer for C++ reference documentation with full-text search and interactive navigation",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00599C",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
