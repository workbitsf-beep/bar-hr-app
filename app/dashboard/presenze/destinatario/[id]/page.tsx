import Link from "next/link";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { buildPayrollMonth } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth } from "@/lib/payroll/access";
import { DEFAULT_MESSAGE, defaultTemplate, templateOf, type PayrollMonthData } from "@/lib/payroll/template";
import { templateAiEnabled } from "@/lib/payroll/template-ai";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../../../billing-required";
import { getDashboardContext } from "../../../context";
import { RowsCard, softButton } from "../../../costi/cost-ui";
import { EmptyState, Panel } from "../../../ui";
import { deleteRecipientAction, saveRecipientAction } from "../../actions";
import { fieldLabel, inputStyle, ROLE_LABELS } from "../../payroll-ui";
import { ConsultantWizard } from "../../consultant-wizard";
import { TemplateEditor } from "../../template-editor";

export const dynamic = "force-dynamic";

/** One recipient: who they are, the mail they get, and the file the way their software wants it. */
export default async function RecipientPage({ params }: { params: Promise<{ id: string }> }) {
  const { role, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Consulente">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER) {
    return (
      <Panel title="Consulente">
        <EmptyState message="A chi mandare le presenze lo sceglie il titolare." />
      </Panel>
    );
  }

  const { id } = await params;
  const isNew = id === "nuovo";
  const recipient = isNew ? null : await prisma.payrollRecipient.findFirst({ where: { id, barId: activeBarId } });
  if (!isNew && !recipient) {
    return (
      <Panel title="Consulente">
        <EmptyState message="Destinatario non trovato." />
      </Panel>
    );
  }

  // The preview uses the venue's real month, a few people of it.
  const { year, month } = defaultPayrollMonth();
  const data = await buildPayrollMonth({ barId: activeBarId, month, year });
  const sample: PayrollMonthData = {
    month: data.month,
    year: data.year,
    venueName: data.venueName,
    legalName: data.legalName,
    vatNumber: data.vatNumber,
    people: data.people.slice(0, 4).map((person) => ({
      userId: person.userId,
      firstName: person.firstName,
      lastName: person.lastName,
      payrollCode: person.payrollCode,
      contractWeeklyHours: person.contractWeeklyHours,
      entries: person.entries,
    })),
  };

  // A new one: three short steps instead of the whole form.
  if (isNew) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", padding: "4px 4px 12px" }}>
        <ConsultantWizard sample={sample} aiEnabled={templateAiEnabled()} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 4, padding: "0 4px" }}>
        <Link href="/dashboard/presenze/impostazioni" style={{ fontSize: 13, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
          ‹ Impostazioni
        </Link>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>{recipient?.name ?? "Nuovo destinatario"}</h1>
      </header>

      <ActionForm action={saveRecipientAction} success="Salvato" style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="id" value={recipient?.id ?? ""} />
        <RowsCard>
          <div style={{ display: "grid", gap: 10, padding: "14px 15px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              <label style={fieldLabel}>
                Chi è
                <select name="role" defaultValue={recipient?.role ?? "consulente"} style={inputStyle}>
                  {Object.entries(ROLE_LABELS).map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldLabel}>
                Nome o studio
                <input name="name" required defaultValue={recipient?.name ?? ""} placeholder="Marco Bianchi o Studio Rossi" style={inputStyle} />
              </label>
              <label style={fieldLabel}>
                Email
                <input name="email" type="email" required defaultValue={recipient?.email ?? ""} placeholder="paghe@studiorossi.it" style={inputStyle} />
              </label>
              <label style={fieldLabel}>
                In copia (facoltativo)
                <input name="cc" defaultValue={recipient?.cc ?? ""} placeholder="segreteria@studiorossi.it" style={inputStyle} />
              </label>
              <label style={fieldLabel}>
                Promemoria il giorno
                <select name="sendDay" defaultValue={recipient?.sendDay ? String(recipient.sendDay) : isNew ? "2" : ""} style={inputStyle}>
                  <option value="">Nessun promemoria</option>
                  {Array.from({ length: 28 }, (_, index) => (
                    <option key={index + 1} value={String(index + 1)}>
                      {index + 1} del mese dopo
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label style={fieldLabel}>
              Testo della mail
              <textarea
                name="message"
                rows={6}
                defaultValue={recipient?.message ?? DEFAULT_MESSAGE}
                style={{ ...inputStyle, padding: "10px", lineHeight: 1.45, fontFamily: "inherit", resize: "vertical" }}
              />
            </label>
            <span style={{ fontSize: 12, color: "#7c7894" }}>
              Al posto di {"{nome}"}, {"{mese}"}, {"{locale}"}, {"{persone}"} e {"{firma}"} va quello del mese. Prima di mandarla la puoi sempre cambiare.
            </span>
          </div>
        </RowsCard>

        <RowsCard>
          <div style={{ padding: "14px 15px 4px", display: "grid", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 760 }}>Il file</span>
            <span style={{ fontSize: 13, color: "#7c7894" }}>Come lo vuole il programma paghe di {recipient?.name ?? "chi lo riceve"}.</span>
          </div>
          <TemplateEditor initial={recipient ? templateOf(recipient.template) : defaultTemplate()} sample={sample} aiEnabled={templateAiEnabled()} />
        </RowsCard>

        <div>
          <PendingButton
            type="submit"
            pendingLabel="Salvo…"
            style={{
              minHeight: 46,
              borderRadius: 999,
              border: 0,
              color: "#ffffff",
              background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
              boxShadow: "0 10px 22px rgba(124, 58, 237, 0.18)",
              fontSize: 14.5,
              fontWeight: 780,
              padding: "0 22px",
              cursor: "pointer",
            }}
          >
            Salva
          </PendingButton>
        </div>
      </ActionForm>

      {recipient ? (
        <ActionForm action={deleteRecipientAction} success="Destinatario tolto">
          <input type="hidden" name="id" value={recipient.id} />
          <PendingButton type="submit" pendingLabel="…" style={{ ...softButton, background: "transparent", color: "#b45309", border: "1px solid transparent" }}>
            Togli {recipient.name}
          </PendingButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
