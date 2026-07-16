import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Buildmates",
    short_name: "Buildmates",
    description: "Meet builders through what they are working on now.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#1d211e",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
