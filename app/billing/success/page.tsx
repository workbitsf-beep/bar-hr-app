import Link from "next/link";
import { Panel, PrimaryButton } from "@/app/dashboard/ui";

export default function BillingSuccessPage() {
  return (
    <Panel title="Pagamento completato">
      <div style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Pagamento completato. La carta e stata registrata e l&apos;abbonamento si
          attivera o rinnovera automaticamente al termine dei 30 giorni di prova.
        </p>
        <div>
          <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
            <PrimaryButton type="button">Torna alle impostazioni</PrimaryButton>
          </Link>
        </div>
      </div>
    </Panel>
  );
}
