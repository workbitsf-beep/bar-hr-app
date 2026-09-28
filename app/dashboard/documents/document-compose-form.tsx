"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDocumentSize } from "@/lib/documents";
import { IconButton, PrimaryButton, TextArea, TextInput } from "../ui";

type RecipientOption = {
  id: string;
  label: string;
};

type DocumentDraft = {
  id: string;
  title: string;
  description: string;
  assignedToAll: boolean;
  assignedToIds: string[];
  file: File | null;
  /** What the photo weighed before the browser shrank it, when it did. */
  originalSize: number | null;
};

const allowedDocumentExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "xlsm",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
]);

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic"]);

const documentAccept =
  ".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.jpg,.jpeg,.png,.webp,.heic,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,image/*";

/**
 * A phone photo of a contract is four or five megabytes, and the page used to
 * refuse anything over eight. Shrinking it here means the common case never
 * meets the limit, and the venue gets a document instead of an error.
 */
const COMPRESS_ABOVE_BYTES = 1_200_000;
const MAX_IMAGE_EDGE = 2200;

function createDraft(): DocumentDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    assignedToAll: true,
    assignedToIds: [],
    file: null,
    originalSize: null,
  };
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

function isAllowedDocumentFile(file: File | null) {
  if (!file) {
    return false;
  }

  return allowedDocumentExtensions.has(getFileExtension(file.name));
}

function nameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").trim();
}

function badgeFor(fileName: string) {
  const extension = getFileExtension(fileName).toUpperCase() || "FILE";

  if (extension === "PDF") {
    return { label: extension, background: "#fdecec", color: "#b91c1c" };
  }

  if (imageExtensions.has(extension.toLowerCase())) {
    return { label: extension, background: "#eaf4fd", color: "#1d4ed8" };
  }

  return { label: extension, background: "#eef2ff", color: "#4338ca" };
}

