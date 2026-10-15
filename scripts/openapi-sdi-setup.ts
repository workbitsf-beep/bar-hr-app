/**
 * Openapi (SDI) setup and test, from the PC. See docs/fatturazione-sdi.md.
 *
 *   OPENAPI_SDI_TOKEN=... [OPENAPI_SDI_SANDBOX=1] OPENAPI_SDI_CALLBACK_KEY=... \
 *     npx tsx scripts/openapi-sdi-setup.ts configura <partita IVA> "<nome>" <email>
 *
 *   OPENAPI_SDI_TOKEN=... OPENAPI_SDI_SANDBOX=1 \
 *     npx tsx scripts/openapi-sdi-setup.ts prova <partita IVA>
 *
 * "configura" registers Workbit as the sender and points the SDI's answers at
 * https://app.workbit.it/api/webhooks/openapi-sdi?key=<OPENAPI_SDI_CALLBACK_KEY>.
 * "prova" (sandbox only) sends a sample invoice and asks the sandbox to answer
 * it as delivered, then prints what came back.
 */
import { buildFatturaXml, fatturaProgressive } from "../lib/invoicing/fattura-pa";

const token = process.env.OPENAPI_SDI_TOKEN?.trim();
const sandbox = process.env.OPENAPI_SDI_SANDBOX?.trim() === "1";
const base = sandbox ? "https://test.sdi.openapi.it" : "https://sdi.openapi.it";
if (!token) throw new Error("Imposta OPENAPI_SDI_TOKEN.");

async function call(method: string, path: string, body?: string, contentType = "application/json") {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": contentType } : {}) },
    body,
  });
  const json = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: unknown } | null;
  if (!response.ok || json?.success === false) throw new Error(`${method} ${path}: ${response.status} ${json?.message ?? ""}`);
  return json?.data;
}

async function configure(fiscalId: string, name: string, email: string) {
  const key = process.env.OPENAPI_SDI_CALLBACK_KEY?.trim();
  if (!key) throw new Error("Imposta OPENAPI_SDI_CALLBACK_KEY (la stessa chiave che metti su Railway).");
  await call("POST", "/business_registry_configurations", JSON.stringify({
    fiscal_id: fiscalId, name, email, apply_signature: false, apply_legal_storage: false,
  })).then(
    () => console.log("Workbit registrata come mittente."),
    (error: Error) => {
      if (/exist/i.test(error.message)) console.log("Mittente già registrato.");
      else throw error;
    }
  );
  await call("POST", "/api_configurations", JSON.stringify({
    fiscal_id: fiscalId,
    callbacks: [{ event: "customer-notification", url: `https://app.workbit.it/api/webhooks/openapi-sdi?key=${encodeURIComponent(key)}` }],
  }));
  console.log(`Risposte dello SDI collegate a app.workbit.it (${sandbox ? "sandbox" : "produzione"}).`);
}

async function test(fiscalId: string) {
  if (!sandbox) throw new Error("La prova si fa solo con OPENAPI_SDI_SANDBOX=1.");
  const year = new Date().getFullYear();
  const sequence = 900000 + Math.floor(Math.random() * 99999);
  const xml = buildFatturaXml({
    issuer: {
      firstName: "Prova",
      lastName: "Workbit",
      legalName: "Prova Workbit",
      vatNumber: fiscalId,
      taxCode: fiscalId,
      street: "Via di Prova 1",
      postalCode: "20100",
      city: "Milano",
      province: "MI",
    },
    recipient: {
      businessName: "Cliente di prova srl",
      vatNumber: "01234567897",
      taxCode: null,
      recipientCode: "0000000",
      certifiedEmail: null,
      street: "Via Roma 1",
      postalCode: "20100",
      city: "Milano",
      province: "MI",
      countryCode: "IT",
    },
    number: `${year}/${sequence}`,
    progressive: fatturaProgressive(year, sequence),
    date: new Date(),
    lines: [{ description: "Workbit Pro - mensile (prova)", amountCents: 5999 }],
  });
  const sent = (await call("POST", "/invoices", xml, "application/xml")) as { uuid: string };
  console.log("Fattura di prova inviata:", sent.uuid);
  await call("POST", "/simulate/customer-notification", JSON.stringify({ uuid: sent.uuid, notification: "RC" }));
  console.log("Chiesta alla sandbox la ricevuta di consegna (RC).");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const notes = (await call("GET", `/invoices_notifications/${sent.uuid}`)) as Array<{ type: string; created_at: string }>;
  console.log("Notifiche:", (notes ?? []).map((note) => `${note.type} ${note.created_at}`).join(", ") || "nessuna ancora");
}

const [command, ...args] = process.argv.slice(2);
(command === "configura" ? configure(args[0], args[1], args[2]) : command === "prova" ? test(args[0]) : Promise.reject(new Error("Comando: configura | prova"))).catch(
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
);
