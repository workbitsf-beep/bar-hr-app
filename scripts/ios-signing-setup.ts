/**
 * One-off (then once a year): the App Store distribution certificate and the
 * provisioning profile the TestFlight workflow signs with, created through
 * the App Store Connect API - no Mac needed.
 *
 *   ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_FILE=AuthKey_XXX.p8 OUT_DIR=... \
 *     npx tsx scripts/ios-signing-setup.ts
 *
 * Writes into OUT_DIR: dist.p12 (+ dist.p12.password) and appstore.mobileprovision,
 * which go to the repository secrets IOS_DIST_P12, IOS_DIST_P12_PASSWORD and
 * IOS_PROFILE (base64). Uses openssl for the signing request. See docs/ios-testflight.md.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BUNDLE_ID = "it.workbit.app";
const PROFILE_NAME = "Workbit App Store";

const keyId = process.env.ASC_KEY_ID!;
const issuer = process.env.ASC_ISSUER_ID!;
const keyFile = process.env.ASC_KEY_FILE!;
const out = process.env.OUT_DIR!;
if (!keyId || !issuer || !keyFile || !out) throw new Error("Servono ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE e OUT_DIR.");
fs.mkdirSync(out, { recursive: true });

function token() {
  const b64 = (value: object | Buffer) => Buffer.from(value instanceof Buffer ? value : JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: keyId, typ: "JWT" });
  const body = b64({ iss: issuer, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" });
  const signature = crypto.sign("sha256", Buffer.from(`${head}.${body}`), {
    key: fs.readFileSync(keyFile, "utf8"),
    dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${b64(signature)}`;
}

async function api(method: string, route: string, payload?: object) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${route}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const json = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json as any;
}

function openssl(args: string[]) {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "inherit"] });
}

async function main() {
  // 1. Private key and signing request, made here and never sent anywhere.
  const keyPem = path.join(out, "dist.key");
  const csrPem = path.join(out, "dist.csr");
  openssl(["genrsa", "-out", keyPem, "2048"]);
  openssl(["req", "-new", "-key", keyPem, "-subj", "/CN=Workbit Distribution/C=IT", "-out", csrPem]);
  const csr = fs.readFileSync(csrPem, "utf8");

  // 2. The distribution certificate.
  const cert = await api("POST", "/v1/certificates", {
    data: { type: "certificates", attributes: { certificateType: "DISTRIBUTION", csrContent: csr } },
  });
  const certId = cert.data.id;
  const certDer = path.join(out, "dist.cer");
  fs.writeFileSync(certDer, Buffer.from(cert.data.attributes.certificateContent, "base64"));
  const certPem = path.join(out, "dist.pem");
  openssl(["x509", "-inform", "DER", "-in", certDer, "-out", certPem]);
  console.log(`Certificato di distribuzione ${certId}, scade ${cert.data.attributes.expirationDate}`);

  // 3. A .p12 the macOS keychain can import (SHA1/3DES, which it still expects).
  const password = crypto.randomBytes(18).toString("base64url");
  fs.writeFileSync(path.join(out, "dist.p12.password"), password);
  openssl([
    "pkcs12", "-export", "-inkey", keyPem, "-in", certPem, "-out", path.join(out, "dist.p12"),
    "-passout", `pass:${password}`, "-keypbe", "PBE-SHA1-3DES", "-certpbe", "PBE-SHA1-3DES", "-macalg", "sha1",
  ]);

  // 4. The App Store profile for the app, replacing an older one of the same name.
  const bundle = await api("GET", `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}`);
  const bundleId = bundle.data.find((item: any) => item.attributes.identifier === BUNDLE_ID)?.id;
  if (!bundleId) throw new Error(`Bundle ID ${BUNDLE_ID} non trovato su developer.apple.com.`);
  const old = await api("GET", `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}`);
  for (const profile of old.data) await api("DELETE", `/v1/profiles/${profile.id}`);
  const profile = await api("POST", "/v1/profiles", {
    data: {
      type: "profiles",
      attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleId } },
        certificates: { data: [{ type: "certificates", id: certId }] },
      },
    },
  });
  fs.writeFileSync(path.join(out, "appstore.mobileprovision"), Buffer.from(profile.data.attributes.profileContent, "base64"));
  console.log(`Profilo "${PROFILE_NAME}" creato, scade ${profile.data.attributes.expirationDate}`);

  for (const file of ["dist.key", "dist.csr", "dist.cer", "dist.pem"]) fs.rmSync(path.join(out, file));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
