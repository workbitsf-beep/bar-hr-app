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

export default async function DashboardPeoplePage() {
  const { role, activeBarId, billingStatus } = await getDashboardContext();

  if (role !== Role.OWNER) {
    return (
      <Panel title="Persone">
        <EmptyState message="Solo il titolare puo creare e gestire dipendenti e manager." />
      </Panel>
    );
  }

  if (!activeBarId) {
    return (
      <Panel title="Persone">
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

              <FormField label="Password iniziale">
                <TextInput name="initialPassword" type="text" required />
              </FormField>

              <FormField label="Ruolo">
                <Select name="role" defaultValue="EMPLOYEE">
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
                      Ruolo: {member.role}
                      <br />
                      Password iniziale {member.user.mustChangePwd ? "non ancora cambiata" : "gia aggiornata"}
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
