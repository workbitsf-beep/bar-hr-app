import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

function WorkbitIcon() {
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
        fontSize: 250,
        fontWeight: 800,
        letterSpacing: "-0.1em",
        borderRadius: 120,
      }}
    >
      WB
    </div>
  );
}

export default function Icon() {
  return new ImageResponse(<WorkbitIcon />, size);
}
