import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewDocument, formatDocumentSize } from "@/lib/documents";
import { canManageTrainingAndDocuments } from "@/lib/permissions";
import { deleteDocumentAction, toggleDocumentActiveAction } from "../actions";
import { getDashboardContext } from "../context";
import { DocumentComposeForm } from "./document-compose-form";
import {
  BillingRequiredState,
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  StatusPill,
  formatDateTime,
} from "../ui";
import { PopupAction } from "../popup-action";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function DashboardDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const employeeFilter = normalizeParam(params.employee);
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
      take: 100,
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

  const filteredDocuments = documents.filter((document) => {
    if (!canViewDocument(document, session.user.id, role)) {
      return false;
    }

    if (!employeeFilter) {
      return true;
    }

    if (employeeFilter === "team") {
      return document.assignedToAll;
    }

    return document.assignedToId === employeeFilter;
  });
  const visibleCount = filteredDocuments.length;

  return (
    <Stack>
      <Panel
        title="Documenti"
        action={
          canManage ? (
            <PopupAction title="Nuovo documento" ariaLabel="Carica documento">
              <DocumentComposeForm
                recipients={recipients.map((recipient) => ({
                  id: recipient.user.id,
                  label: `${recipient.user.firstName} ${recipient.user.lastName} - ${recipient.user.role}`,
                }))}
              />
            </PopupAction>
          ) : null
        }
      >
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          {visibleCount} documenti visibili.
        </p>
        {canManage ? (
          <form action="/dashboard/documents" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Select name="employee" defaultValue={employeeFilter} style={{ maxWidth: 260 }}>
              <option value="">Tutti i documenti</option>
              <option value="team">Tutto il team</option>
              {recipients.map((recipient) => (
                <option key={recipient.user.id} value={recipient.user.id}>
                  {recipient.user.firstName} {recipient.user.lastName}
                </option>
              ))}
            </Select>
            <PrimaryButton type="submit" tone="sand">
              Filtra
            </PrimaryButton>
          </form>
        ) : null}
      </Panel>

      {filteredDocuments.length === 0 ? (
        <Panel title="Elenco documenti">
          <EmptyState message="Nessun documento disponibile." />
        </Panel>
      ) : (
        <Panel title="Elenco documenti" action={`${visibleCount} visibili`}>
          <ItemList>
            {filteredDocuments.map((document) => {
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
                        <PopupAction
                          title={document.title}
                          ariaLabel={`Visualizza ${document.title}`}
                          triggerContent="Visualizza"
                        >
                          <div style={{ display: "grid", gap: 12 }}>
                            <div
                              style={{
                                borderRadius: 18,
                                overflow: "hidden",
                                border: "1px solid #e2e8f0",
                                background: "#f8fafc",
                                minHeight: "min(68dvh, 620px)",
                              }}
                            >
                              <iframe
                                title={document.title}
                                src={`/api/documents/${document.id}`}
                                style={{ width: "100%", height: "min(68dvh, 620px)", border: 0 }}
                              />
                            </div>
                            <div className="dashboard-form-actions">
                              <PrimaryButton type="button" tone="sand" data-popup-close>
                                Chiudi
                              </PrimaryButton>
                              <Link
                                href={`/api/documents/${document.id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: 38,
                                  padding: "0 14px",
                                  borderRadius: 999,
                                  background: "var(--workbit-gradient)",
                                  color: "#fff",
                                  textDecoration: "none",
                                  fontWeight: 800,
                                }}
                              >
                                Apri
                              </Link>
                            </div>
                          </div>
                        </PopupAction>
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
                      {canManage ? (
                        <form action={deleteDocumentAction}>
                          <input type="hidden" name="documentId" value={document.id} />
                          <PrimaryButton type="submit" tone="red">
                            Elimina
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
