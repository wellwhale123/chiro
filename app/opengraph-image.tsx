import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CHIRO | Club for Human Intelligent Robot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
          position: "relative",
        }}
      >
        {/* 은은한 원형 포인트 */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: 420,
            background: "rgba(147, 197, 253, 0.25)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -100,
            width: 380,
            height: 380,
            borderRadius: 380,
            background: "rgba(96, 165, 250, 0.18)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 160,
            fontWeight: 900,
            letterSpacing: -4,
            color: "#FFFFFF",
          }}
        >
          CHI
          <span style={{ color: "#93C5FD" }}>RO</span>
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 6,
            color: "#BFDBFE",
            textTransform: "uppercase",
          }}
        >
          Club for Human Intelligent Robot
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          중앙대학교 로봇동아리
        </div>
      </div>
    ),
    { ...size }
  );
}
