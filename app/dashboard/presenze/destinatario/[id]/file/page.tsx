import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { templateOf } from "@/lib/payroll/template";
import { templateAiEnabled } from "@/lib/payroll/template-ai";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../../../../billing-required";
import { getDashboardContext } from "../../../../context";
import { EmptyState, Panel } from "../../../../ui";
import { Quiet } from "../../../payroll-ui";
import { RecipientFile } from "../../../recipient-file";
import { recipientSample } from "../../../recipient-sample";

export const dynamic = "force-dynamic";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** The recipient's file on its own: how it comes out, and the three ways to change it. */
export default async function RecipientFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { role, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Il file">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER) redirect("/dashboard/presenze");

  const { id } = await params;
  const recipient = await prisma.payrollRecipient.findFirst({ where: { id, barId: activeBarId }, select: { id: true, name: true, template: true } });
  if (!recipient) redirect("/dashboard/presenze/impostazioni");
  const sample = await recipientSample(activeBarId);

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 560, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
      <Link href={`/dashboard/presenze/destinatario/${recipient.id}`} style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ {recipient.name}
      </Link>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>Il file</h1>
        <Quiet style={{ fontSize: 14.5 }}>Così lo riceve, con i dati di {MONTHS[sample.month - 1]}.</Quiet>
      </header>
      <RecipientFile recipientId={recipient.id} initial={templateOf(recipient.template)} sample={sample} aiEnabled={templateAiEnabled()} />
    </div>
  );
}
