import "server-only";

import { Resend } from "resend";

const FALLBACK_EMAIL_FROM = "Workbit <noreply@workbit.it>";
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

let hasLoggedMissingApiKey = false;
let hasLoggedMissingEmailFrom = false;

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

export type SendEmailResult =
  | {
      ok: true;
      success: true;
      error?: undefined;
      errorMessage?: undefined;
    }
  | {
      ok: false;
      success: false;
      error: string;
      errorMessage: string;
    };

function normalizeRecipients(to: string | string[]) {
  return Array.from(
    new Set(
      (Array.isArray(to) ? to : [to])
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    )
  );
}

function getEmailFrom() {
  const configuredFrom = process.env.EMAIL_FROM?.trim();

  if (configuredFrom) {
    return configuredFrom;
  }

  if (!hasLoggedMissingEmailFrom) {
    console.warn(
      `[email] EMAIL_FROM missing. Using fallback sender "${FALLBACK_EMAIL_FROM}". Set EMAIL_FROM on Railway to avoid delivery issues.`
    );
    hasLoggedMissingEmailFrom = true;
  }

  return FALLBACK_EMAIL_FROM;
}

function getErrorDetails(error: unknown) {
  if (!error) {
    return {
      errorMessage: "Unknown Resend error.",
      errorName: undefined as string | undefined,
      statusCode: undefined as number | string | undefined,
    };
  }

  if (typeof error === "string") {
    return {
      errorMessage: error,
      errorName: undefined,
      statusCode: undefined,
    };
  }

  if (typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      name?: unknown;
      statusCode?: unknown;
      status?: unknown;
      error?: unknown;
    };

    return {
      errorMessage:
        typeof maybeError.message === "string"
          ? maybeError.message
          : typeof maybeError.error === "string"
            ? maybeError.error
            : "Unknown Resend error.",
      errorName:
        typeof maybeError.name === "string" ? maybeError.name : undefined,
      statusCode:
        typeof maybeError.statusCode === "number" ||
        typeof maybeError.statusCode === "string"
          ? maybeError.statusCode
          : typeof maybeError.status === "number" ||
              typeof maybeError.status === "string"
            ? maybeError.status
            : undefined,
    };
  }

  return {
    errorMessage: "Unexpected email delivery error.",
    errorName: undefined,
    statusCode: undefined,
  };
}

function logEmailFailure(input: {
  recipients: string[];
  subject: string;
  emailFrom: string;
  error: unknown;
}) {
  const { errorMessage, errorName, statusCode } = getErrorDetails(input.error);

  console.error("[email] Send failed.", {
    recipient: input.recipients,
    subject: input.subject,
    emailFrom: input.emailFrom,
    hasResendKey: Boolean(resendApiKey),
    errorMessage,
    errorName,
    statusCode,
  });

  return errorMessage;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailInput): Promise<SendEmailResult> {
  const recipients = normalizeRecipients(to);
  const emailFrom = getEmailFrom();

  if (recipients.length === 0) {
    const error = "No recipients provided.";
    logEmailFailure({
      recipients,
      subject,
      emailFrom,
      error,
    });
    return {
      ok: false,
      success: false,
      error,
      errorMessage: error,
    };
  }

  if (!resend) {
    if (!hasLoggedMissingApiKey) {
      console.error("[email] RESEND_API_KEY missing. Email delivery is disabled.");
      hasLoggedMissingApiKey = true;
    }

    const error = logEmailFailure({
      recipients,
      subject,
      emailFrom,
      error: "Missing RESEND_API_KEY.",
    });

    return {
      ok: false,
      success: false,
      error,
      errorMessage: error,
    };
  }

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: recipients,
      subject,
      html,
    });

    if (result.error) {
      const error = logEmailFailure({
        recipients,
        subject,
        emailFrom,
        error: result.error,
      });

      return {
        ok: false,
        success: false,
        error,
        errorMessage: error,
      };
    }

    return { ok: true, success: true };
  } catch (error) {
    const safeError = logEmailFailure({
      recipients,
      subject,
      emailFrom,
      error,
    });

    return {
      ok: false,
      success: false,
      error: safeError,
      errorMessage: safeError,
    };
  }
}
