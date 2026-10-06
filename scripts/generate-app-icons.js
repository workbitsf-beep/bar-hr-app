/**
 * Draws every Workbit app icon from one vector drawing.
 *
 * The icon is the first frame of the opening (app/layout.tsx): the same violet
 * ground with its two lights, and the mark - orbit, white W, violet B - on top.
 * Run it after changing the drawing:
 *
 *   node scripts/generate-app-icons.js
 *
 * It writes public/logo.png (the source the web icons, PDFs and notifications
 * read), the iOS AppIcon, the Android launcher icons and the Play Store icon.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");

const W =
  "140,362 265,362 338,575 400,433 452,433 512,575 560,362 668,362 548,705 468,705 426,590 384,705 300,705";
const B =
  "M 690 360 H 825 C 885 360 915 395 905 445 C 900 480 880 505 850 518 C 895 535 915 570 908 615 C 900 670 855 705 790 705 H 540 Z M 696 438 L 676 497 H 800 C 822 497 836 486 838 468 C 840 450 828 438 808 438 Z M 655 575 L 635 632 H 793 C 818 632 834 620 836 601 C 838 584 825 575 802 575 Z";

const defs = `
  <linearGradient id="b" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="#d27cff"/><stop offset="100%" stop-color="#7b34f0"/></linearGradient>
  <linearGradient id="orbit" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9b5cff" stop-opacity=".3"/><stop offset="45%" stop-color="#a66bff"/><stop offset="100%" stop-color="#7c3aed" stop-opacity=".45"/></linearGradient>
  <linearGradient id="ground" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0%" stop-color="#140a2c"/><stop offset="52%" stop-color="#2a1263"/><stop offset="100%" stop-color="#4a2396"/></linearGradient>
  <radialGradient id="lightTR" cx="0.8" cy="0.12" r="0.6"><stop offset="0%" stop-color="#a77cf5" stop-opacity=".55"/><stop offset="100%" stop-color="#a77cf5" stop-opacity="0"/></radialGradient>
  <radialGradient id="lightBL" cx="0.16" cy="0.9" r="0.55"><stop offset="0%" stop-color="#6d5ce7" stop-opacity=".45"/><stop offset="100%" stop-color="#6d5ce7" stop-opacity="0"/></radialGradient>`;

const ground = `
  <rect width="1024" height="1024" fill="url(#ground)"/>
  <rect width="1024" height="1024" fill="url(#lightTR)"/>
  <rect width="1024" height="1024" fill="url(#lightBL)"/>`;

/** The mark at `scale` of the canvas, centred. The orbit is drawn a touch heavier than in the app so it survives small sizes. */
function mark(scale) {
  const offset = (1024 * (1 - scale)) / 2;
  return `
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <g fill="none" stroke="url(#orbit)" stroke-width="18" stroke-linecap="round">
      <path d="M 112 352 A 440 440 0 0 1 652 110"/>
      <path d="M 922 712 A 440 440 0 0 1 362 948"/>
    </g>
    <polygon points="${W}" fill="#ffffff"/>
    <path d="${B}" fill="url(#b)" fill-rule="evenodd"/>
  </g>`;
}

const svg = (body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`);

// The full icon. At 74% the mark stays inside the circle every launcher and the
// PWA maskable icon may crop to.
const full = svg(ground + mark(0.74));
// Android draws its adaptive icon in two layers and crops them itself; the
// foreground must sit inside the inner 66 of 108 dp.
const background = svg(ground);
const foreground = svg(mark(0.68));

const roundMask = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
const squircleMask = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#fff"/></svg>`);

function out(relative) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

async function png(source, size, relative, { mask, opaque } = {}) {
  let image = sharp(source, { density: 300 }).resize(size, size);
  if (mask) {
    const masked = await image.png().toBuffer();
    image = sharp(masked).composite([{ input: mask(size), blend: "dest-in" }]);
  }
  // The App Store refuses an icon with an alpha channel.
  if (opaque) image = image.removeAlpha();
  await image.png({ compressionLevel: 9 }).toFile(out(relative));
  console.log(`${relative} (${size})`);
}

async function main() {
  await png(full, 1024, "public/logo.png");
  await png(full, 1024, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", { opaque: true });
  await png(full, 512, "docs/store-assets/play-store-icon-512.png", { opaque: true });

  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [name, factor] of Object.entries(densities)) {
    const dir = `android/app/src/main/res/mipmap-${name}`;
    await png(full, 48 * factor, `${dir}/ic_launcher.png`, { mask: squircleMask });
    await png(full, 48 * factor, `${dir}/ic_launcher_round.png`, { mask: roundMask });
    await png(foreground, 108 * factor, `${dir}/ic_launcher_foreground.png`);
    await png(background, 108 * factor, `${dir}/ic_launcher_background.png`, { opaque: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
