import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { getDashboardContext } from "../../context";
import { Forbidden, Row, Section } from "../console-ui";
import { GpsRadiusForm } from "./gps-form";

export default async function ConsoleSystemPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const globalGpsRadius = await getGlobalGpsRadius();

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Sistema</h1>
        <p className="wbc-desc">Impostazioni valide per tutta la rete e strumenti di controllo della piattaforma.</p>
      </div>

      <Section title="Timbratura GPS">
        <GpsRadiusForm initialRadius={globalGpsRadius} />
      </Section>

      <Section title="Gestione" flush>
        <Row
          href="/dashboard/super-admin/legal"
          title="Documenti legali"
          meta="Privacy, termini e contratti da far accettare"
        />
        <Row
          href="/dashboard/super-admin/settings"
          title="Sicurezza account"
          meta="Password, impronta e Face ID, altri super admin"
        />
        <Row
          href="/dashboard/super-admin/usage"
          title="Utilizzo e diagnostica"
          meta="Carico della piattaforma e stato del database"
        />
      </Section>
    </div>
  );
}
