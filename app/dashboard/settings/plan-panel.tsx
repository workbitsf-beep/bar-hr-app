import { InfoButton } from "@/app/components/info-button";
import { planInfo, type PlanInfoKey } from "@/lib/plan-info";
import { describePlan, type SeatUsage, type VenueEntitlements } from "@/lib/plans";

/**
 * The owner's plan, in plain words: what the venue has and how many people it
 * can hold. One line per extra with whether it is on; what each one does is
 * behind its "i". No prices and no buy buttons - plans are bought outside the
 * app; this only says where the venue stands.
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

  const pill = (on: boolean, label?: string) => ({ on, label: label ?? (on ? "Attivo" : "Non attivo") });
  const rows: Array<{ key: PlanInfoKey; status: { on: boolean; label: string } }> = [
    company
      ? {
          key: "sedi",
          status: pill(entitlements.departments, entitlements.departments ? `${entitlements.siteLimit} sedi` : undefined),
        }
      : { key: "reparti", status: pill(entitlements.departments, entitlements.pro ? "Nel Pro" : undefined) },
    {
      key: "persone5",
      status: pill(entitlements.seatPacks > 0, entitlements.seatPacks > 0 ? `+${entitlements.seatPacks * 5} persone` : undefined),
    },
    { key: "stile", status: pill(entitlements.branding, entitlements.pro && entitlements.branding ? "Nel Pro" : undefined) },
    { key: "pro", status: pill(entitlements.pro && !entitlements.custom, entitlements.pro && !entitlements.custom ? "Il tuo piano" : "") },
    { key: "custom", status: pill(entitlements.custom, entitlements.custom ? "Il tuo piano" : "") },
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

      <div style={{ display: "grid", borderRadius: 18, border: "1px solid #ebe6f7", background: "#fff", padding: "2px 14px" }}>
        {rows.map((row, index) => {
          const info = planInfo(row.key, company);
          return (
            <div
              key={row.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 0",
                borderTop: index === 0 ? undefined : "1px solid #f4f2fb",
              }}
            >
              <strong style={{ fontSize: 15, color: "#17161f" }}>{info.title}</strong>
              <InfoButton title={info.title} text={info.text} who={info.who} />
              <span style={{ flex: 1 }} />
              {row.status.label ? (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 850,
                    padding: "3px 9px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    ...(row.status.on ? { background: "#dcf5e8", color: "#148a55" } : { background: "#f4f2fb", color: "#8b88a3" }),
                  }}
                >
                  {row.status.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* On the web the owner changes it right below; the installed app only
          shows the plan, as the stores require. */}
      <span className="wb-web-only" style={{ fontSize: 13, color: "#8b88a3", lineHeight: 1.45 }}>
        Gli extra si sommano al tuo abbonamento: un solo pagamento. Per aggiungerne uno o passare al Pro, sceglilo
        in Abbonamento qui sotto.
      </span>
      <span className="wb-native-only" style={{ fontSize: 13, color: "#8b88a3", lineHeight: 1.45 }}>
        Gli extra si sommano al tuo abbonamento: un solo pagamento. Il piano si gestisce dall&apos;area titolare di
        Workbit sul web.
      </span>
    </div>
  );
}
