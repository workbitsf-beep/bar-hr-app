import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

function WorkbitAppleIcon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
        color: "#0f172a",
        fontSize: 88,
        fontWeight: 800,
        letterSpacing: "-0.08em",
        borderRadius: 42,
      }}
    >
      WB
    </div>
  );
}

export default function AppleIcon() {
  return new ImageResponse(<WorkbitAppleIcon />, size);
}
