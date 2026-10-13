import "server-only";

/**
 * What Railway charges Workbit, read from Railway's own API for the console's
 * Costi e debiti page: this month's usage so far, a projection to the end of
 * the billing period, and the invoices of past months.
 *
 * Needs an account token in RAILWAY_API_TOKEN (Railway → Account settings →
 * Tokens). The workspace is RAILWAY_WORKSPACE_ID when set, else the one of
 * this project (RAILWAY_PROJECT_ID, which Railway sets by itself), else the
 * token's first. Only reads; kept for 15 minutes so the page stays quick.
 *
 * Railway bills in dollars: currentUsage is a dollar amount, an invoice's
 * total is in cents. The console converts to euros with RAILWAY_USD_TO_EUR.
 */

const API = "https://backboard.railway.com/graphql/v2";
const KEEP_MS = 15 * 60 * 1000;

export type RailwayBilling =
  | {
      ok: true;
      currentUsd: number;
      projectedUsd: number;
      periodStart: Date;
      periodEnd: Date;
      invoices: Array<{ paidOn: Date; totalUsd: number; status: string }>;
    }
  | { ok: false; reason: "not-configured" | "refused" | "unreachable"; message: string };

let kept: { at: number; value: RailwayBilling } | null = null;

async function ask<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const payload = (await response.json().catch(() => null)) as { data?: T; errors?: Array<{ message: string }> } | null;
  if (!response.ok || !payload || payload.errors?.length) {
    const message = payload?.errors?.[0]?.message ?? `HTTP ${response.status}`;
    throw Object.assign(new Error(message), { refused: /not authorized|unauthor/i.test(message) || response.status === 401 });
  }
  return payload.data as T;
}

async function workspaceIdFor(token: string) {
  if (process.env.RAILWAY_WORKSPACE_ID) return process.env.RAILWAY_WORKSPACE_ID;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (projectId) {
    const data = await ask<{ project: { workspaceId: string | null } | null }>(
      token,
      "query($id: String!) { project(id: $id) { workspaceId } }",
      { id: projectId }
    ).catch(() => null);
    if (data?.project?.workspaceId) return data.project.workspaceId;
  }
  const data = await ask<{ me: { workspaces: Array<{ id: string }> } }>(token, "{ me { workspaces { id } } }");
  return data.me.workspaces[0]?.id ?? null;
}

export async function getRailwayBilling(now = new Date()): Promise<RailwayBilling> {
  if (kept && now.getTime() - kept.at < KEEP_MS) return kept.value;

  const token = process.env.RAILWAY_API_TOKEN?.trim();
  if (!token) {
    return { ok: false, reason: "not-configured", message: "Aggiungi RAILWAY_API_TOKEN su Railway per vedere il consumo vero." };
  }

  let value: RailwayBilling;
  try {
    const workspaceId = await workspaceIdFor(token);
    if (!workspaceId) throw new Error("Nessuno spazio di lavoro per questo token.");
    const data = await ask<{
      workspace: {
        customer: {
          currentUsage: number;
          billingPeriod: { start: string; end: string };
          invoices: Array<{ total: number; status: string; periodEnd: string }>;
        } | null;
      } | null;
    }>(
      token,
      "query($id: String!) { workspace(workspaceId: $id) { customer { currentUsage billingPeriod { start end } invoices { total status periodEnd } } } }",
      { id: workspaceId }
    );
    const customer = data.workspace?.customer;
    if (!customer) throw new Error("Railway non ha restituito i dati di fatturazione.");

    const periodStart = new Date(customer.billingPeriod.start);
    const periodEnd = new Date(customer.billingPeriod.end);
    const span = periodEnd.getTime() - periodStart.getTime();
    const elapsed = Math.min(span, Math.max(1, now.getTime() - periodStart.getTime()));
    // So far, stretched to the whole period at the same pace.
    const projectedUsd = span > 0 ? (customer.currentUsage * span) / elapsed : customer.currentUsage;

    value = {
      ok: true,
      currentUsd: customer.currentUsage,
      projectedUsd,
      periodStart,
      periodEnd,
      invoices: customer.invoices
        .filter((invoice) => invoice.total > 0 && invoice.status !== "void" && invoice.status !== "draft")
        // Charged when the period closes: that is the month the money leaves.
        .map((invoice) => ({ paidOn: new Date(invoice.periodEnd), totalUsd: invoice.total / 100, status: invoice.status })),
    };
  } catch (error) {
    const refused = Boolean((error as { refused?: boolean }).refused);
    console.error("[railway-billing]", error instanceof Error ? error.message : error);
    value = {
      ok: false,
      reason: refused ? "refused" : "unreachable",
      message: refused
        ? "Railway rifiuta il token: creane uno nuovo (Account settings → Tokens) e aggiorna RAILWAY_API_TOKEN."
        : "Railway non risponde in questo momento: riprovo tra qualche minuto.",
    };
  }

  kept = { at: now.getTime(), value };
  return value;
}

/** Dollars to euro cents, at the rate set in RAILWAY_USD_TO_EUR (default 0.92). */
export function usdToEuroCents(usd: number) {
  const rate = Number(process.env.RAILWAY_USD_TO_EUR ?? "0.92");
  return Math.round(usd * (Number.isFinite(rate) && rate > 0 ? rate : 0.92) * 100);
}
