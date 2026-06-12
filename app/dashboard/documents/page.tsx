import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewDocument, formatDocumentSize } from "@/lib/documents";
import { canManageTrainingAndDocuments } from "@/lib/permissions";
import { createDocumentAction, toggleDocumentActiveAction } from "../actions";
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
  StatusPill,
  TextArea,
  TextInput,
  formatDateTime,
} from "../ui";
import { PopupAction } from "../popup-action";

export default async function DashboardDocumentsPage() {
  const { session, role, activeBarId, billingStatus, features } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Documenti">
        <EmptyState message="Seleziona un locale attivo per gestire i documenti." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  if (!features.documents) {
    return (
      <Panel title="Documenti">
        <EmptyState message="Modulo documenti disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const canManage = canManageTrainingAndDocuments(role as Role);

  const [documents, recipients] = await Promise.all([
    prisma.document.findMany({
      where: {
        barId: activeBarId,
        ...(canManage
          ? {}
          : {
              isActive: true,
              OR: [{ assignedToAll: true }, { assignedToId: session.user.id }],
            }),
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        assignedToAll: true,
        assignedToId: true,
        isActive: true,
        createdAt: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    canManage
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
            role: {
              not: Role.OWNER,
            },
          },
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const visibleCount = documents.filter((document) =>
    canViewDocument(document, session.user.id, role)
  ).length;

  return (
    <Stack>
      <Panel
        title="Documenti"
        action={
          canManage ? (
            <PopupAction title="Nuovo documento" ariaLabel="Carica documento" closeOnSubmit>
              <form
                action={createDocumentAction}
                encType="multipart/form-data"
                style={{ display: "grid", gap: 16 }}
              >
                <div
                  className="dashboard-inline-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <FormField label="Titolo">
                    <TextInput name="title" placeholder="Contratto, procedura, informativa..." required />
                  </FormField>

                  <FormField label="Destinatari">
                    <Select name="audience" defaultValue="ALL">
                      <option value="ALL">Tutto il team</option>
                      <option value="USER">Dipendente specifico</option>
                    </Select>
                  </FormField>

                  <FormField label="Dipendente">
                    <Select name="assignedToId" defaultValue="">
                      <option value="">Nessuno</option>
                      {recipients.map((recipient) => (
                        <option key={recipient.user.id} value={recipient.user.id}>
                          {recipient.user.firstName} {recipient.user.lastName} - {recipient.user.role}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <FormField label="Descrizione">
                  <TextArea
                    name="description"
                    placeholder="Breve descrizione del documento, facoltativa."
                  />
                </FormField>

                <FormField label="File">
                  <input
                    type="file"
                    name="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    style={{
                      borderRadius: 16,
                      border: "1px solid #dbe3ee",
                      padding: "12px 14px",
                      fontSize: 15,
                      background: "#ffffff",
                      width: "100%",
                    }}
                  />
                </FormField>

                <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                  Dimensione massima consigliata: 8 MB.
                </p>

                <div className="dashboard-form-actions">
                  <PrimaryButton type="submit">Carica documento</PrimaryButton>
                </div>
              </form>
            </PopupAction>
          ) : null
        }
      >
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          {visibleCount} documenti visibili.
        </p>
      </Panel>

      {documents.length === 0 ? (
        <Panel title="Elenco documenti">
          <EmptyState message="Nessun documento disponibile." />
        </Panel>
      ) : (
        <Panel title="Elenco documenti" action={`${visibleCount} visibili`}>
          <ItemList scrollable>
            {documents.map((document) => {
              const audienceLabel = document.assignedToAll
                ? "Tutto il team"
                : document.assignedTo
                  ? `${document.assignedTo.firstName} ${document.assignedTo.lastName}`
                  : "Dipendente";

              const canOpen = canViewDocument(document, session.user.id, role);

              return (
                <ItemCard
                  key={document.id}
                  title={document.title}
                  subtitle={audienceLabel}
                  meta={
                    <>
                      {document.description ? `${document.description} - ` : ""}
                      {document.fileName} - {formatDocumentSize(document.fileSize)} -{" "}
                      {formatDateTime(document.createdAt)}
                    </>
                  }
                  footer={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <StatusPill label={document.isActive ? "Attivo" : "Disattivo"} tone={document.isActive ? "success" : "danger"} />

                      {canOpen ? (
                        <Link
                          href={`/api/documents/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "10px 14px",
                            borderRadius: 999,
                            background: "#0f172a",
                            color: "#fff",
                            textDecoration: "none",
                            fontWeight: 700,
                          }}
                        >
                          Apri
                        </Link>
                      ) : null}

                      {canManage ? (
                        <form action={toggleDocumentActiveAction}>
                          <input type="hidden" name="documentId" value={document.id} />
                          <input
                            type="hidden"
                            name="nextActive"
                            value={document.isActive ? "0" : "1"}
                          />
                          <PrimaryButton
                            type="submit"
                            tone={document.isActive ? "red" : "green"}
                          >
                            {document.isActive ? "Disattiva" : "Riattiva"}
                          </PrimaryButton>
                        </form>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </ItemList>
        </Panel>
      )}
    </Stack>
  );
}
