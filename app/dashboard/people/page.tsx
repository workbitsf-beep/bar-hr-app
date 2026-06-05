import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createEmployeeAction, removeEmployeeAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  SuccessCallout,
  TextInput,
} from "../ui";
import { PopupAction } from "../popup-action";

function formatRoleLabel(role: Role) {
  if (role === Role.OWNER) {
    return "Titolare";
  }

  if (role === Role.MANAGER) {
    return "Manager";
  }

  return "Dipendente";
}

export default async function DashboardPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { role, activeBarId, billingStatus } = await getDashboardContext();

  if (role !== Role.OWNER) {
    return (
      <Panel title="Personale">
        <EmptyState message="Solo i titolari possono creare e gestire il team." />
      </Panel>
    );
  }

  if (!activeBarId) {
    return (
      <Panel title="Personale">
        <EmptyState message="Seleziona un locale attivo per gestire il personale." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const members = await prisma.employeeBar.findMany({
    where: {
      barId: activeBarId,
      isActive: true,
    },
    orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          mustChangePwd: true,
        },
      },
    },
  });

  return (
    <>
      <Stack>
        {error === "employee-exists" ? (
          <SuccessCallout style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>
            Esiste gia un utente con questa email. Usa un indirizzo diverso.
          </SuccessCallout>
        ) : null}
        {success === "employee-created" ? (
          <SuccessCallout>Account creato correttamente. La password temporanea automatica e stata inviata via email.</SuccessCallout>
        ) : null}
        {success === "employee-deleted" ? (
          <SuccessCallout>Dipendente eliminato definitivamente dal database.</SuccessCallout>
        ) : null}

        <Panel
          title="Team attivo"
          action={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span>{members.length} persone</span>
              <PopupAction title="Nuova persona" ariaLabel="Aggiungi persona">
                <form action={createEmployeeAction} style={{ display: "grid", gap: 16 }}>
                  <div
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

                    <FormField label="Ruolo">
                      <Select name="role" defaultValue="EMPLOYEE">
                        <option value="OWNER">Titolare</option>
                        <option value="EMPLOYEE">Dipendente</option>
                        <option value="MANAGER">Manager</option>
                      </Select>
                    </FormField>

                    <FormField label="Paga oraria">
                      <TextInput
                        name="hourlyRate"
                        type="number"
                        step="0.01"
                        placeholder="Facoltativa"
                      />
                    </FormField>
                  </div>

                  <input type="hidden" name="notifySuccess" value="1" />

                  <div>
                    <PrimaryButton type="submit">Crea account</PrimaryButton>
                  </div>
                </form>
              </PopupAction>
            </div>
          }
        >
          {members.length === 0 ? (
            <EmptyState message="Nessuna persona collegata a questo locale." />
          ) : (
            <ItemList>
              {members.map((member) => (
                <ItemCard
                  key={member.id}
                  title={`${member.user.firstName} ${member.user.lastName}`}
                  subtitle={member.user.email}
                  meta={
                    <>
                      Ruolo: {formatRoleLabel(member.role)}
                      <br />
                      Password temporanea{" "}
                      {member.user.mustChangePwd ? "non ancora cambiata" : "gia aggiornata"}
                    </>
                  }
                  footer={
                    member.role !== Role.OWNER ? (
                      <form action={removeEmployeeAction}>
                        <input type="hidden" name="membershipId" value={member.id} />
                        <PrimaryButton type="submit" tone="red">
                          Rimuovi dal locale
                        </PrimaryButton>
                      </form>
                    ) : null
                  }
                />
              ))}
            </ItemList>
          )}
        </Panel>
      </Stack>
    </>
  );
}
