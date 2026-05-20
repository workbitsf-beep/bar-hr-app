const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, ".next", "standalone");
const nextStaticSource = path.join(rootDir, ".next", "static");
const nextStaticTarget = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(rootDir, "public");
const publicTarget = path.join(standaloneDir, "public");

function copyRequiredDirectory(source, target, label) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing ${label} source directory: ${source}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`[standalone-assets] copied ${label}`);
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error(`Missing standalone build directory: ${standaloneDir}`);
}

copyRequiredDirectory(nextStaticSource, nextStaticTarget, "Next static assets");
copyRequiredDirectory(publicSource, publicTarget, "public assets");
