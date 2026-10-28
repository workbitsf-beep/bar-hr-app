import "server-only";

/**
 * Openapi (openapi.com) as the intermediary to the SDI: Workbit's FatturaPA
 * XML goes in through POST /invoices and the SDI's answers come back as
 * notifications - RC delivered, MC not delivered, NS rejected.
 *
 *   OPENAPI_SDI_TOKEN    the bearer token from console.openapi.com
 *   OPENAPI_SDI_SANDBOX  "1" for test.sdi.openapi.it (nothing reaches the SDI)
 *
 * Without a token nothing is sent: invoices wait in the console to be
 * uploaded by hand, as before. See docs/fatturazione-sdi.md.
 */

export type SdiNotification = {
  uuid: string;
  invoiceUuid: string;
  type: string;
  createdAt: string;
  message: Record<string, unknown> | null;
};

export function sdiConfig() {
  const token = process.env.OPENAPI_SDI_TOKEN?.trim();
  if (!token) return null;
  const sandbox = process.env.OPENAPI_SDI_SANDBOX?.trim() === "1";
  // OPENAPI_SDI_BASE_URL: only for local tests against a stand-in server.
  const override = process.env.OPENAPI_SDI_BASE_URL?.trim();
  return {
    token,
    sandbox: sandbox || Boolean(override),
    baseUrl: override || (sandbox ? "https://test.sdi.openapi.it" : "https://sdi.openapi.it"),
  };
}

export async function call(path: string, init: { method: string; body?: string; contentType?: string }) {
  const config = sdiConfig();
  if (!config) throw new Error("Invio allo SDI non configurato (OPENAPI_SDI_TOKEN).");
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      ...(init.contentType ? { "Content-Type": init.contentType } : {}),
    },
    body: init.body,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: unknown; error?: unknown }
    | null;
  if (!response.ok || payload?.success === false) {
    const reason = payload?.message || `HTTP ${response.status}`;
    throw new Error(response.status === 402 ? `Credito Openapi esaurito: ${reason}` : reason);
  }
  return payload?.data;
}

/** Hands one invoice to the SDI. Returns Openapi's uuid for it. */
export async function sendInvoiceXml(xml: string) {
  const data = (await call("/invoices", { method: "POST", body: xml, contentType: "application/xml" })) as
    | { uuid?: string }
    | null;
  if (!data?.uuid) throw new Error("Openapi non ha restituito l'identificativo della fattura.");
  return data.uuid;
}

/** What the SDI has said about one invoice so far, oldest first. */
export async function invoiceNotifications(uuid: string): Promise<SdiNotification[]> {
  const data = (await call(`/invoices_notifications/${encodeURIComponent(uuid)}`, { method: "GET" })) as
    | Array<Record<string, unknown>>
    | null;
  return (Array.isArray(data) ? data : [])
    .map((item) => ({
      uuid: String(item.uuid ?? ""),
      invoiceUuid: String(item.invoice_uuid ?? uuid),
      type: String(item.type ?? "").toUpperCase(),
      createdAt: String(item.created_at ?? ""),
      message: item.message && typeof item.message === "object" ? (item.message as Record<string, unknown>) : null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * One-off setup of the account: Workbit as the business that sends, and the
 * address the SDI's answers are posted to (scripts/openapi-sdi-setup.ts).
 */
export async function configureSdiAccount(input: { fiscalId: string; name: string; email: string; callbackUrl: string }) {
  const registry = await call("/business_registry_configurations", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      fiscal_id: input.fiscalId,
      name: input.name,
      email: input.email,
      apply_signature: false,
      apply_legal_storage: false,
    }),
  }).catch((error: Error) => {
    // Already there from an earlier run: fine.
    if (/exist/i.test(error.message)) return null;
    throw error;
  });
  const callbacks = await call("/api_configurations", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      fiscal_id: input.fiscalId,
      callbacks: [{ event: "customer-notification", url: input.callbackUrl }],
    }),
  });
  return { registry, callbacks };
}

/** Sandbox only: makes the SDI "answer" an invoice, to test the callback. */
export async function simulateNotification(invoiceUuid: string, type: "RC" | "MC" | "NS") {
  return call("/simulate/customer-notification", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ uuid: invoiceUuid, notification: type }),
  });
}

/** The words the SDI used, for the console: a rejection's errors, or a short reason. */
export function describeNotification(notification: SdiNotification) {
  const message = notification.message ?? {};
  // The SDI's own names, which arrive capitalised or not.
  const pick = (from: unknown, key: string) =>
    from && typeof from === "object"
      ? (from as Record<string, unknown>)[key] ?? (from as Record<string, unknown>)[key[0].toUpperCase() + key.slice(1)]
      : undefined;
  const errors = pick(pick(message, "lista_errori"), "errore");
  const list = Array.isArray(errors) ? errors : errors ? [errors] : [];
  const described = list
    .map((error) => [pick(error, "codice"), pick(error, "descrizione")].filter(Boolean).join(" "))
    .filter(Boolean);
  if (described.length) return described.join("; ").slice(0, 500);
  const note = message.note ?? message.descrizione;
  return typeof note === "string" ? note.slice(0, 500) : null;
}
