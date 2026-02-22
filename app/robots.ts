import { MetadataRoute } from "next";

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

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: "https://festivo.bg/sitemap.xml",
  };
}
