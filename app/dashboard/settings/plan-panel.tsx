import { BASE_SEATS, COMPANY_PRO_SEATS, describePlan, MAX_SEAT_PACKS, SEAT_PACK_SIZE, type SeatUsage, type VenueEntitlements } from "@/lib/plans";

/**
 * The owner's plan, in plain words: what the venue has, how many people it
 * can hold, and what each extra is for. No prices and no buy buttons - plans
 * are bought outside the app; this only says where the venue stands.
 */
export function PlanPanel({
  entitlements,
  seats,
  company = false,
}: {
  entitlements: VenueEntitlements;
  seats: SeatUsage;
  /** A company has sites where a venue has departments. */
  company?: boolean;
}) {
  const share = seats.limit ? Math.min(100, Math.round((seats.used / seats.limit) * 100)) : 100;

  // A company's Pro starts from 45 people; everything else from 12.
  const seatBase = company && entitlements.pro ? COMPANY_PRO_SEATS : BASE_SEATS;
  const extras = [
    company
      ? {
          key: "departments",
          title: "Sedi",
          on: entitlements.departments,
          text: `Ogni sede ha nome, indirizzo e punto di timbratura: si timbra solo nella propria sede. Turni, note, checklist e carrello divisi per sede, e un responsabile per ogni sede. Si aggiungono una per una: fino a 3 sul Base; il Pro ne comprende 3 e arriva a 6.${entitlements.siteLimit ? ` Ne hai ${entitlements.siteLimit}.` : ""}`,
          who: "Per l'azienda con più uffici, negozi o magazzini.",
        }
      : {
          key: "departments",
          title: "Reparti",
          on: entitlements.departments,
          text: "Turni, note, checklist e carrello divisi tra banco, cucina e sala, più un reparto col nome che scegli tu. Il Jolly copre tutti i reparti e il capo reparto gestisce i turni del suo.",
          who: "Per la pizzeria con forno e sala, o il ristorante con cucina e sala.",
        },
    {
      key: "seats",
      title: `Persone in più`,
      on: entitlements.seatPacks > 0,
      text: `Pacchetti da ${SEAT_PACK_SIZE} persone, fino a ${MAX_SEAT_PACKS}: ${company ? "l'azienda" : "il locale"} passa da ${seatBase} a ${seatBase + MAX_SEAT_PACKS * SEAT_PACK_SIZE} persone.${entitlements.seatPacks ? ` Ne hai ${entitlements.seatPacks}.` : ""}`,
      who: "Per il bar che cresce ma lavora tutto insieme.",
    },
    {
      key: "branding",
      title: "Stile del locale",
      on: entitlements.branding,
      text: "Il tuo logo in alto al posto di quello di Workbit, e il font dell'insegna scelto tra otto.",
      who: "Per chi vuole l'app con il nome e lo stile del proprio locale.",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8, padding: 16, borderRadius: 20, background: "#f6f3ff", border: "1px solid #e4dbff" }}>
        <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color: "#7c6bd6" }}>
          Il tuo piano
        </span>
        <strong style={{ fontSize: 22, color: "#17161f" }}>{describePlan(entitlements, company)}</strong>
        <div style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#4c4670" }}>
            {seats.limit === null ? `${seats.used} persone · senza limite` : `${seats.used} persone su ${seats.limit}`}
            <span style={{ color: "#8b88a3", fontWeight: 600 }}> · il titolare conta</span>
          </span>
          {seats.limit !== null ? (
            <span style={{ height: 8, borderRadius: 999, background: "#e4dbff", overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${share}%`,
                  borderRadius: 999,
                  background: seats.full ? "#e8700c" : "linear-gradient(90deg,#9b5cff,#6d3df0)",
                }}
              />
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {extras.map((extra) => (
          <div key={extra.key} style={{ display: "grid", gap: 5, padding: "13px 14px", borderRadius: 18, border: "1px solid #ebe6f7", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 15.5, color: "#17161f" }}>{extra.title}</strong>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 850,
                  padding: "3px 9px",
                  borderRadius: 999,
                  ...(extra.on
                    ? { background: "#dcf5e8", color: "#148a55" }
                    : { background: "#f4f2fb", color: "#8b88a3" }),
                }}
              >
                {extra.on ? (entitlements.pro && extra.key === "branding" ? "Nel Pro" : entitlements.pro && extra.key === "departments" && !company ? "Nel Pro" : "Attivo") : "Non attivo"}
              </span>
            </div>
            <span style={{ fontSize: 13.5, color: "#4c4670", lineHeight: 1.45 }}>{extra.text}</span>
            <span style={{ fontSize: 12.5, color: "#8b88a3" }}>{extra.who}</span>
          </div>
        ))}

        <div style={{ display: "grid", gap: 5, padding: "13px 14px", borderRadius: 18, border: "1.5px solid #c4b5fd", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 15.5, color: "#17161f" }}>Pro</strong>
            {entitlements.pro && !entitlements.custom ? (
              <span style={{ fontSize: 11.5, fontWeight: 850, padding: "3px 9px", borderRadius: 999, background: "#dcf5e8", color: "#148a55" }}>
                Il tuo piano
              </span>
            ) : null}
          </div>
          <span style={{ fontSize: 13.5, color: "#4c4670", lineHeight: 1.45 }}>
            {company
              ? "Tutto compreso: 3 sedi (fino a 6), lo stile dell'azienda e fino a 45 persone."
              : "Tutto compreso: reparti, stile del locale e persone senza limite."}
          </span>
          <span style={{ fontSize: 12.5, color: "#8b88a3" }}>
            {company ? "Per l'azienda con molte sedi e tanta gente." : "Per il ristorante con tanta gente."}
          </span>
        </div>

        <div style={{ display: "grid", gap: 5, padding: "13px 14px", borderRadius: 18, border: entitlements.custom ? "1.5px solid #6d3df0" : "1px dashed #c4b5fd", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 15.5, color: "#17161f" }}>Su misura</strong>
            {entitlements.custom ? (
              <span style={{ fontSize: 11.5, fontWeight: 850, padding: "3px 9px", borderRadius: 999, background: "#dcf5e8", color: "#148a55" }}>
                Il tuo piano
              </span>
            ) : null}
          </div>
          <span style={{ fontSize: 13.5, color: "#4c4670", lineHeight: 1.45 }}>
            {entitlements.custom
              ? `Il piano studiato con voi: ${company ? `${entitlements.siteLimit} sedi, ` : ""}${entitlements.seatLimit === null ? "persone senza limite" : `fino a ${entitlements.seatLimit} persone`}, tutto compreso.`
              : `Tante ${company ? "sedi" : "persone"}? Prezzo, ${company ? "sedi e " : ""}persone li decidiamo insieme.`}
          </span>
          {entitlements.custom ? null : (
            <span style={{ fontSize: 12.5, color: "#8b88a3" }}>Scrivi all&apos;assistenza per parlarne.</span>
          )}
        </div>
      </div>

      <span style={{ fontSize: 13, color: "#8b88a3", lineHeight: 1.45 }}>
        Gli extra si sommano al tuo abbonamento: un solo pagamento. Per aggiungerne uno o passare al Pro, scrivi
        all&apos;assistenza.
      </span>
    </div>
  );
}
