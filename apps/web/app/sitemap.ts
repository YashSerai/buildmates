import type { MetadataRoute } from "next";
import { getPlatformBindings } from "@/src/platform/bindings";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildmates.yashns.chatgpt.site";
  const staticEntries: MetadataRoute.Sitemap = ["", "/product", "/privacy", "/terms", "/support", "/install", "/map", "/graph"].map((path) => ({ url: `${base}${path}`, changeFrequency: path === "" ? "weekly" : "daily" }));
  try {
    const { DB } = await getPlatformBindings();
    const [profiles, projects] = await Promise.all([
      DB.prepare("SELECT handle.handle,profile.updated_at AS updatedAt FROM profiles profile JOIN handles handle ON handle.user_id=profile.user_id WHERE profile.published_at IS NOT NULL AND profile.audience='public' AND profile.indexable=1 ORDER BY profile.updated_at DESC LIMIT 5000").all<{ handle: string; updatedAt: number }>(),
      DB.prepare("SELECT slug,updated_at AS updatedAt FROM projects WHERE status='active' AND audience='public' AND indexable=1 ORDER BY updated_at DESC LIMIT 5000").all<{ slug: string; updatedAt: number }>(),
    ]);
    return [...staticEntries,
      ...profiles.results.map((row) => ({ url: `${base}/@${encodeURIComponent(row.handle)}`, lastModified: new Date(row.updatedAt), changeFrequency: "weekly" as const })),
      ...projects.results.map((row) => ({ url: `${base}/projects/${encodeURIComponent(row.slug)}`, lastModified: new Date(row.updatedAt), changeFrequency: "weekly" as const })),
    ];
  } catch { return staticEntries; }
}
