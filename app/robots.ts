import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo";

/** Use `/organizer/` (trailing slash) so public `/organizers/*` stays allowlisted. */
const DISALLOW_WHEN_PUBLIC = [
  "/admin",
  "/api/",
  "/auth/",
  "/debug/",
  "/login",
  "/logout-preview",
  "/preview",
  "/profile",
  "/plan",
  "/organizer/",
  "/reset-password",
  "/signup",
  "/out",
] as const;

export default function robots(): MetadataRoute.Robots {
  if (process.env.FESTIVO_PUBLIC_MODE === "coming-soon") {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  const base = getBaseUrl().replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOW_WHEN_PUBLIC],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
