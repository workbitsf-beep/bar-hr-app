import { LegalDocumentType } from "@prisma/client";
import { getCompanyProfile } from "@/lib/company-profile";
import { CompanyProfileSection } from "./company-profile-section";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { legalDocumentTypeLabels } from "@/lib/legal-documents";
import { getDashboardContext } from "../../context";
import { Empty, Field, FieldGrid, Forbidden, Note, Section } from "../console-ui";
import { readParam } from "../console-data";
import { createLegalDocumentAction, deleteLegalDocumentAction, updateLegalDocumentAction } from "./actions";
import { ExternalLink } from "@/app/components/external-link";

type DocumentDefaults = {
  title: string;
  type: LegalDocumentType;
  version: string;
  content: string | null;
  fileName?: string | null;
  isActive: boolean;
  isRequired: boolean;
};

function DocumentFields({ document }: { document?: DocumentDefaults }) {
  return (
    <>
      <FieldGrid>
        <Field label="Titolo" span>
          <input name="title" required defaultValue={document?.title ?? ""} />
        </Field>
        <Field label="Tipo">
          <select name="type" defaultValue={document?.type ?? LegalDocumentType.PRIVACY_POLICY}>
            {Object.values(LegalDocumentType).map((type) => (
              <option key={type} value={type}>
                {legalDocumentTypeLabels[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Versione">
          <input name="version" required placeholder="1.0" defaultValue={document?.version ?? ""} />
        </Field>
      </FieldGrid>

      <Field
        label="Contenuto testuale"
        hint="È questo che compare sulla pagina pubblica: privacy e termini si pubblicano da qui."
      >
        <textarea name="content" defaultValue={document?.content ?? ""} />
      </Field>

      <Field
        label={document ? "Sostituisci PDF" : "PDF del documento"}
        hint={
          document?.fileName
            ? `PDF attuale: ${document.fileName}`
            : "Facoltativo: si aggiunge in fondo alla pagina come allegato scaricabile."
        }
      >
        <input name="pdfFile" type="file" accept="application/pdf" />
      </Field>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <label className="wbc-check">
          <input name="isActive" type="checkbox" defaultChecked={document?.isActive ?? true} />
          Attivo
        </label>
        <label className="wbc-check">
          <input name="isRequired" type="checkbox" defaultChecked={document?.isRequired ?? true} />
          Obbligatorio
        </label>
      </div>
    </>
  );
}

export default async function ConsoleLegalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const params = searchParams ? await searchParams : {};
  const success = readParam(params.success);

  const companyProfile = await getCompanyProfile();
  const documents = await prisma.legalDocument.findMany({
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      revision: true,
      content: true,
      fileName: true,
      isActive: true,
      isRequired: true,
      _count: { select: { acceptances: true } },
    },
  });

  return (
    <div className="wbc-page">
      <Link href="/dashboard/super-admin/system" className="wbc-back">
        ← Sistema
      </Link>

      <div className="wbc-page-head">
        <h1 className="wbc-title">Documenti legali</h1>
        <p className="wbc-desc">Privacy, termini e contratti che i titolari devono accettare per usare Workbit.</p>
      </div>

      {success ? (
        <div style={{ marginBottom: 4 }}>
          <Note tone="positive">Archivio aggiornato.</Note>
        </div>
      ) : null}

      <Section title="Dati societari e modelli">
        <CompanyProfileSection
          profile={companyProfile}
          existingTypes={documents.map((document) => document.type)}
        />
      </Section>

      <Section title={`Archivio · ${documents.length}`} flush>
        {documents.length === 0 ? (
          <Empty>Nessun documento caricato.</Empty>
        ) : (
          documents.map((document) => (
            <details key={document.id} className="wbc-doc">
              <summary>
                <span className="wbc-row-main">
                  <span className="wbc-row-title">{document.title}</span>
                  <span className="wbc-row-meta">
                    {legalDocumentTypeLabels[document.type]} · v{document.version}.{document.revision} ·{" "}
                    {document._count.acceptances} accettazioni
                    {document.isActive ? "" : " · disattivo"}
                    {document.isRequired ? " · obbligatorio" : ""}
                  </span>
                </span>
                <span className="wbc-row-chevron" aria-hidden="true">
                  ▾
                </span>
              </summary>

              <div style={{ display: "grid", gap: 16, paddingBottom: 18 }}>
                {document.fileName ? (
                  <ExternalLink
                    href={`/api/legal-documents/${document.id}`}
                    className="wbc-btn wbc-btn-ghost wbc-btn-sm"
                    style={{ justifySelf: "start" }}
                  >
                    Apri il PDF
                  </ExternalLink>
                ) : null}

                <form action={updateLegalDocumentAction} encType="multipart/form-data" style={{ display: "grid", gap: 15 }}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <DocumentFields document={document} />
                  <button type="submit" className="wbc-btn wbc-btn-primary">
                    Salva modifiche
                  </button>
                </form>

                <form action={deleteLegalDocumentAction}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <button type="submit" className="wbc-btn wbc-btn-danger wbc-btn-sm">
                    Elimina documento
                  </button>
                </form>
              </div>
            </details>
          ))
        )}
      </Section>

      <Section title="Nuovo documento">
        <form action={createLegalDocumentAction} encType="multipart/form-data" style={{ display: "grid", gap: 15 }}>
          <DocumentFields />
          <button type="submit" className="wbc-btn wbc-btn-primary">
            Crea documento
          </button>
        </form>
      </Section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
.wbc-doc { border-bottom: 1px solid var(--k-line); }
.wbc-doc > summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  cursor: pointer;
  list-style: none;
}
.wbc-doc > summary::-webkit-details-marker { display: none; }
.wbc-doc[open] > summary .wbc-row-chevron { transform: rotate(180deg); }
.wbc-doc > summary .wbc-row-chevron { transition: transform 160ms ease; font-size: 13px; }
          `,
        }}
      />
    </div>
  );
}
