import "server-only";

import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const defaultFrom = process.env.EMAIL_FROM || "Workbit <onboarding@resend.dev>";

let hasLoggedMissingApiKey = false;

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

export type SendEmailResult = {
  success: boolean;
  errorMessage?: string;
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

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailInput): Promise<SendEmailResult> {
  const recipients = normalizeRecipients(to);

  if (recipients.length === 0) {
    return {
      success: false,
      errorMessage: "No recipients provided.",
    };
  }

  if (!resend) {
    if (!hasLoggedMissingApiKey) {
      console.error("[email] Missing RESEND_API_KEY. Email delivery is disabled.");
      hasLoggedMissingApiKey = true;
    }

    return {
      success: false,
      errorMessage: "Missing RESEND_API_KEY.",
    };
  }

  try {
    const result = await resend.emails.send({
      from: defaultFrom,
      to: recipients,
      subject,
      html,
    });

    if (result.error) {
      console.error("[email] Failed to send email via Resend.", result.error);
      return {
        success: false,
        errorMessage: result.error.message || "Unknown Resend error.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[email] Unexpected Resend error.", error);
    return {
      success: false,
      errorMessage:
        error instanceof Error ? error.message : "Unexpected email delivery error.",
    };
  }
}
