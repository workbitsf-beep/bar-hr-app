import "server-only";

import { sendEmail, type SendEmailResult } from "@/lib/email/resend";
import { buildEmailTemplate } from "@/lib/email/templates";

function getAppUrl(path: string) {
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function sendTemplatedEmail(input: {
  to: string;
  subject: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: buildEmailTemplate({
      title: input.title,
      message: input.message,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
    }),
  });
}

export async function sendWeeklyShiftsPublishedEmail(
  userEmail: string,
  userName: string,
  barName: string,
  weekLabel: string
) {
  return sendTemplatedEmail({
    to: userEmail,
    subject: `Turni pubblicati - ${barName}`,
    title: "Turni confermati",
    message: `Ciao ${userName},\nSono stati pubblicati o aggiornati i tuoi turni della settimana ${weekLabel} per ${barName}.`,
    ctaLabel: "Apri i turni",
    ctaUrl: getAppUrl("/dashboard/shifts"),
  });
}

export async function sendShiftSwapRequestEmail(
  toEmail: string,
  toName: string,
  requesterName: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: toEmail,
    subject: `Nuova richiesta cambio turno - ${barName}`,
    title: "Richiesta cambio turno",
    message: `Ciao ${toName},\n${requesterName} ha inviato una richiesta di cambio turno per ${barName}.`,
    ctaLabel: "Apri richieste",
    ctaUrl: getAppUrl("/dashboard/requests"),
  });
}

export async function sendShiftSwapResultEmail(
  toEmail: string,
  toName: string,
  approved: boolean,
  barName: string
) {
  return sendTemplatedEmail({
    to: toEmail,
    subject: `${approved ? "Cambio turno approvato" : "Cambio turno rifiutato"} - ${barName}`,
    title: approved ? "Cambio turno approvato" : "Cambio turno rifiutato",
    message: `Ciao ${toName},\nLa richiesta di cambio turno per ${barName} e stata ${approved ? "approvata" : "rifiutata"}.`,
    ctaLabel: "Apri richieste",
    ctaUrl: getAppUrl("/dashboard/requests"),
  });
}

export async function sendLeaveRequestEmail(
  ownerEmail: string,
  employeeName: string,
  type: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: ownerEmail,
    subject: `Nuova richiesta ${type} - ${barName}`,
    title: `Nuova richiesta ${type}`,
    message: `${employeeName} ha inviato una richiesta di ${type} per ${barName}.`,
    ctaLabel: "Apri richieste",
    ctaUrl: getAppUrl("/dashboard/requests"),
  });
}

export async function sendLeaveRequestResultEmail(
  employeeEmail: string,
  approved: boolean,
  type: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: employeeEmail,
    subject: `Richiesta ${type} ${approved ? "approvata" : "rifiutata"} - ${barName}`,
    title: approved ? `${type} approvati` : `${type} rifiutati`,
    message: `La tua richiesta di ${type} per ${barName} e stata ${approved ? "approvata" : "rifiutata"}.`,
    ctaLabel: "Apri richieste",
    ctaUrl: getAppUrl("/dashboard/requests"),
  });
}

export async function sendNoticeBoardEmail(
  toEmail: string,
  toName: string,
  authorName: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: toEmail,
    subject: `Nuovo messaggio in bacheca - ${barName}`,
    title: "Nuovo messaggio in bacheca",
    message: `Ciao ${toName},\n${authorName} ha pubblicato un nuovo messaggio nella bacheca di ${barName}.`,
    ctaLabel: "Apri bacheca",
    ctaUrl: getAppUrl("/dashboard/board"),
  });
}

export async function sendUnavailabilityEmail(
  toEmail: string,
  employeeName: string,
  barName: string,
  dateLabel: string
) {
  return sendTemplatedEmail({
    to: toEmail,
    subject: `Nuova indisponibilita - ${barName}`,
    title: "Nuova indisponibilita",
    message: `${employeeName} ha registrato un'indisponibilita per ${dateLabel} in ${barName}.`,
    ctaLabel: "Apri calendario",
    ctaUrl: getAppUrl("/dashboard/calendar"),
  });
}

export async function sendTaskAssignedEmail(
  toEmail: string,
  toName: string,
  taskTitle: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: toEmail,
    subject: `Nuova mansione assegnata - ${barName}`,
    title: "Nuova mansione",
    message: `Ciao ${toName},\nTi e stata assegnata una nuova mansione: ${taskTitle}.\nLocale: ${barName}.`,
    ctaLabel: "Apri mansioni",
    ctaUrl: getAppUrl("/dashboard/tasks"),
  });
}

export async function sendSubscriptionActivatedEmail(
  ownerEmail: string,
  ownerName: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: ownerEmail,
    subject: `Abbonamento attivato - ${barName}`,
    title: "Abbonamento attivo",
    message: `Ciao ${ownerName},\nL'abbonamento del locale ${barName} e ora attivo.`,
    ctaLabel: "Apri dashboard",
    ctaUrl: getAppUrl("/dashboard"),
  });
}

export async function sendSubscriptionCanceledEmail(
  ownerEmail: string,
  ownerName: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: ownerEmail,
    subject: `Abbonamento cancellato - ${barName}`,
    title: "Abbonamento cancellato",
    message: `Ciao ${ownerName},\nL'abbonamento del locale ${barName} e stato cancellato o disattivato.`,
    ctaLabel: "Gestisci billing",
    ctaUrl: getAppUrl("/billing"),
  });
}

export async function sendPaymentFailedEmail(
  ownerEmail: string,
  ownerName: string,
  barName: string
) {
  return sendTemplatedEmail({
    to: ownerEmail,
    subject: `Pagamento fallito - ${barName}`,
    title: "Pagamento non riuscito",
    message: `Ciao ${ownerName},\nIl pagamento dell'abbonamento per ${barName} non e andato a buon fine. Aggiorna il metodo di pagamento o rinnova l'abbonamento.`,
    ctaLabel: "Vai al billing",
    ctaUrl: getAppUrl("/billing"),
  });
}

export async function sendTemporaryPasswordEmail(
  userEmail: string,
  userName: string,
  temporaryPassword: string
) {
  return sendTemplatedEmail({
    to: userEmail,
    subject: "Password temporanea Workbit",
    title: "Recupero password",
    message: `Ciao ${userName},\nabbiamo generato una password temporanea per il tuo accesso.\nPassword temporanea: ${temporaryPassword}\nDopo il login ti verra richiesto di cambiarla subito.`,
    ctaLabel: "Apri login",
    ctaUrl: getAppUrl("/login"),
  });
}
