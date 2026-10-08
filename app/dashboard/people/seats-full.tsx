import Link from "next/link";
import { MAX_SEAT_PACKS, SEAT_PACK_SIZE, type SeatUsage, type VenueEntitlements } from "@/lib/plans";

/**
 * The venue has as many people as its plan allows. Instead of a form that
 * fails on save, the owner reads where they stand and what lets them add more.
 */
export function SeatsFull({
  seats,
  entitlements,
  callout = false,
  company = false,
}: {
  seats: SeatUsage;
  entitlements: VenueEntitlements;
  callout?: boolean;
  company?: boolean;
}) {
  const packsLeft = MAX_SEAT_PACKS - entitlements.seatPacks;

  return (
    <div
      role={callout ? "alert" : undefined}
      style={{
        display: "grid",
        gap: 10,
        padding: callout ? "14px 16px" : 0,
        borderRadius: 18,
        background: callout ? "#fff7ed" : "transparent",
        border: callout ? "1px solid #fed7aa" : "none",
      }}
    >
      <strong style={{ fontSize: 16, color: "#17161f" }}>
        Hai {seats.used} persone su {seats.limit}: il locale è al completo
      </strong>
      <span style={{ fontSize: 14, color: "#5b5873", lineHeight: 1.45 }}>
        Il titolare conta tra le persone. Per aggiungerne altre:
      </span>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14, color: "#17161f", lineHeight: 1.4 }}>
        {packsLeft > 0 ? (
          <li>
            un pacchetto da <b>+{SEAT_PACK_SIZE} persone</b>, fino a {MAX_SEAT_PACKS}
            {entitlements.seatPacks ? ` (ne hai già ${entitlements.seatPacks})` : ""}
          </li>
        ) : null}
        <li>
          il <b>Pro</b>: persone senza limite, {company ? "fino a 6 sedi" : "reparti"} e lo stile {company ? "della tua azienda" : "del tuo locale"}
        </li>
      </ul>
      <span style={{ fontSize: 13, color: "#8b88a3" }}>
        Gli extra si sommano al tuo abbonamento, con un solo pagamento. Scrivi all&apos;assistenza per aggiungerli.
      </span>
      <Link
        href="/dashboard/settings?billing=1"
        style={{ justifySelf: "start", fontSize: 14, fontWeight: 800, color: "#6d3df0", textDecoration: "none" }}
      >
        Vedi il tuo piano ›
      </Link>
    </div>
  );
}
