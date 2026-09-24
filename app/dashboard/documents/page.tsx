import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewDocument, formatDocumentSize } from "@/lib/documents";
import { canManageTrainingAndDocuments } from "@/lib/permissions";
import { deleteDocumentAction, toggleDocumentActiveAction } from "../actions";
import { getDashboardContext } from "../context";
import { ExternalLink } from "@/app/components/external-link";
import { SwipeRevealAction } from "../swipe-reveal-action";
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
              OR: [
                { createdById: session.user.id },
                { isActive: true, assignedToAll: true },
                { isActive: true, assignedToId: session.user.id },
              ],
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
            id: true,
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
    if (document.createdBy.id === session.user.id) {
      return true;
    }

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
    <Stack className="workbit-documents-page">
      <Panel
        title="Documenti"
        className="workbit-documents-overview"
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
        <p className="workbit-documents-count" style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          {filteredDocuments.length} documenti visibili
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
        <Panel title="Cartelle" className="workbit-document-folders-panel">
          <EmptyState message="Nessun documento disponibile." />
        </Panel>
      ) : (
        <Panel title="Cartelle" className="workbit-document-folders-panel">
          <div className="dashboard-card-grid workbit-document-folder-grid">
            {folders.map((folder) => (
              <div
                key={folder.key}
                className="dashboard-item-card workbit-document-folder-card"
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
                <div className="workbit-document-folder-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <span className="workbit-document-folder-icon" aria-hidden="true">📁</span>
                  <div className="workbit-document-folder-copy" style={{ minWidth: 0 }}>
                    <strong style={{ color: "var(--workbit-navy)" }}>{folder.label}</strong>
                    <div style={{ color: "var(--workbit-muted)", fontSize: 13 }}>
                      {folder.documents.length} documenti
                    </div>
                  </div>
                  <div className="workbit-document-folder-open">
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
                        const canDeleteDocument = canManage || document.createdBy.id === session.user.id;

                        return (
                          <SwipeRevealAction
                            key={document.id}
                            enabled={canDeleteDocument}
                            action={
                              <form action={deleteDocumentAction}>
                                <input type="hidden" name="documentId" value={document.id} />
                                <button
                                  type="submit"
                                  aria-label="Elimina documento"
                                  style={{
                                    width: 54,
                                    height: 54,
                                    borderRadius: 18,
                                    border: "1px solid #fecaca",
                                    background: "#ef4444",
                                    color: "#ffffff",
                                    fontWeight: 900,
                                    cursor: "pointer",
                                  }}
                                >
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path
                                      d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
                                      stroke="currentColor"
                                      strokeWidth="1.9"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              </form>
                            }
                          >
                            <div
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
                            <div className="workbit-doc-actions">
                              {canOpen ? (
                                <>
                                  <ExternalLink href={`/api/documents/${document.id}`} className="workbit-doc-open">
                                    Apri
                                  </ExternalLink>
                                  <Link
                                    href={`/api/documents/${document.id}?download=1`}
                                    className="workbit-doc-icon"
                                    aria-label="Scarica il documento"
                                    title="Scarica"
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                      <path
                                        d="M12 4v11m0 0 4.2-4.2M12 15l-4.2-4.2M5 19h14"
                                        stroke="currentColor"
                                        strokeWidth="1.9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </Link>
                                </>
                              ) : null}

                              {canManage ? (
                                <form action={toggleDocumentActiveAction}>
                                  <input type="hidden" name="documentId" value={document.id} />
                                  <input type="hidden" name="nextActive" value={document.isActive ? "0" : "1"} />
                                  <button
                                    type="submit"
                                    className="workbit-doc-icon"
                                    aria-label={document.isActive ? "Nascondi il documento" : "Rendi di nuovo visibile"}
                                    title={document.isActive ? "Nascondi" : "Rendi visibile"}
                                  >
                                    {document.isActive ? (
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path
                                          d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.4 5.4A9.8 9.8 0 0 1 12 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.8 3.5M6.5 6.9C4.4 8.3 3 10.4 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    ) : (
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path
                                          d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          strokeLinejoin="round"
                                        />
                                        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                                      </svg>
                                    )}
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                          </SwipeRevealAction>
                        );
                      })}
                    </ItemList>
                    </PopupAction>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .workbit-doc-actions {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-top: 4px;
            }

            .workbit-doc-open {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              height: 38px;
              padding: 0 18px;
              border-radius: 999px;
              background: var(--workbit-gradient);
              color: #ffffff;
              font-weight: 800;
              font-size: 14px;
              text-decoration: none;
              white-space: nowrap;
            }

            .workbit-doc-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 38px;
              height: 38px;
              flex: 0 0 auto;
              padding: 0;
              border-radius: 999px;
              border: 1px solid rgba(124, 58, 237, 0.18);
              background: #f8fafc;
              color: #4c1d95;
              cursor: pointer;
            }
          `,
        }}
      />
    </Stack>
  );
}
