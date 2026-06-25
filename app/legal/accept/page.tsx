import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { getSession } from "@/lib/auth";
import {
  getRequiredLegalDocumentsForUser,
  legalDocumentTypeLabels,
} from "@/lib/legal-documents";
import { acceptRequiredLegalDocumentsAction } from "../actions";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const error = normalizeParam(params.error);
  const documents = await getRequiredLegalDocumentsForUser(session.user.id);

  if (documents.length === 0) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 18,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top left, rgba(237,233,254,0.72), rgba(255,255,255,0.96) 42%, rgba(248,250,252,1) 100%)",
      }}
    >
      <section
        style={{
          width: "min(960px, 100%)",
          display: "grid",
          gap: 18,
          padding: "clamp(18px, 3vw, 28px)",
          borderRadius: 32,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,247,255,0.96) 100%)",
          border: "1px solid rgba(124, 58, 237, 0.12)",
          boxShadow: "0 24px 64px rgba(88, 28, 135, 0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <BrandLogo href="/dashboard" size={42} showIcon label="Workbit" />
          <span
            style={{
              borderRadius: 999,
              padding: "8px 12px",
              background: "#f3e8ff",
              color: "#4c1d95",
              fontWeight: 800,
              fontSize: 13,
              alignSelf: "center",
            }}
          >
            Azione richiesta
          </span>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: "clamp(30px, 5vw, 48px)", lineHeight: 1 }}>
            Documenti legali da approvare
          </h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.65 }}>
            Prima di continuare come titolare, consulta e accetta i documenti legali obbligatori
            di Workbit.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12, maxHeight: "min(52dvh, 560px)", overflowY: "auto", paddingRight: 4 }}>
          {documents.map((document) => (
            <details
              key={document.id}
              style={{
                borderRadius: 24,
                border: "1px solid rgba(124, 58, 237, 0.12)",
                background: "#ffffff",
                padding: 16,
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 900, color: "#0f172a" }}>
                {document.title} · {legalDocumentTypeLabels[document.type]} · v{document.version}.{document.revision}
              </summary>
              <div style={{ display: "grid", gap: 12, marginTop: 14, color: "#334155", lineHeight: 1.7 }}>
                {document.content ? (
                  <div style={{ whiteSpace: "pre-wrap" }}>{document.content}</div>
                ) : (
                  <p style={{ margin: 0, color: "#64748b" }}>Contenuto testuale non presente.</p>
                )}
                {document.fileName ? (
                  <Link
                    href={`/api/legal-documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#6d28d9", fontWeight: 800 }}
                  >
                    Apri PDF
                  </Link>
                ) : null}
              </div>
            </details>
          ))}
        </div>

        <form action={acceptRequiredLegalDocumentsAction} style={{ display: "grid", gap: 14 }}>
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: 16,
              borderRadius: 22,
              background: "#ffffff",
              border: "1px solid rgba(124, 58, 237, 0.12)",
              color: "#0f172a",
              fontWeight: 750,
              lineHeight: 1.45,
            }}
          >
            <input name="accepted" type="checkbox" required style={{ marginTop: 3 }} />
            <span>Dichiaro di aver letto e accettato i documenti legali di Workbit.</span>
          </label>

          {error === "required" ? (
            <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>
              Devi confermare la lettura e accettazione per continuare.
            </p>
          ) : null}

          <button
            type="submit"
            style={{
              minHeight: 52,
              borderRadius: 999,
              border: 0,
              background: "linear-gradient(135deg, #111827 0%, #4c1d95 100%)",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 16px 34px rgba(88, 28, 135, 0.18)",
            }}
          >
            Accetta e continua
          </button>
        </form>
      </section>
    </main>
  );
}
