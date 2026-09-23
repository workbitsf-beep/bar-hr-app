import Link from "next/link";
import { Empty, Section } from "./console-ui";

export default function NotFound() {
  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Non trovato</h1>
        <p className="wbc-desc">La pagina che cerchi non esiste, oppure il locale è stato eliminato.</p>
      </div>

      <Section title="Cosa puoi fare">
        <Empty>Torna all&apos;elenco dei locali della rete.</Empty>
        <Link href="/dashboard/super-admin" className="wbc-btn wbc-btn-primary" style={{ justifySelf: "start" }}>
          Vai a Rete
        </Link>
      </Section>
    </div>
  );
}
