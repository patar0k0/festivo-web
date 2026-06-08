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
          background: "linear-gradient(135deg, #fffdf9 0%, #fff7ed 55%, #fef3e2 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Soft warm glow (top-left) */}
        <div
          style={{
            position: "absolute",
            top: "-220px",
            left: "-200px",
            width: "660px",
            height: "660px",
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(251,191,36,0.28) 0%, rgba(251,191,36,0) 70%)",
          }}
        />

        {/* Soft warm glow (bottom-right) */}
        <div
          style={{
            position: "absolute",
            bottom: "-260px",
            right: "-200px",
            width: "760px",
            height: "760px",
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(217,119,6,0.18) 0%, rgba(217,119,6,0) 70%)",
          }}
        />

        {/* Top brand row */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 64,
            right: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div
              style={{
                width: 15,
                height: 15,
                borderRadius: 5,
                background: "#d97706",
              }}
            />
            <div
              style={{
                color: "#18181b",
                fontSize: 29,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Festivo
            </div>
            <div
              style={{
                color: "#a1a1aa",
                fontSize: 22,
                fontWeight: 500,
              }}
            >
              · festivo.bg
            </div>
          </div>

          <div
            style={{
              color: "#a16207",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.01em",
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
            padding: "0 64px",
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              width: 76,
              height: 6,
              background: "linear-gradient(90deg, #d97706 0%, #f59e0b 100%)",
              borderRadius: 3,
              marginBottom: 30,
            }}
          />

          <div
            style={{
              color: "#1c1917",
              fontSize: 86,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              maxWidth: 1040,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div>Открий. Планирай.</div>
            <div style={{ color: "#d97706" }}>Посети.</div>
          </div>

          <div
            style={{
              color: "#57534e",
              fontSize: 31,
              fontWeight: 500,
              marginTop: 30,
              lineHeight: 1.4,
              maxWidth: 940,
            }}
          >
            Всички фестивали в България на едно място — открий по град, дата и интерес.
          </div>
        </div>

        {/* Bottom row with feature chips */}
        <div
          style={{
            position: "absolute",
            bottom: 58,
            left: 64,
            right: 64,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {["Търси по град и дата", "Запази в плана си", "Получи напомняне"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "13px 22px",
                borderRadius: 9999,
                background: "#ffffff",
                border: "1px solid rgba(217,119,6,0.22)",
                boxShadow: "0 1px 3px rgba(120,53,15,0.06)",
                color: "#44403c",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 9999,
                  background: "#d97706",
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
