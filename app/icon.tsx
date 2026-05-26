import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

async function getLogoDataUrl() {
  const logoBuffer = await readFile(join(process.cwd(), "public", "logo.png"));
  return `data:image/png;base64,${logoBuffer.toString("base64")}`;
}

export default async function Icon() {
  const logoDataUrl = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <img
          src={logoDataUrl}
          alt="Workbit"
          width="512"
          height="512"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    ),
    size
  );
}
