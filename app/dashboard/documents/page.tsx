import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewDocument } from "@/lib/documents";
import { canManageDocuments } from "@/lib/permissions";
import { deleteDocumentAction } from "../actions";
import { getDashboardContext } from "../context";
import { SwipeRevealAction } from "../swipe-reveal-action";
import { DocumentComposeForm } from "./document-compose-form";
import { DocumentRow } from "./document-row";
import { BillingRequiredState, EmptyState, Panel, Stack } from "../ui";
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

  const canManage = canManageDocuments(role as Role);

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

  const visibleDocuments = documents.filter(
    (document) =>
      document.createdBy.id === session.user.id ||
      canViewDocument(document, session.user.id, role)
  );

  // A folder per person, and people with nothing in theirs are kept. Who is
  // missing a contract is the question that matters if an inspector turns up,
  // and an empty folder is the only way this page can answer it.
  const folderMap = new Map<
    string,
    { key: string; label: string; documents: typeof visibleDocuments }
  >();

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

  for (const document of visibleDocuments) {
    const folderKey = document.assignedToAll ? "team" : document.assignedToId ?? "unknown";
    const fallbackLabel = document.assignedTo
      ? `${document.assignedTo.firstName} ${document.assignedTo.lastName}`
      : "Dipendente";
    const folder = folderMap.get(folderKey) ?? { key: folderKey, label: fallbackLabel, documents: [] };
    folder.documents.push(document);
    folderMap.set(folderKey, folder);
  }

  const folders = Array.from(folderMap.values()).filter(
    (folder) => canManage || folder.documents.length > 0
  );

  const myDocuments = visibleDocuments;

  function renderDocument(document: (typeof documents)[number], showAudience: boolean) {
    const canDeleteDocument = canManage || document.createdBy.id === session.user.id;

    return (
      <SwipeRevealAction
        key={document.id}
        enabled={Boolean(canDeleteDocument)}
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
        <DocumentRow
          document={document}
          canOpen={canViewDocument(document, session.user.id, role)}
          canManage={canManage}
          showAudience={showAudience}
        />
      </SwipeRevealAction>
    );
  }

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
        {/* For an owner the page is the people, because the question here is
            whose folder is missing something. An employee only ever sees their
            own, so a list of one person would be a door to nowhere: they get
            the documents straight away. */}
        {canManage ? (
          folders.length === 0 ? (
            <EmptyState message="Nessun documento caricato." />
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {folders.map((folder) => {
                const hiddenCount = folder.documents.filter((item) => !item.isActive).length;
                const isTeam = folder.key === "team";
                const initials = isTeam
                  ? "👥"
                  : folder.label
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("");

                const summary =
                  folder.documents.length === 0
                    ? "Nessun documento"
                    : folder.documents
                        .slice(0, 3)
                        .map((item) => item.fileName.replace(/\.[a-z0-9]+$/i, ""))
                        .join(" · ");

                return (
                  <div
                    key={folder.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: 11,
                      padding: "11px 12px",
                      borderRadius: 16,
                      border: `1px solid ${folder.documents.length === 0 ? "#fde68a" : "#e9edf3"}`,
                      background: folder.documents.length === 0 ? "#fffbeb" : "#ffffff",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 38,
                        height: 38,
                        display: "inline-grid",
                        placeItems: "center",
                        borderRadius: 999,
                        background: folder.documents.length === 0 ? "#ffffff" : "#f3e8ff",
                        color: "#4c1d95",
                        fontSize: isTeam ? 16 : 12.5,
                        fontWeight: 850,
                      }}
                    >
                      {initials}
                    </span>

                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 14.5, color: "#0f172a", letterSpacing: "-0.015em" }}>
                        {folder.label}
                      </strong>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: folder.documents.length === 0 ? "#92400e" : "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {summary}
                        {hiddenCount > 0 ? ` · ${hiddenCount} nascosto` : ""}
                      </span>
                    </span>

                    {folder.documents.length === 0 ? (
                      <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 800 }}>—</span>
                    ) : (
                      <PopupAction
                        title={folder.label}
                        ariaLabel={`Apri documenti di ${folder.label}`}
                        triggerContent={`Apri ${folder.documents.length}`}
                      >
                        <div style={{ display: "grid", gap: 9 }}>
                          {folder.documents.map((document) => renderDocument(document, false))}
                        </div>
                      </PopupAction>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : myDocuments.length === 0 ? (
          <EmptyState message="Nessun documento disponibile." />
        ) : (
          <div style={{ display: "grid", gap: 9 }}>
            {myDocuments.map((document) => renderDocument(document, true))}
          </div>
        )}
      </Panel>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .workbit-doc-open {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              height: 34px;
              padding: 0 15px;
              border-radius: 999px;
              background: var(--workbit-gradient);
              color: #ffffff;
              font-weight: 830;
              font-size: 12.5px;
              text-decoration: none;
              white-space: nowrap;
            }

            .workbit-doc-more {
              width: 34px !important;
              min-width: 34px !important;
              height: 34px !important;
              font-size: 17px !important;
              color: #94a3b8 !important;
              background: #ffffff !important;
              border-color: #e9edf3 !important;
              box-shadow: none !important;
            }

            .workbit-doc-sheet-action {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 46px;
              padding: 0 18px;
              border-radius: 16px;
              border: 1px solid rgba(124, 58, 237, 0.18);
              background: #f8fafc;
              color: #4c1d95;
              font-weight: 800;
              font-size: 14px;
              text-decoration: none;
              cursor: pointer;
            }
          `,
        }}
      />
    </Stack>
  );
}
