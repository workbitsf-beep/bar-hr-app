import type { Metadata } from "next";
import { getAccountantEmail } from "@/lib/accountant/auth";
import { venuesForAccountant } from "@/lib/accountant/invoices";
import { monthLabel } from "@/lib/costs/analysis";
import { MixCard, mixPage, mixRow, PageHead } from "../dashboard/mix-ui";
import { signOutAction } from "./actions";
import { AccountantLogin } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fatture per il commercialista · Workbit", robots: { index: false } };

const link = {
  flex: "0 0 auto",
  minHeight: 36,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13.5,
  fontWeight: 720,
  textDecoration: "none",
} as const;

/**
 * The accountant's page: every venue that gave this email access, and the
 * month's zip for one venue or for all of them. Nothing else of the venues.
 */
export default async function AccountantPage() {
  const email = await getAccountantEmail();

  const shell = (children: React.ReactNode) => (
    <main style={{ minHeight: "100dvh", background: "#f1eefb", padding: "32px 16px 48px" }}>
      <div style={{ ...mixPage, maxWidth: 560 }}>{children}</div>
    </main>
  );

  if (!email) {
    return shell(
      <>
        <PageHead title="Fatture dei clienti" />
        <MixCard>
          <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.5, color: "#4c4670" }}>
            Per i commercialisti dei locali che usano Workbit: entra con l&apos;email che il cliente ti ha indicato e scarica le fatture dei fornitori.
          </p>
          <AccountantLogin />
        </MixCard>
      </>,
    );
  }

  const venues = await venuesForAccountant(email);
  const allMonths = [...new Set(venues.flatMap((venue) => venue.months.map((entry) => entry.month)))].sort().reverse().slice(0, 12);

  return shell(
    <>
      <PageHead
        title="Fatture dei clienti"
        actions={
          <form action={signOutAction}>
            <button type="submit" style={{ ...link, cursor: "pointer", background: "#ffffff" }}>
              Esci
            </button>
          </form>
        }
      />
      <p style={{ margin: "-4px 4px 0", fontSize: 13.5, color: "#667085" }}>{email}</p>

      {venues.length > 1 && allMonths.length ? (
        <MixCard title="Tutti i locali" aside="uno zip, una cartella per locale">
          <div className="wb-mix-rows">
            {allMonths.map((month) => (
              <div key={month} style={{ ...mixRow, gap: 12, padding: "11px 0" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, textTransform: "capitalize" }}>{monthLabel(month)}</span>
                <a href={`/api/commercialista/zip?month=${month}`} style={link}>
                  Scarica zip
                </a>
              </div>
            ))}
          </div>
        </MixCard>
      ) : null}

      {venues.length === 0 ? (
        <MixCard>
          <p style={{ margin: 0, fontSize: 14.5, color: "#667085" }}>Nessun locale ti dà più accesso.</p>
        </MixCard>
      ) : (
        venues.map((venue) => (
          <MixCard key={venue.id} title={venue.name} aside={venue.months.length ? null : "nessuna fattura"}>
            <div className="wb-mix-rows">
              {venue.months.slice(0, 12).map(({ month, count }) => (
                <div key={month} style={{ ...mixRow, gap: 12, padding: "11px 0" }}>
                  <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                    <span style={{ fontSize: 15, textTransform: "capitalize" }}>{monthLabel(month)}</span>
                    <span style={{ fontSize: 13, color: "#667085" }}>{count === 1 ? "1 fattura" : `${count} fatture`}</span>
                  </span>
                  <a href={`/api/commercialista/zip?month=${month}&bar=${venue.id}`} style={link}>
                    Scarica zip
                  </a>
                </div>
              ))}
            </div>
          </MixCard>
        ))
      )}

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#8a85a3", textAlign: "center" }}>
        Ogni zip ha gli XML delle fatture e un riepilogo.csv. Il mese è quello della data della fattura. L&apos;originale resta nel cassetto fiscale dell&apos;Agenzia delle Entrate.
      </p>
    </>,
  );
}
