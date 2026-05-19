import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBoardNoteAction, deleteBoardNoteAction } from "../actions";
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
  formatDateTime,
} from "../ui";

export default async function DashboardBoardPage() {
  const { role, activeBarId, billingStatus } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Bacheca">
        <EmptyState message="Seleziona un locale attivo per usare la bacheca interna." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const notes = await prisma.note.findMany({
    where: {
      barId: activeBarId,
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return (
    <Stack>
      <Panel title="Nuovo messaggio">
        <form action={createBoardNoteAction} style={{ display: "grid", gap: 16 }}>
          <FormField label="Messaggio">
            <TextArea
              name="content"
              required
              placeholder="Aggiornamento servizio, briefing o comunicazione interna"
            />
          </FormField>

          {(role === Role.OWNER || role === Role.MANAGER) && (
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="isPinned" />
              Metti in evidenza
            </label>
          )}

          <div>
            <PrimaryButton type="submit">Pubblica</PrimaryButton>
          </div>
        </form>
      </Panel>

      <Panel title="Messaggi recenti" action={`${notes.length} messaggi`}>
        {notes.length === 0 ? (
          <EmptyState message="Nessun messaggio pubblicato al momento." />
        ) : (
          <ItemList scrollable>
            {notes.map((note) => (
              <ItemCard
                key={note.id}
                title={note.isPinned ? "Messaggio fissato" : "Messaggio"}
                subtitle={note.content}
                meta={`${note.author.firstName} ${note.author.lastName} - ${formatDateTime(note.createdAt)}`}
                footer={
                  <form action={deleteBoardNoteAction}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <PrimaryButton type="submit" tone="red">
                      Elimina messaggio
                    </PrimaryButton>
                  </form>
                }
              />
            ))}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
