import { LegalDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { legalDocumentTypeLabels } from "@/lib/legal-documents";
import { getDashboardContext } from "../../context";
import { EmptyState, FormField, Panel, PrimaryButton, Select, Stack, StatusPill, TextArea, TextInput } from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import {
  createLegalDocumentAction,
  deleteLegalDocumentAction,
  updateLegalDocumentAction,
} from "./actions";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function LegalDocumentFields({
  document,
}: {
  document?: {
    title: string;
    type: LegalDocumentType;
    version: string;
    content: string | null;
    fileUrl: string | null;
    isActive: boolean;
    isRequired: boolean;
  };
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="dashboard-inline-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <FormField label="Titolo">
          <TextInput name="title" required defaultValue={document?.title ?? ""} />
        </FormField>
        <FormField label="Tipo">
          <Select name="type" defaultValue={document?.type ?? LegalDocumentType.PRIVACY_POLICY}>
            {Object.values(LegalDocumentType).map((type) => (
              <option key={type} value={type}>
                {legalDocumentTypeLabels[type]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Versione">
          <TextInput name="version" required placeholder="1.0" defaultValue={document?.version ?? ""} />
        </FormField>
      </div>

      <FormField label="Contenuto testuale">
        <TextArea name="content" defaultValue={document?.content ?? ""} style={{ minHeight: 180 }} />
      </FormField>

      <FormField label="PDF o link">
        <TextInput name="fileUrl" type="url" placeholder="https://..." defaultValue={document?.fileUrl ?? ""} />
      </FormField>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#0f172a" }}>
          <input name="isActive" type="checkbox" defaultChecked={document?.isActive ?? true} />
          Attivo
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#0f172a" }}>
          <input name="isRequired" type="checkbox" defaultChecked={document?.isRequired ?? true} />
          Obbligatorio
        </label>
      </div>
    </div>
  );
}

export default async function SuperAdminLegalDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = normalizeParam(params.success);
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const documents = await prisma.legalDocument.findMany({
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: { acceptances: true },
      },
    },
  });

  return (
    <SuperAdminFrame
      title="Documenti legali"
      description="Policy, contratti e accettazioni obbligatorie per i titolari."
    >
      <Stack columns="minmax(0, 420px) minmax(0, 1fr)">
        <Panel title="Nuovo documento">
          <form action={createLegalDocumentAction} style={{ display: "grid", gap: 14 }}>
            <LegalDocumentFields />
            <PrimaryButton type="submit">Crea documento</PrimaryButton>
          </form>
        </Panel>

        <Panel
          title="Archivio legale"
          action={success ? <StatusPill tone="success" label="Salvato" /> : null}
        >
          {documents.length === 0 ? (
            <EmptyState message="Nessun documento legale caricato." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {documents.map((document) => (
                <details
                  key={document.id}
                  style={{
                    padding: 16,
                    borderRadius: 24,
                    background: "#ffffff",
                    border: "1px solid rgba(124, 58, 237, 0.12)",
                  }}
                >
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong style={{ color: "#0f172a", fontSize: 17 }}>{document.title}</strong>
                        <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                          {legalDocumentTypeLabels[document.type]} · v{document.version} · {document._count.acceptances} accettazioni
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <StatusPill label={document.isActive ? "Attivo" : "Disattivo"} tone={document.isActive ? "success" : "neutral"} />
                        <StatusPill label={document.isRequired ? "Obbligatorio" : "Facoltativo"} tone={document.isRequired ? "warning" : "neutral"} />
                      </div>
                    </div>
                  </summary>

                  <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                    <form action={updateLegalDocumentAction} style={{ display: "grid", gap: 14 }}>
                      <input type="hidden" name="documentId" value={document.id} />
                      <LegalDocumentFields document={document} />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <PrimaryButton type="submit">Salva modifiche</PrimaryButton>
                      </div>
                    </form>
                    <form action={deleteLegalDocumentAction} style={{ display: "flex", justifyContent: "flex-end" }}>
                      <input type="hidden" name="documentId" value={document.id} />
                      <PrimaryButton type="submit" tone="red">
                        Elimina documento
                      </PrimaryButton>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </Panel>
      </Stack>
    </SuperAdminFrame>
  );
}
