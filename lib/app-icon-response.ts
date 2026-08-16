import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { ImageResponse } from "next/og";

export async function createAppIconResponse(size: number, maskable = false) {
  const logoBuffer = await readFile(join(process.cwd(), "public", "logo.png"));
  const logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  const logoSize = maskable ? Math.round(size * 0.78) : size;

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#111738" : "#ffffff",
        },
      },
      createElement("img", {
        src: logoDataUrl,
        alt: "Workbit",
        width: logoSize,
        height: logoSize,
        style: {
          width: `${logoSize}px`,
          height: `${logoSize}px`,
          objectFit: "cover",
          borderRadius: maskable ? `${Math.round(size * 0.18)}px` : "0",
        },
      })
    ),
    { width: size, height: size }
  );
}