/**
 * Redraws the picture smaller and re-encodes it as JPEG. If anything in the
 * chain is unavailable - HEIC that the browser cannot decode, a blocked canvas -
 * the original is kept: a heavier upload beats a refused one.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!imageExtensions.has(getFileExtension(file.name)) || file.size <= COMPRESS_ABOVE_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.82)
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], `${nameWithoutExtension(file.name)}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function isDocumentDraftValid(draft: DocumentDraft) {
  return Boolean(
    draft.file &&
      isAllowedDocumentFile(draft.file) &&
      (draft.assignedToAll || draft.assignedToIds.length > 0)
  );
}

export function DocumentComposeForm({ recipients }: { recipients: RecipientOption[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DocumentDraft>(createDraft());
  const [queued, setQueued] = useState<DocumentDraft[]>([]);
  const [isPending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function acceptFile(picked: File | null | undefined) {
    if (!picked) {
      return;
    }

    setError("");
    setMessage("");

    if (!isAllowedDocumentFile(picked)) {
      setError("Carica un PDF, un Word, un Excel o una foto.");
      return;
    }

    setPreparing(true);

    try {
      const prepared = await shrinkImage(picked);

      setDraft((current) => ({
        ...current,
        file: prepared,
        originalSize: prepared.size === picked.size ? null : picked.size,
        // The file's own name is the name, unless the person has already
        // written one of their own.
        title: current.title.trim() ? current.title : nameWithoutExtension(prepared.name),
      }));
    } finally {
      setPreparing(false);
    }
  }

  function addToList() {
    setError("");
    setMessage("");

    if (!isDocumentDraftValid(draft)) {
      setError("Scegli il file e a chi è destinato.");
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
    setShowNote(false);
  }

  function saveAll() {
    setError("");
    setMessage("");

    const draftValid = isDocumentDraftValid(draft);
    const items = queued.concat(draftValid ? [draft] : []);

    if (items.length === 0) {
      setError("Scegli almeno un file da caricare.");
      return;
    }

    startTransition(async () => {
      try {
        for (const item of items) {
          if (!item.file) {
            continue;
          }

          const targetIds = item.assignedToAll ? [null] : item.assignedToIds;

          for (const targetId of targetIds) {
            const formData = new FormData();
            formData.set("title", item.title.trim() || nameWithoutExtension(item.file.name));
            formData.set("description", item.description);
            formData.set("audience", targetId ? "USER" : "ALL");
            formData.set("assignedToId", targetId ?? "");
            formData.set("file", item.file);
            const response = await fetch("/api/documents", {
              method: "POST",
              body: formData,
            });
            const payload = (await response.json().catch(() => null)) as
              | { ok?: boolean; message?: string }
              | null;

            if (!response.ok || payload?.ok === false) {
              throw new Error(payload?.message || "Impossibile caricare il documento.");
            }
          }
        }

        setQueued([]);
        setDraft(createDraft());
        setShowNote(false);
        setMessage(items.length === 1 ? "Documento caricato." : "Documenti caricati.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Impossibile caricare il documento.");
      }
    });
  }

  function toggleRecipient(recipientId: string) {
    setDraft((current) => {
      const selected = new Set(current.assignedToIds);

      if (selected.has(recipientId)) {
        selected.delete(recipientId);
      } else {
        selected.add(recipientId);
      }

      return {
        ...current,
        assignedToAll: false,
        assignedToIds: Array.from(selected),
      };
    });
  }

  function getAudienceLabel(item: DocumentDraft) {
    if (item.assignedToAll) {
      return "Tutto il team";
    }

    const labels = item.assignedToIds
      .map((id) => recipients.find((recipient) => recipient.id === id)?.label.split(" - ")[0])
      .filter(Boolean);

    if (labels.length === 0) {
      return "Nessun destinatario";
    }

    return labels.length === 1 ? labels[0] : `${labels.length} dipendenti`;
  }

  const readyCount = queued.length + (isDocumentDraftValid(draft) ? 1 : 0);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={documentAccept}
        style={{ display: "none" }}
        onChange={(event) => {
          void acceptFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(event) => {
          void acceptFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 16,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 16,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontWeight: 800,
          }}
        >
          ✓ {message}
        </div>
      ) : null}

      {queued.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 820,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Pronti da caricare · {queued.length}
          </span>

          {queued.map((item) => {
            const badge = badgeFor(item.file?.name ?? "");

            return (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "34px minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 11px",
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    display: "inline-grid",
                    placeItems: "center",
                    borderRadius: 10,
                    fontSize: 9,
                    fontWeight: 900,
                    background: badge.background,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setDraft(item);
                    setQueued((current) => current.filter((entry) => entry.id !== item.id));
                  }}
                  style={{
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    textAlign: "left",
                    display: "grid",
                    gap: 0,
                    minWidth: 0,
                    cursor: "pointer",
                  }}
                >
                  <strong
                    style={{
                      fontSize: 13,
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title.trim() || nameWithoutExtension(item.file?.name ?? "")}
                  </strong>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                    {getAudienceLabel(item)}
                  </span>
                </button>

                <IconButton
                  type="button"
                  onClick={() => setQueued((current) => current.filter((entry) => entry.id !== item.id))}
                  aria-label="Togli dalla lista"
                >
                  ×
                </IconButton>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* One question to start with, and the way in that did not exist: a bar's
          documents arrive on paper. */}
      {!draft.file ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={preparing}
              style={{
                display: "grid",
                gap: 7,
                justifyItems: "center",
                padding: "20px 12px",
                borderRadius: 18,
                border: "1px solid rgba(124, 58, 237, 0.42)",
                background: "#f3e8ff",
                color: "#4c1d95",
                fontWeight: 830,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>
                📄
              </span>
              Scegli un file
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={preparing}
              style={{
                display: "grid",
                gap: 7,
                justifyItems: "center",
                padding: "20px 12px",
                borderRadius: 18,
                border: "1.5px dashed #cbd5e1",
                background: "#f8fafc",
                color: "#0f172a",
                fontWeight: 830,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>
                📷
              </span>
              Scatta una foto
            </button>
          </div>

          <span
            style={{
              fontSize: 12,
              color: "#94a3b8",
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {preparing
              ? "Preparo il file…"
              : "PDF, Word, Excel o una foto del documento. Le foto vengono ridotte da sole."}
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "42px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 11,
              padding: "11px 12px",
              borderRadius: 16,
              border: "1px solid rgba(124, 58, 237, 0.42)",
              background: "#faf7ff",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 42,
                height: 42,
                display: "inline-grid",
                placeItems: "center",
                borderRadius: 12,
                fontSize: 10,
                fontWeight: 900,
                ...(() => {
                  const badge = badgeFor(draft.file.name);
                  return { background: badge.background, color: badge.color };
                })(),
              }}
            >
              {badgeFor(draft.file.name).label}
            </span>

            <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
              <strong
                style={{
                  fontSize: 14,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {draft.file.name}
              </strong>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: draft.originalSize ? 800 : 700,
                  color: draft.originalSize ? "#15803d" : "#64748b",
                }}
              >
                {draft.originalSize
                  ? `${formatDocumentSize(draft.originalSize)} → ${formatDocumentSize(draft.file.size)}, pronta`
                  : formatDocumentSize(draft.file.size)}
              </span>
            </span>

            <IconButton
              type="button"
              onClick={() => setDraft({ ...draft, file: null, originalSize: null })}
              aria-label="Togli il file"
            >
              ×
            </IconButton>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Nome</span>
            <TextInput
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>A chi</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {[
                { all: true, label: "Tutto il team" },
                { all: false, label: "Una persona" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      assignedToAll: option.all,
                      assignedToIds: option.all ? [] : draft.assignedToIds,
                    })
                  }
                  style={{
                    minHeight: 42,
                    borderRadius: 14,
                    border:
                      draft.assignedToAll === option.all
                        ? "1px solid rgba(124, 58, 237, 0.46)"
                        : "1px solid #e2e8f0",
                    background: draft.assignedToAll === option.all ? "#f3e8ff" : "#ffffff",
                    color: draft.assignedToAll === option.all ? "#4c1d95" : "#334155",
                    fontWeight: 820,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {!draft.assignedToAll ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {recipients.map((recipient) => {
                  const selected = draft.assignedToIds.includes(recipient.id);

                  return (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => toggleRecipient(recipient.id)}
                      style={{
                        padding: "8px 13px",
                        borderRadius: 999,
                        border: selected ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
                        background: selected ? "#f3e8ff" : "#ffffff",
                        color: selected ? "#4c1d95" : "#475569",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {recipient.label.split(" - ")[0]}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Almost nobody fills this in, so it does not get to take a third of
              the screen while they decide not to. */}
          {showNote ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Nota</span>
              <TextArea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                style={{ minHeight: 84 }}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              style={{
                justifySelf: "start",
                padding: "10px 13px",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                background: "transparent",
                color: "#64748b",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ＋ Aggiungi una nota
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={addToList}
          disabled={!isDocumentDraftValid(draft) || isPending}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            background: "transparent",
            color: isDocumentDraftValid(draft) ? "#4c1d95" : "#94a3b8",
            fontSize: 13,
            fontWeight: 820,
            cursor: isDocumentDraftValid(draft) ? "pointer" : "default",
          }}
        >
          + Aggiungi un altro
        </button>

        <PrimaryButton type="button" onClick={saveAll} disabled={isPending || readyCount === 0}>
          {isPending
            ? "Caricamento..."
            : readyCount > 1
              ? `Carica tutti (${readyCount})`
              : "Carica"}
        </PrimaryButton>
      </div>
    </div>
  );
}
