import Link from "next/link";
import { Role } from "@prisma/client";
import type { CSSProperties, ReactNode } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { DEFAULT_MESSAGE, LAYOUT_LABELS, templateOf } from "@/lib/payroll/template";
import { templateAiEnabled } from "@/lib/payroll/template-ai";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../../../billing-required";
import { getDashboardContext } from "../../../context";
import { PopupAction } from "../../../popup-action";
import { EmptyState, Panel } from "../../../ui";
import { deleteRecipientAction, saveRecipientFieldAction } from "../../actions";
import { ConsultantWizard } from "../../consultant-wizard";
import { Quiet, ROLE_LABELS, Sheet } from "../../payroll-ui";
import { recipientSample } from "../../recipient-sample";

export const dynamic = "force-dynamic";

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #f2f0f8", color: "#1f1b3a", fontSize: 16, textDecoration: "none" };
const value: CSSProperties = { marginLeft: "auto", color: "#8a85a3", fontSize: 15, textAlign: "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const chevron = <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18, flex: "0 0 auto" }}>›</span>;
const field: CSSProperties = { minHeight: 50, borderRadius: 14, border: "1px solid #e9e6f5", background: "#fbfaff", fontSize: 16, color: "#1f1b3a", padding: "0 14px", width: "100%", boxSizing: "border-box" };
const primary: CSSProperties = { minHeight: 50, borderRadius: 999, border: 0, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", fontSize: 15.5, fontWeight: 700, width: "100%", cursor: "pointer" };

function Line({ label, shown, first = false }: { label: string; shown: ReactNode; first?: boolean }) {
  return (
    <span style={{ ...row, borderTop: first ? 0 : row.borderTop }}>
      <span style={{ flex: "0 0 auto" }}>{label}</span>
      <span style={value}>{shown}</span>
      {chevron}
    </span>
  );
}

/** One row's popup: its boxes, then Salva. */
function FieldForm({ id, name, hint, children }: { id: string; name: string; hint?: string; children: ReactNode }) {
  return (
    <ActionForm action={saveRecipientFieldAction} success="Salvato" style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={name} />
      {children}
      {hint ? <Quiet style={{ fontSize: 13 }}>{hint}</Quiet> : null}
      <PendingButton type="submit" pendingLabel="Salvo…" style={primary}>
        Salva
      </PendingButton>
    </ActionForm>
  );
}

/** One recipient as a card of rows: who they are, where the mail goes, and what it carries. */
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
  // A new one: three short steps instead of the card.
  if (id === "nuovo") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", padding: "4px 4px 12px" }}>
        <ConsultantWizard sample={await recipientSample(activeBarId)} aiEnabled={templateAiEnabled()} />
      </div>
    );
  }

  const recipient = await prisma.payrollRecipient.findFirst({ where: { id, barId: activeBarId } });
  if (!recipient) {
    return (
      <Panel title="Consulente">
        <EmptyState message="Destinatario non trovato." />
      </Panel>
    );
  }

  const template = templateOf(recipient.template);
  const message = recipient.message ?? DEFAULT_MESSAGE;
  const initials = recipient.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 560, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
      <Link href="/dashboard/presenze/impostazioni" style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Impostazioni
      </Link>

      <PopupAction
        title="Chi è"
        ariaLabel="Cambia nome e ruolo"
        triggerRow={
          <span style={{ display: "grid", justifyItems: "center", gap: 4, padding: "4px 0 6px", textAlign: "center" }}>
            <span aria-hidden style={{ width: 60, height: 60, borderRadius: 999, background: "#f1eeff", color: "#4c1d95", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
              {initials}
            </span>
            <span style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.035em" }}>{recipient.name}</span>
            <Quiet style={{ fontSize: 14.5 }}>{ROLE_LABELS[recipient.role] ?? "Altro"}</Quiet>
          </span>
        }
      >
        <FieldForm id={recipient.id} name="who">
          <input name="name" required defaultValue={recipient.name} placeholder="Marco Bianchi o Studio Rossi" style={field} />
          <select name="role" defaultValue={recipient.role} style={field}>
            {Object.entries(ROLE_LABELS).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </FieldForm>
      </PopupAction>

      <Sheet>
        <PopupAction title="Email" ariaLabel="Cambia l'email" triggerRow={<Line first label="Email" shown={recipient.email} />}>
          <FieldForm id={recipient.id} name="email">
            <input name="email" type="email" required defaultValue={recipient.email} placeholder="paghe@studiorossi.it" style={field} />
          </FieldForm>
        </PopupAction>
        <PopupAction title="In copia" ariaLabel="Cambia chi è in copia" triggerRow={<Line label="In copia" shown={recipient.cc || "Nessuno"} />}>
          <FieldForm id={recipient.id} name="cc" hint="Fino a cinque indirizzi, separati da una virgola. Vuoto per nessuno.">
            <input name="cc" defaultValue={recipient.cc ?? ""} placeholder="segreteria@studiorossi.it" style={field} />
          </FieldForm>
        </PopupAction>
      </Sheet>

      <Sheet>
        <Link href={`/dashboard/presenze/destinatario/${recipient.id}/file`} style={{ ...row, borderTop: 0 }}>
          <span style={{ flex: "0 0 auto" }}>Il file</span>
          <span style={value}>
            {template.fileType === "xlsx" ? "Excel" : "CSV"} · {LAYOUT_LABELS[template.layout].title.toLowerCase()}
          </span>
          {chevron}
        </Link>
        <PopupAction title="Il messaggio" ariaLabel="Cambia il messaggio" triggerRow={<Line label="Il messaggio" shown={`“${message.split("\n")[0].slice(0, 40)}…”`} />}>
          <FieldForm
            id={recipient.id}
            name="message"
            hint={`Al posto di {nome}, {mese}, {locale}, {persone} e {firma} va quello del mese. Prima di mandarla la puoi sempre cambiare.`}
          >
            <textarea name="message" rows={8} defaultValue={message} style={{ ...field, padding: "12px 14px", lineHeight: 1.45, fontFamily: "inherit", resize: "vertical" }} />
          </FieldForm>
        </PopupAction>
        <PopupAction title="Promemoria" ariaLabel="Cambia il promemoria" triggerRow={<Line label="Promemoria" shown={recipient.sendDay ? `il ${recipient.sendDay} del mese` : "Nessuno"} />}>
          <FieldForm id={recipient.id} name="sendDay" hint="Quel giorno del mese dopo ti ricordiamo di mandare le presenze.">
            <select name="sendDay" defaultValue={recipient.sendDay ? String(recipient.sendDay) : ""} style={field}>
              <option value="">Nessun promemoria</option>
              {Array.from({ length: 28 }, (_, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  Il {index + 1} del mese dopo
                </option>
              ))}
            </select>
          </FieldForm>
        </PopupAction>
      </Sheet>

      <Sheet>
        <ActionForm action={deleteRecipientAction} style={{ display: "flex", justifyContent: "center" }}>
          <input type="hidden" name="id" value={recipient.id} />
          <PendingButton type="submit" pendingLabel="…" style={{ border: 0, background: "transparent", color: "#b3202f", fontSize: 15.5, cursor: "pointer", minHeight: 52, width: "100%" }}>
            Togli {recipient.name}
          </PendingButton>
        </ActionForm>
      </Sheet>
    </div>
  );
}
