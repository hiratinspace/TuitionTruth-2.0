import type { MetadataRoute } from "next";
import { env } from "@/env";

/**
 * Sitemap for the stable public routes. Per-institution URLs are the freemium
 * SEO long tail; enumerating ~6,000 of them belongs in a dedicated, paginated
 * sitemap index generated from the institutions table at request time — tracked
 * as a follow-up so this file stays buildable without a live database.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL;
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/search`, changeFrequency: "weekly", priority: 0.8 },
  ];
}
