import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
          color: "white",
          fontSize: 28,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          letterSpacing: "-0.04em",
        }}
      >
        V4
      </div>
    ),
    { width: size.width, height: size.height },
  );
}

