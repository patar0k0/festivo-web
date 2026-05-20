import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Festivo — Фестивалите на България на едно място";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#0c0e14",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative gradient blob (top-left) */}
        <div
          style={{
            position: "absolute",
            top: "-180px",
            left: "-160px",
            width: "640px",
            height: "640px",
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(217,119,6,0.45) 0%, rgba(217,119,6,0) 70%)",
          }}
        />

        {/* Decorative gradient blob (bottom-right) */}
        <div
          style={{
            position: "absolute",
            bottom: "-220px",
            right: "-180px",
            width: "720px",
            height: "720px",
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(124,45,18,0.55) 0%, rgba(124,45,18,0) 70%)",
          }}
        />

        {/* Subtle grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Top brand row */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 60,
            right: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: "#d97706",
              }}
            />
            <div
              style={{
                color: "#fafafa",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Festivo
            </div>
            <div
              style={{
                color: "#71717a",
                fontSize: 22,
                fontWeight: 500,
              }}
            >
              · festivo.bg
            </div>
          </div>

          <div
            style={{
              color: "#a1a1aa",
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            Каталог на фестивалите в България
          </div>
        </div>

        {/* Center content */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "0 60px",
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              width: 72,
              height: 5,
              background: "#d97706",
              borderRadius: 3,
              marginBottom: 28,
            }}
          />

          <div
            style={{
              color: "#ffffff",
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div>Открий. Планирай.</div>
            <div style={{ color: "#fbbf24" }}>Посети.</div>
          </div>

          <div
            style={{
              color: "#d4d4d8",
              fontSize: 30,
              fontWeight: 500,
              marginTop: 28,
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Фестивалите на България на едно място — фолклорни, винени, музикални и още.
          </div>
        </div>

        {/* Bottom row with feature chips */}
        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 60,
            right: 60,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {[
            { icon: "🔍", label: "Търси по град и дата" },
            { icon: "📅", label: "Запази в плана си" },
            { icon: "🔔", label: "Получи напомняне" },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 20px",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e4e4e7",
                fontSize: 20,
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 22 }}>{chip.icon}</span>
              <span>{chip.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
