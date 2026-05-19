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

  if (!result.ok) {
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
  stage: "queued" | "sent" | "failed";
  recipient: string;
  error?: string;
}) {
  const message =
    input.type === "owner"
      ? `[welcome-email] owner welcome ${input.stage}`
      : `[welcome-email] employee welcome ${input.stage}`;

  if (input.stage === "failed") {
    console.error(message, {
      recipient: input.recipient,
      type: input.type,
      error: input.error,
    });
    return;
  }

  console.info(message, {
    recipient: input.recipient,
    type: input.type,
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
    ctaUrl: getEmailAppUrl("/dashboard/board"),
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
    ctaUrl: getEmailAppUrl("/billing"),
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
    ctaUrl: getEmailAppUrl("/billing"),
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
  temporaryPassword?: string
) {
  const ownerMessage = barName
    ? `Ciao ${ownerName},\nil tuo account titolare e il tuo locale sono pronti su Workbit.\nLocale: ${barName}\n\nCredenziali iniziali:\nEmail: ${loginEmail}\nPassword temporanea: ${temporaryPassword ?? "usa quella ricevuta in precedenza oppure richiedine una nuova dalla pagina di accesso."}\n\nAl primo accesso ti verra richiesto di cambiare password.\n\nGuida rapida:\n1. entra in Workbit\n2. cambia password\n3. vai nelle impostazioni del locale\n4. fisicamente posizionati nel punto del locale in cui vuoi autorizzare le timbrature\n5. premi "Aggiorna posizione"\n6. crea dipendenti e turni`
    : `Ciao ${ownerName},\nil tuo account titolare e pronto su Workbit.\n\nCredenziali iniziali:\nEmail: ${loginEmail}\nPassword temporanea: ${temporaryPassword ?? "usa quella ricevuta in precedenza oppure richiedine una nuova dalla pagina di accesso."}\n\nAl primo accesso ti verra richiesto di cambiare password.\n\nGuida rapida:\n1. entra in Workbit\n2. cambia password\n3. attendi l'associazione del tuo locale da parte del Super Admin\n4. accedi a Workbit appena il locale sara pronto`;

  logWelcomeEmailStatus({
    type: "owner",
    stage: "queued",
    recipient: ownerEmail,
  });

  const result = await sendTemplatedEmail({
    to: ownerEmail,
    subject: "Benvenuto in Workbit",
    title: "Benvenuto in Workbit",
    message: ownerMessage,
    ctaLabel: "Accedi a Workbit",
    ctaUrl: getEmailAppUrl("/login"),
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
  temporaryPassword?: string
) {
  logWelcomeEmailStatus({
    type: "employee",
    stage: "queued",
    recipient: employeeEmail,
  });

  const result = await sendTemplatedEmail({
    to: employeeEmail,
    subject: "Benvenuto in Workbit",
    title: "Benvenuto in Workbit",
    message: `Ciao ${employeeName},\nsei stato aggiunto al locale ${barName} su Workbit.\n\nCredenziali iniziali:\nEmail: ${loginEmail}\nPassword temporanea: ${temporaryPassword ?? "usa quella ricevuta in precedenza oppure richiedine una nuova dalla pagina di accesso."}\n\nAl primo accesso ti verra richiesto di cambiare password.\n\nGuida rapida:\n1. entra in Workbit\n2. cambia password\n3. consulta il calendario turni\n4. controlla mansioni e bacheca\n5. quando sei nel raggio GPS del locale, usa il tasto Entrata/Uscita per timbrare`,
    ctaLabel: "Accedi a Workbit",
    ctaUrl: getEmailAppUrl("/login"),
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
