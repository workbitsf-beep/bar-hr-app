/**
 * The widget extension's App Store profile, fetched (or made) at build time
 * through the App Store Connect API, so it needs no secret of its own.
 *
 *   ASC_KEY_ID=... ASC_ISSUER_ID=... node scripts/ios-widget-profile.mjs out.mobileprovision
 *
 * Reads the key where the TestFlight workflow leaves it
 * (~/private_keys/AuthKey_<id>.p8). Registers the bundle id the first time,
 * and makes a new profile when there is none or it has expired - covering
 * every distribution certificate, so it follows the yearly renewal of the
 * app's own (scripts/ios-signing-setup.ts).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BUNDLE_ID = "it.workbit.app.widget";
const PROFILE_NAME = "Workbit Widget App Store";

const keyId = process.env.ASC_KEY_ID;
const issuer = process.env.ASC_ISSUER_ID;
const out = process.argv[2];
if (!keyId || !issuer || !out) throw new Error("Servono ASC_KEY_ID, ASC_ISSUER_ID e il file di uscita.");
const key = fs.readFileSync(path.join(os.homedir(), "private_keys", `AuthKey_${keyId}.p8`), "utf8");

function token() {
  const b64 = (value) => Buffer.from(value instanceof Buffer ? value : JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: keyId, typ: "JWT" });
  const body = b64({ iss: issuer, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" });
  const signature = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64(signature)}`;
}

async function api(method, route, payload) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${route}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const json = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

const found = await api("GET", `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}`);
let bundleId = found.data.find((item) => item.attributes.identifier === BUNDLE_ID)?.id;
if (!bundleId) {
  const made = await api("POST", "/v1/bundleIds", {
    data: { type: "bundleIds", attributes: { identifier: BUNDLE_ID, name: "Workbit Widget", platform: "IOS" } },
  });
  bundleId = made.data.id;
  console.log(`Bundle ID ${BUNDLE_ID} registrato.`);
}

const existing = await api("GET", `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}`);
let profile = existing.data.find(
  (item) => item.attributes.profileState === "ACTIVE" && new Date(item.attributes.expirationDate) > new Date()
);

if (!profile) {
  for (const old of existing.data) await api("DELETE", `/v1/profiles/${old.id}`);
  const certificates = await api("GET", "/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=50");
  if (certificates.data.length === 0) throw new Error("Nessun certificato di distribuzione.");
  const made = await api("POST", "/v1/profiles", {
    data: {
      type: "profiles",
      attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleId } },
        certificates: { data: certificates.data.map((item) => ({ type: "certificates", id: item.id })) },
      },
    },
  });
  profile = made.data;
  console.log(`Profilo "${PROFILE_NAME}" creato.`);
}

fs.writeFileSync(out, Buffer.from(profile.attributes.profileContent, "base64"));
console.log(`Profilo "${PROFILE_NAME}" pronto, scade ${profile.attributes.expirationDate}.`);
