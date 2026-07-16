import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildmates.yashns.chatgpt.site";
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/product", "/privacy", "/install", "/discover", "/map", "/graph", "/cohorts", "/builders/", "/projects/", "/@"],
      disallow: ["/api/", "/home", "/onboarding", "/matches", "/connections", "/rooms/", "/circles/", "/settings/", "/inbox", "/operator/", "/invite", "/i/"],
    }],
    sitemap: `${base}/sitemap.xml`,
  };
}
