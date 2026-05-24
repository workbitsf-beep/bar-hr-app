import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBarBySuperAdminAction } from "../../actions";
import { getDashboardContext } from "../../context";
import {
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Select,
  TextInput,
} from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminBarsPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const owners = await prisma.user.findMany({
    where: {
      role: Role.OWNER,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  return (
    <SuperAdminFrame
      title="Strutture"
      description="Crea una nuova struttura e collegala al responsabile corretto."
    >
      <Panel title="Crea struttura">
        {owners.length === 0 ? (
          <EmptyState message="Crea prima almeno un responsabile da associare alla nuova struttura." />
        ) : (
          <form action={createBarBySuperAdminAction} style={{ display: "grid", gap: 16 }}>
            <div
              className="dashboard-inline-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Nome struttura">
                <TextInput name="name" required />
              </FormField>

              <FormField label="Email struttura">
                <TextInput name="email" type="email" />
              </FormField>

              <FormField label="Telefono">
                <TextInput name="phone" />
              </FormField>

              <FormField label="Indirizzo">
                <TextInput name="addressLine1" />
              </FormField>

              <FormField label="Citta">
                <TextInput name="city" />
              </FormField>

              <FormField label="CAP">
                <TextInput name="postalCode" />
              </FormField>

              <FormField label="Categoria attivita">
                <Select name="activityType" defaultValue="RESTAURANT">
                  <option value="RESTAURANT">Ristorazione</option>
                  <option value="COMPANY">Azienda</option>
                </Select>
              </FormField>

              <FormField label="Responsabile">
                <Select name="ownerId" required defaultValue="">
                  <option value="" disabled>
                    Seleziona responsabile
                  </option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.firstName} {owner.lastName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Crea struttura</PrimaryButton>
            </div>
          </form>
        )}
      </Panel>
    </SuperAdminFrame>
  );
}
