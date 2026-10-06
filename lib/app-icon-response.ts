import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { ImageResponse } from "next/og";

/**
 * The PWA icons, scaled from public/logo.png.
 *
 * logo.png is already the full icon - violet ground to the edges, mark inside
 * the circle a maskable icon may be cropped to - so the plain and the maskable
 * icon are the same picture. `maskable` stays for the routes that ask for it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above.
export async function createAppIconResponse(size: number, maskable = false) {
  const logoBuffer = await readFile(join(process.cwd(), "public", "logo.png"));
  const logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    createElement("img", {
      src: logoDataUrl,
      alt: "Workbit",
      width: size,
      height: size,
      style: { width: `${size}px`, height: `${size}px` },
    }),
    { width: size, height: size }
  );
}
