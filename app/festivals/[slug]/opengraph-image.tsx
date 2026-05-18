import { ImageResponse } from "next/og";
import { getFestivalBySlug, normalizePublicFestivalSlugParam } from "@/lib/queries";
import { festivalLocationPrimary } from "@/lib/settlements/formatDisplayName";

export const runtime = "edge";
export const alt = "Festivo — Фестивал в България";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const festival = await getFestivalBySlug(slug);

  const title = festival?.title ?? "Festivo";
  const location = festival
    ? festivalLocationPrimary(festival, "България")
    : "България";

  const heroUrl = festival?.hero_image ?? festival?.image_url ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#f6f5f1",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background hero image if available */}
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.35,
            }}
          />
        ) : null}

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(12,14,20,0.92) 40%, rgba(12,14,20,0.4) 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "48px 60px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ color: "#d97706", fontSize: "22px", fontWeight: 600 }}>
            festivo.bg
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: title.length > 40 ? "44px" : "52px",
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: "900px",
            }}
          >
            {title}
          </div>
          <div style={{ color: "#d1d5db", fontSize: "26px", marginTop: "4px" }}>
            📍 {location}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
