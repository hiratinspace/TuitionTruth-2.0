import type { MetadataRoute } from "next";
import { env } from "@/env";

/**
 * robots.txt. Public institution pages are the SEO acquisition surface, so
 * crawling is broadly allowed; the JSON API and any admin surface are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
