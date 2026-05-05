import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff5a1f 0%, #e03d00 100%)",
          borderRadius: 44,
          color: "white",
          fontSize: 72,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          letterSpacing: "-0.05em",
        }}
      >
        V4
      </div>
    ),
    { width: size.width, height: size.height },
  );
}

