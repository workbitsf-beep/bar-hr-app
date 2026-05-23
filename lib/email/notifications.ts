import "server-only";

import { sendEmail, type SendEmailResult } from "@/lib/email/resend";
import { buildEmailTemplate } from "@/lib/email/templates";

let hasLoggedMissingAppUrl = false;

export function getEmailAppUrl(path: string) {
  const baseUrl = process.env.APP_URL?.trim().replace(/\/$/, "");

  if (!baseUrl) {
    if (!hasLoggedMissingAppUrl) {
      console.error("[email] Missing APP_URL. Email CTA links are disabled.");
      hasLoggedMissingAppUrl = true;
    }

    return "";
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function sendTemplatedEmail(input: {
  to: string;
  subject: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl?: string;
  suppressFailureLog?: boolean;
}): Promise<SendEmailResult> {
  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    html: buildEmailTemplate({
      title: input.title,
      message: input.message,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
    }),
  });

  if (!result.ok && !input.suppressFailureLog) {
    console.error("[email] Notification delivery failed.", {
      recipient: input.to,
      subject: input.subject,
      error: result.error,
    });
  }

  return result;
}

function logWelcomeEmailStatus(input: {
  type: "owner" | "employee";
  stage: "sent" | "failed";
  recipient: string;
  error?: string;
}) {
  const message =
    input.type === "owner"
      ? `[welcome-email] owner ${input.stage}`
      : `[welcome-email] employee ${input.stage}`;

  if (input.stage === "failed") {
    console.error(message, {
      recipient: input.recipient,
      error: input.error,
    });
    return;
  }

  console.info(message, {
    recipient: input.recipient,
  });
}

function buildWelcomeCredentialsMessage(input: {
  greetingName: string;
  intro: string;
  loginEmail: string;
  temporaryPassword: string;
  loginLinkLine?: string | null;
  guideSteps: string[];
  localeLine?: string | null;
}) {
  return [
    `Ciao ${input.greetingName},`,
    input.intro,
    input.localeLine,
    "",
    "Credenziali iniziali:",
    `Email di accesso: ${input.loginEmail}`,
    `Password temporanea: ${input.temporaryPassword}`,
    input.loginLinkLine,
    "",
    "Al primo accesso ti verra richiesto di cambiare la password.",
    "",
    "Guida rapida:",
    ...input.guideSteps,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
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
    ctaUrl: getEmailAppUrl("/dashboard/shifts"),
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
    ctaUrl: getEmailAppUrl("/dashboard/requests"),
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
    ctaUrl: getEmailAppUrl("/dashboard/requests"),
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
    ctaUrl: getEmailAppUrl("/dashboard/requests"),
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
    ctaUrl: getEmailAppUrl("/dashboard/requests"),
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
    ctaUrl: getEmailAppUrl("/dashboard/tasks"),
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
    ctaUrl: getEmailAppUrl("/dashboard/calendar"),
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
    ctaUrl: getEmailAppUrl("/dashboard/tasks"),
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
    ctaUrl: getEmailAppUrl("/dashboard"),
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
    ctaUrl: getEmailAppUrl("/dashboard/settings"),
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
    ctaUrl: getEmailAppUrl("/dashboard/settings"),
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
    ctaUrl: getEmailAppUrl("/login"),
  });
}

export async function sendOwnerWelcomeEmail(
  ownerEmail: string,
  ownerName: string,
  barName: string | null | undefined,
  loginEmail: string,
  temporaryPassword: string
) {
  const loginUrl = getEmailAppUrl("/login");
  const ownerMessage = buildWelcomeCredentialsMessage({
    greetingName: ownerName,
    intro: barName
      ? "il tuo account titolare e il tuo locale sono pronti su Workbit."
      : "il tuo account titolare e pronto su Workbit.",
    localeLine: barName
      ? `Locale: ${barName}`
      : "Il Super Admin completera l'associazione del tuo locale.",
    loginEmail,
    temporaryPassword,
    loginLinkLine: loginUrl ? `Link di accesso: ${loginUrl}` : null,
    guideSteps: [
      "1. Accedi a Workbit",
      "2. Cambia password",
      "3. Vai nelle impostazioni del locale",
      "4. Posizionati fisicamente nel punto del locale dove vuoi autorizzare le timbrature",
      '5. Premi "Aggiorna posizione"',
      "6. Imposta il raggio GPS",
      "7. Crea dipendenti e turni",
    ],
  });

  const result = await sendTemplatedEmail({
    to: ownerEmail,
    subject: "Benvenuto in Workbit",
    title: "Benvenuto in Workbit",
    message: ownerMessage,
    ctaLabel: "Accedi a Workbit",
    ctaUrl: loginUrl || undefined,
    suppressFailureLog: true,
  });

  if (result.ok) {
    logWelcomeEmailStatus({
      type: "owner",
      stage: "sent",
      recipient: ownerEmail,
    });
  } else {
    logWelcomeEmailStatus({
      type: "owner",
      stage: "failed",
      recipient: ownerEmail,
      error: result.error,
    });
  }

  return result;
}

export async function sendEmployeeWelcomeEmail(
  employeeEmail: string,
  employeeName: string,
  barName: string,
  loginEmail: string,
  temporaryPassword: string
) {
  const loginUrl = getEmailAppUrl("/login");
  const employeeMessage = buildWelcomeCredentialsMessage({
    greetingName: employeeName,
    intro: `sei stato aggiunto al locale ${barName} su Workbit.`,
    loginEmail,
    temporaryPassword,
    loginLinkLine: loginUrl ? `Link di accesso: ${loginUrl}` : null,
    guideSteps: [
      "1. Accedi a Workbit",
      "2. Cambia password",
      "3. Consulta calendario turni",
      "4. Controlla mansioni e bacheca",
      "5. Quando sei nel raggio GPS del locale, usa Entrata/Uscita",
    ],
  });

  const result = await sendTemplatedEmail({
    to: employeeEmail,
    subject: "Benvenuto in Workbit",
    title: "Benvenuto in Workbit",
    message: employeeMessage,
    ctaLabel: "Accedi a Workbit",
    ctaUrl: loginUrl || undefined,
    suppressFailureLog: true,
  });

  if (result.ok) {
    logWelcomeEmailStatus({
      type: "employee",
      stage: "sent",
      recipient: employeeEmail,
    });
  } else {
    logWelcomeEmailStatus({
      type: "employee",
      stage: "failed",
      recipient: employeeEmail,
      error: result.error,
    });
  }

  return result;
}
