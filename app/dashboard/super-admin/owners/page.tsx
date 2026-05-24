import { createOwnerBySuperAdminAction } from "../../actions";
import { getDashboardContext } from "../../context";
import {
  FormField,
  Panel,
  PrimaryButton,
  Select,
  TextInput,
} from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminOwnersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const success = Array.isArray(params.success)
    ? params.success[0]
    : params.success;
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Responsabili"
      description="Crea un responsabile e invia la welcome email con l'accesso iniziale."
    >
      <Panel title="Crea responsabile">
        <form action={createOwnerBySuperAdminAction} style={{ display: "grid", gap: 16 }}>
          {error === "owner-exists" ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                lineHeight: 1.5,
              }}
            >
              Esiste gia un responsabile con questa email. Usa un indirizzo diverso.
            </div>
          ) : null}
          {success === "owner-created" ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#166534",
                lineHeight: 1.5,
              }}
            >
              Responsabile creato correttamente. La welcome email e stata inviata.
            </div>
          ) : null}
          {success === "owner-created-email-failed" ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                color: "#c2410c",
                lineHeight: 1.5,
              }}
            >
              Responsabile creato, ma la welcome email non e partita. Controlla
              RESEND_API_KEY, EMAIL_FROM e dominio mittente su Railway.
            </div>
          ) : null}
          <div
            className="dashboard-inline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <FormField label="Nome">
              <TextInput name="firstName" required />
            </FormField>

            <FormField label="Cognome">
              <TextInput name="lastName" required />
            </FormField>

            <FormField label="Email">
              <TextInput name="email" type="email" required />
            </FormField>

            <FormField label="Lingua">
              <Select name="language" defaultValue="it">
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="es">Espanol</option>
                <option value="fr">Francais</option>
              </Select>
            </FormField>
          </div>

          <div className="dashboard-form-actions">
            <PrimaryButton type="submit">Crea responsabile</PrimaryButton>
          </div>
        </form>
      </Panel>
    </SuperAdminFrame>
  );
}
