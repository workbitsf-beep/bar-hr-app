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
  TextInput,
} from "../ui";

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
        <Panel title="Nuova persona">
          <form action={createEmployeeAction} style={{ display: "grid", gap: 16 }}>
            {error === "employee-exists" ? (
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
                Esiste gia un utente con questa email. Usa un indirizzo diverso.
              </div>
            ) : null}
            {success === "employee-created" ? (
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
                Account creato correttamente. La password temporanea automatica e stata inviata via email.
              </div>
            ) : null}
            {success === "employee-deleted" ? (
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
                Dipendente eliminato definitivamente dal database.
              </div>
            ) : null}
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
                <TextInput name="hourlyRate" type="number" step="0.01" placeholder="Facoltativa" />
              </FormField>
            </div>

            <div>
              <PrimaryButton type="submit">Crea account</PrimaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="Team attivo" action={`${members.length} persone`}>
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
