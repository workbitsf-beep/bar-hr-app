import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewDocument, formatDocumentSize, getDocumentPreviewKind } from "@/lib/documents";
import { canManageTrainingAndDocuments } from "@/lib/permissions";
import { deleteDocumentAction, toggleDocumentActiveAction } from "../actions";
import { getDashboardContext } from "../context";
import { DocumentComposeForm } from "./document-compose-form";
import {
  BillingRequiredState,
  EmptyState,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
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

  const folderMap = new Map<string, { key: string; label: string; documents: typeof filteredDocuments }>();
  folderMap.set("team", { key: "team", label: "Tutto il team", documents: [] });

  if (canManage) {
    for (const recipient of recipients) {
      folderMap.set(recipient.user.id, {
        key: recipient.user.id,
        label: `${recipient.user.firstName} ${recipient.user.lastName}`,
        documents: [],
      });
    }
  } else {
    folderMap.set(session.user.id, {
      key: session.user.id,
      label: `${session.user.firstName} ${session.user.lastName}`,
      documents: [],
    });
  }

  for (const document of filteredDocuments) {
    const folderKey = document.assignedToAll ? "team" : document.assignedToId ?? "unknown";
    const fallbackLabel = document.assignedTo
      ? `${document.assignedTo.firstName} ${document.assignedTo.lastName}`
      : "Dipendente";
    const folder = folderMap.get(folderKey) ?? { key: folderKey, label: fallbackLabel, documents: [] };
    folder.documents.push(document);
    folderMap.set(folderKey, folder);
  }

  const folders = Array.from(folderMap.values()).filter((folder) => folder.documents.length > 0);

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
          {filteredDocuments.length} documenti visibili.
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

      {folders.length === 0 ? (
        <Panel title="Cartelle documenti">
          <EmptyState message="Nessun documento disponibile." />
        </Panel>
      ) : (
        <Panel title="Cartelle documenti">
          <div className="dashboard-card-grid">
            {folders.map((folder) => (
              <div
                key={folder.key}
                className="dashboard-item-card"
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 16,
                  borderRadius: 22,
                  border: "1px solid var(--workbit-border)",
                  background: "linear-gradient(180deg, #ffffff 0%, #f7f3ff 100%)",
                  boxShadow: "0 14px 34px rgba(124, 58, 237, 0.10)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: "var(--workbit-navy)" }}>Cartella - {folder.label}</strong>
                    <div style={{ color: "var(--workbit-muted)", fontSize: 13 }}>
                      {folder.documents.length} documenti
                    </div>
                  </div>
                  <PopupAction
                    title={`Documenti - ${folder.label}`}
                    ariaLabel={`Apri documenti ${folder.label}`}
                    triggerContent="Apri"
                  >
                    <ItemList>
                      {folder.documents.map((document) => {
                        const audienceLabel = document.assignedToAll
                          ? "Tutto il team"
                          : document.assignedTo
                            ? `${document.assignedTo.firstName} ${document.assignedTo.lastName}`
                            : "Dipendente";
                        const canOpen = canViewDocument(document, session.user.id, role);
                        const previewKind = getDocumentPreviewKind(document.fileName, document.mimeType);

                        return (
                          <div
                            key={document.id}
                            className="dashboard-item-card"
                            style={{
                              position: "relative",
                              padding: "16px 48px 16px 16px",
                              borderRadius: 20,
                              display: "grid",
                              gap: 8,
                              background: "#ffffff",
                              border: "1px solid var(--workbit-border)",
                            }}
                          >
                            <span
                              aria-label={document.isActive ? "Documento attivo" : "Documento disattivato"}
                              title={document.isActive ? "Documento attivo" : "Documento disattivato"}
                              style={{
                                position: "absolute",
                                top: 12,
                                right: 12,
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: document.isActive ? "#dcfce7" : "#fee2e2",
                                color: document.isActive ? "#166534" : "#991b1b",
                                border: document.isActive ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                fontSize: 14,
                                fontWeight: 900,
                              }}
                            >
                              {document.isActive ? "✓" : "×"}
                            </span>
                            <strong style={{ color: "var(--workbit-navy)" }}>{document.title}</strong>
                            <div style={{ color: "#334155" }}>{audienceLabel}</div>
                            <div style={{ color: "var(--workbit-muted)", fontSize: 14 }}>
                              {document.description ? `${document.description} - ` : ""}
                              {document.fileName} - {formatDocumentSize(document.fileSize)} -{" "}
                              {formatDateTime(document.createdAt)}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              {canOpen ? (
                                <PopupAction
                                  title={document.title}
                                  ariaLabel={`Visualizza ${document.title}`}
                                  triggerContent="Visualizza"
                                >
                                  <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
                                    <div
                                      style={{
                                        borderRadius: 18,
                                        overflow: "auto",
                                        border: "1px solid #e2e8f0",
                                        background: "#f8fafc",
                                        height: "min(52dvh, 520px)",
                                        minHeight: 260,
                                        maxWidth: "100%",
                                      }}
                                    >
                                      {previewKind === "pdf" ? (
                                        <iframe
                                          title={document.title}
                                          src={`/api/documents/${document.id}`}
                                          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                                        />
                                      ) : previewKind === "word" || previewKind === "spreadsheet" ? (
                                        <iframe
                                          title={document.title}
                                          src={`/api/documents/${document.id}/preview`}
                                          sandbox=""
                                          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            minHeight: "100%",
                                            display: "grid",
                                            placeItems: "center",
                                            padding: 20,
                                            textAlign: "center",
                                            color: "#475569",
                                            lineHeight: 1.5,
                                          }}
                                        >
                                          <div style={{ display: "grid", gap: 8 }}>
                                            <strong style={{ color: "#0f172a", fontSize: 18 }}>
                                              Anteprima non disponibile
                                            </strong>
                                            <span>
                                              Questo formato richiede un&apos;app esterna. Usa Apri per consultarlo.
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="dashboard-form-actions" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
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
                                  <input type="hidden" name="nextActive" value={document.isActive ? "0" : "1"} />
                                  <PrimaryButton type="submit" tone={document.isActive ? "red" : "green"}>
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
                          </div>
                        );
                      })}
                    </ItemList>
                  </PopupAction>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Stack>
  );
}
