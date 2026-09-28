import { formatDocumentSize } from "@/lib/documents";
import { toggleDocumentActiveAction } from "../actions";
import { PopupAction } from "../popup-action";
import { DocumentFileLink } from "./document-file-link";
import { formatDateTime } from "../ui";

export type DocumentRowItem = {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  isActive: boolean;
  createdAt: Date;
  assignedToAll: boolean;
  assignedTo: { firstName: string; lastName: string } | null;
};

/**
 * The file's own name is the title.
 *
 * What people type in the title box is "Ggg" and "Hshsh" as often as not,
 * while the thing that actually identifies the document - CONTRATTO + SECCI -
 * was in grey underneath, broken across two lines, next to a size in megabytes
 * that nobody has ever used to decide whether to open something.
 */
function nameOf(document: DocumentRowItem) {
  const withoutExtension = document.fileName.replace(/\.[a-z0-9]+$/i, "").trim();

  return withoutExtension || document.title || document.fileName;
}

function extensionOf(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);

  return (match?.[1] ?? "FILE").toUpperCase().slice(0, 4);
}

function paletteFor(extension: string) {
  if (extension === "PDF") {
    return { background: "#fdecec", color: "#b91c1c" };
  }

  if (["JPG", "JPEG", "PNG", "HEIC", "WEBP", "GIF"].includes(extension)) {
    return { background: "#eaf4fd", color: "#1d4ed8" };
  }

  return { background: "#eef2ff", color: "#4338ca" };
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Rome",
  })
    .format(value)
    .replace(/\.$/, "");
}

export function DocumentRow({
  document,
  canOpen,
  canManage,
  showAudience = false,
}: {
  document: DocumentRowItem;
  canOpen: boolean;
  canManage: boolean;
  /** Only where the row is not already sitting under the person it belongs to. */
  showAudience?: boolean;
}) {
  const extension = extensionOf(document.fileName);
  const palette = paletteFor(extension);
  const name = nameOf(document);

  // Everything here is dropped when it is the ordinary case: an active
  // document inside its own person's folder says its date and nothing else.
  const meta = [
    document.isActive ? null : "Nascosto",
    showAudience
      ? document.assignedToAll
        ? "Tutto il team"
        : document.assignedTo
          ? `${document.assignedTo.firstName} ${document.assignedTo.lastName}`
          : null
      : null,
    document.title && document.title.trim() && document.title.trim() !== name
      ? document.title.trim()
      : null,
    shortDate(document.createdAt),
  ].filter(Boolean);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 12,
        padding: "11px 12px",
        borderRadius: 16,
        border: `1px solid ${document.isActive ? "#e9edf3" : "#fde68a"}`,
        background: document.isActive ? "#ffffff" : "#fffbeb",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 12,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.04em",
          ...palette,
        }}
      >
        {extension}
      </span>

      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <strong
          style={{
            fontSize: 14.5,
            letterSpacing: "-0.015em",
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </strong>
        <span
          style={{
            fontSize: 12,
            color: document.isActive ? "#64748b" : "#92400e",
            fontWeight: 680,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {meta.join(" · ")}
        </span>
      </span>

      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {canOpen ? (
          <DocumentFileLink documentId={document.id} mode="open" className="workbit-doc-open">
            Apri
          </DocumentFileLink>
        ) : null}

        {/* Everything that is not opening it lives behind the dots: it is the
            one thing anyone does here nearly every time. */}
        <PopupAction
          title={name}
          ariaLabel={`Altre azioni per ${name}`}
          triggerContent="⋯"
          className="workbit-doc-more"
        >
          <div style={{ display: "grid", gap: 10 }}>
            <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
              {document.fileName} · {formatDocumentSize(document.fileSize)}
              <br />
              Caricato il {formatDateTime(document.createdAt)}
            </span>

            {document.description ? (
              <span style={{ color: "#334155", fontSize: 14, lineHeight: 1.55 }}>
                {document.description}
              </span>
            ) : null}

            {canOpen ? (
              <DocumentFileLink
                documentId={document.id}
                mode="download"
                className="workbit-doc-sheet-action"
              >
                Scarica sul telefono
              </DocumentFileLink>
            ) : null}

            {canManage ? (
              <form action={toggleDocumentActiveAction}>
                <input type="hidden" name="documentId" value={document.id} />
                <input type="hidden" name="nextActive" value={document.isActive ? "0" : "1"} />
                <button type="submit" className="workbit-doc-sheet-action" style={{ width: "100%" }}>
                  {document.isActive ? "Nascondi al team" : "Rendi di nuovo visibile"}
                </button>
              </form>
            ) : null}
          </div>
        </PopupAction>
      </span>
    </div>
  );
}
