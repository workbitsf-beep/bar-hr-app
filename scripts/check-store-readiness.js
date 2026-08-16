const fs = require("node:fs");
const path = require("node:path");

function loadLocalEnvironment() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function readPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

loadLocalEnvironment();

const checks = [];
const addCheck = (name, passed, detail) => checks.push({ name, passed, detail });
const requiredFiles = [
  "app/manifest.ts",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/support/page.tsx",
  "app/account-deletion/page.tsx",
  "public/logo.png",
];

for (const file of requiredFiles) {
  addCheck(file, fs.existsSync(path.join(process.cwd(), file)), "file richiesto");
}

const appUrl = process.env.APP_URL?.trim() || "";
let validAppUrl = false;
try {
  const parsed = new URL(appUrl);
  validAppUrl = parsed.protocol === "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname);
} catch {
  validAppUrl = false;
}
addCheck("APP_URL", validAppUrl, "deve essere un URL HTTPS pubblico");

const supportEmail = process.env.SUPPORT_EMAIL?.trim() || "";
addCheck("SUPPORT_EMAIL", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail), "email pubblica per gli store");

const logoPath = path.join(process.cwd(), "public", "logo.png");
if (fs.existsSync(logoPath)) {
  const dimensions = readPngDimensions(logoPath);
  addCheck(
    "Icona store",
    dimensions?.width === 1024 && dimensions?.height === 1024,
    dimensions ? `${dimensions.width}x${dimensions.height}` : "PNG non valido"
  );
}

for (const check of checks) {
  console.log(`${check.passed ? "OK" : "WARN"}  ${check.name}: ${check.detail}`);
}

const warnings = checks.filter((check) => !check.passed);
console.log(`\nStore readiness: ${checks.length - warnings.length}/${checks.length} controlli superati.`);

if (warnings.length > 0 && process.env.STORE_RELEASE_CHECK_STRICT === "1") {
  process.exitCode = 1;
}
