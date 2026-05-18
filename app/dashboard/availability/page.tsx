import { prisma } from "@/lib/prisma";
import { createAvailabilityAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  TextArea,
  TextInput,
  formatDateTime,
} from "../ui";

export default async function DashboardAvailabilityPage() {
  const { session, activeBarId, billingStatus, role } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Indisponibilita">
        <EmptyState message="Seleziona un locale attivo per registrare le indisponibilita." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const availabilities = await prisma.availability.findMany({
    where: {
      barId: activeBarId,
    },
    orderBy: {
      startsAt: "asc",
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return (
    <>
      <Stack>
        <Panel title="Nuova indisponibilita">
          <form action={createAvailabilityAction} style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Da">
                <TextInput name="startsAt" type="datetime-local" required />
              </FormField>

              <FormField label="A">
                <TextInput name="endsAt" type="datetime-local" required />
              </FormField>
            </div>

            <FormField label="Motivo">
              <TextArea
                name="reason"
                placeholder="Facoltativo: esame, visita, evento personale"
              />
            </FormField>

            <div>
              <PrimaryButton type="submit">Salva indisponibilita</PrimaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="Calendario indisponibilita" action={`${availabilities.length} elementi`}>
          {availabilities.length === 0 ? (
            <EmptyState message="Nessuna indisponibilita registrata." />
          ) : (
            <ItemList>
              {availabilities.map((availability) => (
                <ItemCard
                  key={availability.id}
                  title={
                    availability.user.id === session.user.id
                      ? "La tua indisponibilita"
                      : `${availability.user.firstName} ${availability.user.lastName}`
                  }
                  subtitle={`${formatDateTime(availability.startsAt)} - ${formatDateTime(availability.endsAt)}`}
                  meta={availability.reason || "Nessuna nota aggiuntiva"}
                />
              ))}
            </ItemList>
          )}
        </Panel>
      </Stack>
    </>
  );
}
